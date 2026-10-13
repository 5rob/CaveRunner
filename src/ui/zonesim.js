// @ts-check
// Dev → Zones (owner, after v1.0.77): reviewing the level's zones. A window on one zone made as a level makes it (art/zonelab.js),
// dragged to pan along it and up and down it; under it a card per zone kind: Show it plain or with a variant (heavy vegetation,
// spider web filled), a check box per variant for whether that zone kind may roll it in a level (DEV.zv_<variant>_<zone>,
// art/titlescene.js zoneMay), and a note box per zone and variant (kept in localStorage). Copy zone notes: the boxes changed from
// their defaults, the page's knobs changed and every note, as text for Claude.
import { VERSION } from '../version.js';
import { DEV, DEV_DEFAULTS, DEV_META, devSet } from '../dev/knobs.js';
import { TITLE_VW, TITLE_ZONES, ZONE_VARIANTS, titleCam } from '../art/titlescene.js';
import { zoneLabClamp, zoneLabScene } from '../art/zonelab.js';
import { h, useEffect, useRef, useState } from './h.js';
import { runScene } from './scenecanvas.js';
import { titleDraw } from '../game/render/titledraw.js';

/** @type {Record<string, string>} */
export const ZONE_NAMES = { moss: 'Mossy caves', webs: 'Webs', timber: 'Mine works', paved: 'Brick works', grove: 'Grove', winding: 'Winding caves', spider: 'Spider zone' };
const NOTES_KEY = 'caverunner-zonenotes';
const ZS_PIC_MS = 300;                // the whole-zone picture is made again this often (ms: it's a full draw per screen width)
const ZS_Q = 2;                       // its pixels per world unit
// a level's height (world units) on this screen: AutoScreen makes it the play area down to the bag's bottom, about 3/4 of the screen
const levelVh = () => Math.round(innerHeight * 0.75 * TITLE_VW / Math.max(1, innerWidth));
// the whole strip in one picture: the painter draws a screen width at a time (it keeps to one), so each is drawn at its own scroll
/** @param {import('../art/zonelab.js').ZoneLab} L @param {HTMLCanvasElement | null} pic the last one (reused) @returns {HTMLCanvasElement} */
function zonePicture(L, pic) {
  const S = L.S, s0 = S.scroll, W = Math.ceil(L.w * ZS_Q), H = Math.ceil(S.vh * ZS_Q);
  const cvs = pic || document.createElement('canvas');
  if (cvs.width !== W || cvs.height !== H) { cvs.width = W; cvs.height = H; }
  const tile = document.createElement('canvas');
  tile.width = Math.ceil(TITLE_VW * ZS_Q); tile.height = H;
  const cx = cvs.getContext('2d'), tx = tile.getContext('2d');
  if (!cx || !tx) return cvs;
  for (let x = 0; x < L.w; x += TITLE_VW) {
    S.scroll = x;
    tx.setTransform(1, 0, 0, 1, 0, 0);
    titleDraw(tx, S, tile.width, H);
    cx.drawImage(tile, Math.round(x * ZS_Q), 0);
  }
  S.scroll = s0;
  return cvs;
}
/** @typedef {{ z: string, v: string }} ZonePick (v: '' plain, else a ZONE_VARIANTS id) */
/** @typedef {{ L: import('../art/zonelab.js').ZoneLab | null, C: any, again: boolean, seed: number, x: number, y: number, pick: ZonePick, whole: boolean, pic: HTMLCanvasElement | null, picT: number, ox: number }} ZoneSimState */

/** @returns {Record<string, string>} */
function loadNotes() { try { return JSON.parse(localStorage.getItem(NOTES_KEY) || '{}') || {}; } catch (_) { return {}; } }
/** @param {Record<string, string>} n */
function saveNotes(n) { try { localStorage.setItem(NOTES_KEY, JSON.stringify(n)); } catch (_) {} }
/** @param {string} z @param {string} v */
const vk = (z, v) => 'zv_' + v + '_' + z;
/** @param {string} z @param {string} v */
const rowName = (z, v) => ZONE_NAMES[z] + (v ? ' · ' + (ZONE_VARIANTS.find(x => x[0] === v) || ['', v])[1].toLowerCase() : ' (plain)');
const ZONE_GROUPS = ['autozones', 'autoorb'];

// the text Copy zone notes gives
/** @param {Record<string, string>} notes */
export function zoneNotesText(notes) {
  const lines = ['CaveRunner ' + VERSION + ' zone review (Dev → Zones) — please make these changes:', ''];
  const boxes = [];
  for (const z of TITLE_ZONES) for (const [v, name] of ZONE_VARIANTS) {
    const k = vk(z, v);
    if (k in DEV_DEFAULTS && DEV[k] !== DEV_DEFAULTS[k]) boxes.push('- ' + ZONE_NAMES[z] + ': ' + name.toLowerCase() + ' ' + (DEV[k] ? 'now allowed (was not)' : 'no longer allowed (was)') + '   [DEV.' + k + ' = ' + DEV[k] + ']');
  }
  lines.push('Variants a zone may have (changed):', ...(boxes.length ? boxes : ['(none changed)']), '');
  const knobs = DEV_META.filter(m => ZONE_GROUPS.includes(m.g) && DEV[m.k] !== DEV_DEFAULTS[m.k]);
  lines.push('Zone knobs (changed):', ...(knobs.length ? knobs.map(m => '- ' + m.label + ' (DEV.' + m.k + '): ' + DEV[m.k] + '   [default ' + DEV_DEFAULTS[m.k] + ']') : ['(none changed)']), '');
  const said = [];
  for (const z of TITLE_ZONES) for (const v of ['', ...ZONE_VARIANTS.map(x => x[0])]) {
    const t = (notes[z + '/' + v] || '').trim();
    if (t) said.push('- ' + rowName(z, v) + ': ' + t.replace(/\s*\n\s*/g, ' / '));
  }
  lines.push('Notes:', ...(said.length ? said : ['(no notes)']));
  return lines.join('\n');
}

export function ZoneSim() {
  /** @type {{ current: HTMLCanvasElement | null }} */
  const cv = useRef(null);
  /** @type {{ current: ZoneSimState }} */
  const st = useRef({ L: null, C: null, again: false, seed: 1 + Math.floor(Math.random() * 1e6), x: 0, y: -1, pick: { z: 'moss', v: '' }, whole: true, pic: null, picT: 0, ox: 0 });
  const [whole, setWhole] = useState(true);
  const [pick, setPick] = useState(st.current.pick);
  const [notes, setNotes] = useState(loadNotes);
  const [, bump] = useState(0);
  /** @type {{ text: string, ok: boolean } | null} */
  const none = null;
  const [copied, setCopied] = useState(none);
  useEffect(() => {
    const c = cv.current;
    if (!c) return;
    const k = () => c.clientWidth / TITLE_VW;
    const stop = runScene(c, {
      size: () => ({ w: c.clientWidth, hh: c.clientHeight }),
      make: (w, hh) => {
        const view = hh * TITLE_VW / w, p = st.current.pick;
        const L = zoneLabScene(levelVh(), st.current.seed, p.z, p.v === 'veg' ? { veg: true } : p.v === 'spid' ? { spid: true } : {});
        const vh = L.S.vh;
        L.S.scroll = zoneLabClamp(L, st.current.x);
        st.current.L = L; st.current.pic = null;
        const C = titleCam(view / 2, vh);
        C.view = view; C.y = st.current.y < 0 ? vh / 2 : st.current.y;
        st.current.C = C;
        if (window.__TEST) window.__zonesim = st.current;     // the browser suite's and shot scripts' reach
        return { S: L.S, C, warm: 0 };
      },
      next: () => { if (!st.current.again) return false; st.current.again = false; return true; },
      // the whole zone: over the live view, the stitched picture fitted to the window's height
      over: (ctx, S, w, hh) => {
        const Z = st.current;
        if (!Z.whole || !Z.L) return;
        const now = performance.now();
        if (!Z.pic || now - Z.picT > ZS_PIC_MS) { Z.pic = zonePicture(Z.L, Z.pic); Z.picT = now; }
        const s = hh / S.vh, pw = Z.L.w * s;
        Z.ox = pw <= w ? (w - pw) / 2 : Math.max(w - pw, Math.min(0, Z.ox));
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, hh);
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(Z.pic, Z.ox, 0, pw, hh);
      },
      still: true, quiet: true,
    });
    // one finger pans: sideways along the zone, up and down it (the whole zone: sideways only, when it's wider than the window)
    /** @type {{ x: number, y: number } | null} */
    let p0 = null;
    /** @param {PointerEvent} e */
    const down = e => { p0 = { x: e.clientX, y: e.clientY }; c.setPointerCapture(e.pointerId); };
    /** @param {PointerEvent} e */
    const move = e => {
      const Z = st.current, L = Z.L, C = Z.C;
      if (!p0 || !L || !C) return;
      if (Z.whole) Z.ox += e.clientX - p0.x;
      else {
        const S = L.S, was = S.scroll;
        S.scroll = zoneLabClamp(L, S.scroll - (e.clientX - p0.x) / k());
        for (const q of S.parts) q.x -= S.scroll - was;
        C.y -= (e.clientY - p0.y) / k();
        Z.x = S.scroll; Z.y = C.y;
      }
      p0 = { x: e.clientX, y: e.clientY };
    };
    const up = () => { p0 = null; };
    c.addEventListener('pointerdown', down); c.addEventListener('pointermove', move);
    c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
    return () => {
      stop();
      c.removeEventListener('pointerdown', down); c.removeEventListener('pointermove', move);
      c.removeEventListener('pointerup', up); c.removeEventListener('pointercancel', up);
    };
  }, []);
  /** @param {ZonePick} p */
  const show = p => { st.current.pick = p; st.current.x = 0; st.current.again = true; setPick(p); };
  const respawn = () => { st.current.seed = 1 + Math.floor(Math.random() * 1e6); st.current.again = true; };
  /** @param {string} z @param {string} v @param {string} t */
  const note = (z, v, t) => { const n = Object.assign({}, notes, { [z + '/' + v]: t }); if (!t) delete n[z + '/' + v]; setNotes(n); saveNotes(n); };
  const copy = () => {
    const text = zoneNotesText(notes);
    const fallback = () => setCopied({ text, ok: false });
    try { navigator.clipboard.writeText(text).then(() => setCopied({ text, ok: true }), fallback); } catch (_) { fallback(); }
  };
  /** @param {string} cls @param {string} label @param {() => void} fn */
  const btn = (cls, label, fn) => h('button', { className: 'dbg ' + cls, onPointerDown: (/** @type {PointerEvent} */ e) => { e.preventDefault(); fn(); } }, label);
  const top = h('div', { className: 'firesimtop zonesimtop' },
    h('div', { className: 'zonesim' },
      h('p', { className: 'zsname' }, 'Showing: ' + rowName(pick.z, pick.v)),
      h('canvas', { ref: cv, className: 'zonesimcvs' }),
      h('div', { className: 'firesimbtns' }, btn('zonezoom', whole ? 'Close up' : 'Whole zone', () => { st.current.whole = !whole; setWhole(!whole); }), btn('zonerespawn', 'Respawn', respawn), btn('zonecopy', 'Copy zone notes', copy)),
      copied ? h('p', { className: 'devnote devcopied' + (copied.ok ? ' ok' : '') }, copied.ok ? 'Copied — paste it to Claude.' : 'Could not reach the clipboard — press and hold the text below to copy it.') : null,
      copied && !copied.ok ? h('textarea', { className: 'devcopytext', readOnly: true, value: copied.text }) : null));
  const cards = h('div', { className: 'zcards' },
    h('p', { className: 'devnote' }, 'Drag the window to look round the zone. Show puts a zone in it with that look forced; the box says whether that zone can have it in a level. Notes save on their own.'),
    TITLE_ZONES.map(z => h('div', { key: z, className: 'zcard', 'data-zone': z },
      h('div', { className: 'zchead' }, ZONE_NAMES[z]),
      ['', ...ZONE_VARIANTS.map(x => x[0])].map(v => {
        const on = pick.z === z && pick.v === v, key = vk(z, v), always = v === 'spid' && z === 'spider';
        return h('div', { key: v || 'plain', className: 'zrow' + (on ? ' on' : ''), 'data-v': v || 'plain' },
          h('div', { className: 'zrowtop' },
            h('button', { className: 'dbg zshow' + (on ? ' on' : ''), onClick: () => show({ z, v }) }, on ? 'Showing' : 'Show'),
            h('span', { className: 'zlabel' }, v ? (ZONE_VARIANTS.find(x => x[0] === v) || ['', v])[1] : 'Plain'),
            v ? h('label', { className: 'zmay' },
              h('input', { type: 'checkbox', className: 'zcheck', checked: always || !!DEV[key], disabled: always,
                onChange: (/** @type {any} */ e) => { devSet(key, e.target.checked ? 1 : 0); bump(n => n + 1); } }),
              always ? 'always' : 'can have') : null),
          h('textarea', { className: 'znote', rows: 2, placeholder: 'Notes on ' + rowName(z, v) + '…', value: notes[z + '/' + v] || '',
            onChange: (/** @type {any} */ e) => note(z, v, e.target.value) }));
      }))));
  return h(React.Fragment, null, top, cards);
}
