// @ts-check
// The pieces of CaveRunner Auto's old play screen (AutoScreen.js, cut on the grem branch) that Grem Mode still uses:
// the Dev panel's own pages (DEV_PAGES: Presets, Grem), the pill stick (PillStick), the gun panel with its firing window
// (GunPanel, PreviewWindow: Dev → Presets' editor), a bag item's icon and outline (ItemIcon, itemEdge, Grab) and a pickup's
// tile flying to its counter (FlyTile).

import { SFX } from '../../audio/sfx.js';
import { TITLE_VW, camTo, titleCam } from '../../art/titlescene.js';
import { DEAD, PH, PW } from '../../core/consts.js';
import { holoPass } from '../../game/render/guide.js';
import { DEV } from '../../dev/knobs.js';
import { MODS, famCol } from '../../spells/mods.js';
import { HUB_MACHINES } from '../../auto/hub.js';
import { PERKS } from '../../data/perks.js';
import { GunIcon, GunStats } from '../editor.js';
import { fireSimNew } from '../../spells/bagsim.js';
import { PV_GRAPH_N, PV_HIT_T, previewScene, previewState, pvSim } from '../../auto/preview.js';
import { GlyphIcon, NuggetIcon, PixIcon, TargetPic } from './icons.js';
import { targetOf } from '../../spells/discrim.js';
import { isAutoTarget } from '../../art/discrimicon.js';
import { devShown } from '../devmode.js';
import { addPreset, loadPresets, savePresets } from '../../save/presets.js';
import { PresetLib } from './presetlib.js';
import { GremKit } from './gremkit.js';
import { runScene } from '../scenecanvas.js';
import { drawRunner } from '../../art/sprites.js';
import { itemEdgeCol } from '../../auto/itemtile.js';
import { h, useEffect, useRef, useState } from '../h.js';
/** @typedef {import('../../art/titlescene.js').TitleCam} TitleCam */

const ROMAN = ['I', 'II', 'III', 'IV', 'V'];
// a second tap within this (ms) grows the firing window, or shrinks it back
const BIG_TAP = 350;

// (Grem Mode) the Dev panel's own pages: Presets (the gun presets library) and Grem (player 1's kit)
export const DEV_PAGES = { presets: () => h(PresetLib), grem: () => h(GremKit) };

// PillState: as the old game's left stick (ui/hud.js Stick): active while held; dx, dy the finger from the middle as a
// share of the pill's half-width and half-height (so a small push up reads as up); mag their length (0-1, clamped), nx, ny
// its direction
/** @typedef {{ active: boolean, nx: number, ny: number, mag: number, dx: number, dy: number }} PillState */
const PILL_REST = { active: false, nx: 0, ny: 0, mag: 0, dx: 0, dy: 0 };
const PILL_REACH = 54;                 // the knob's reach (px): the old 150 px stick's 75 × 0.72 (ui/hud.js Stick maxD)

// The stick (owner, bug round 1: was a pill between B and A): a circle at the bar's left end, centred on the bar's middle
// and rising over the bag's corner (cut off at the bar's bottom), so there's room to push down as well as up; one outline
// round it and the bar (style.css: the ring under the bar's fill, the circle's fill over it). The knob rests at its centre
// (.apill, the maths' centre) in a shallow dark well, and follows the finger. Pointer capture, so the finger may wander off it; letting go puts the knob back and the push to rest
/** @param {{ onMove: (st: PillState) => void }} props */
export function PillStick({ onMove }) {
  const ref = useRef(null);
  const pid = useRef(null);
  const [knob, setKnob] = useState({ x: 0, y: 0, jet: false });
  /** @param {any} e */
  const update = e => {
    const el = ref.current;
    if (!el) return;
    // (owner, feedback round 1) the old left stick's maths exactly (ui/hud.js Stick): one radius every way, PILL_REACH,
    // the knob free out to it (past the pill's edges)
    const r = el.getBoundingClientRect();
    const fx = e.clientX - (r.left + r.width / 2), fy = e.clientY - (r.top + r.height / 2), d = Math.hypot(fx, fy);
    const cl = Math.min(d, PILL_REACH), nx = d ? fx / d : 0, ny = d ? fy / d : 0, mag = cl / PILL_REACH;
    /** @type {PillState} */
    const st = { active: true, nx, ny, mag, dx: nx * mag, dy: ny * mag };
    onMove(st);
    setKnob({ x: nx * cl, y: ny * cl, jet: ny < 0 && mag > DEAD });
  };
  /** @param {any} e */
  const down = e => {
    e.preventDefault();
    if (pid.current !== null) return;
    pid.current = e.pointerId;
    SFX.unlock();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) { /* (a synthetic event: no capture) */ }
    update(e);
  };
  /** @param {any} e */
  const move = e => { if (e.pointerId === pid.current) update(e); };
  /** @param {any} e */
  const end = e => {
    if (e.pointerId !== pid.current) return;
    pid.current = null;
    onMove(PILL_REST);
    setKnob({ x: 0, y: 0, jet: false });
  };
  return h('div', { className: 'astick', onPointerDown: down, onPointerMove: move, onPointerUp: end, onPointerCancel: end },
    h('i', { className: 'adomering' }), h('i', { className: 'adomefill' }),
    h('div', { ref, className: 'apill' },
      h('div', { className: 'apillknob' + (knob.jet ? ' jet' : ''), style: { transform: 'translate(' + knob.x + 'px,' + knob.y + 'px)' } })));
}

// The gun panel (owner, feedback round 2): the old Bag's top (ui/editor.js) in the auto screen's colours: the gun's stats
// on the left (the live cast/recharge/mana bars), the firing window on the right. (owner: "matching the real game 1 for 1") The
// window is the level's own scene (auto/preview.js previewScene, run by runScene: quiet, still): the player fires the gun at a
// target that never dies, by the level's code at the level's speed and scale (PreviewWindow). Its step feeds the stat bars
// (pvSim), the damage per second over the target and its graph, and lights the mod slots below in each pull's colour (onLit).
// (owner, round 2) A double tap on the window grows it left over the stats (.big: the stats hidden), again shrinks it back; the
// room is made again at the new size, the player at its new left edge.
// (Grem Mode) in dev mode a 💾 (owner, v1.0.87: the window's top right, off the stats) saves the gun as a gun preset (save/presets.js; Dev → Presets lists them); noSave:
// none (Dev → Presets' own editor)
/** @param {{ gun: Gun, sig: string, col: string, onLit?: (lit: any) => void, cls: string, pl: RunPlayer, gi: number, noSave?: boolean }} props */
export function GunPanel({ gun, sig, col, onLit, cls, pl, gi, noSave }) {
  /** @type {{ current: import('../../spells/bagsim.js').FireSim & { sig?: string } | null }} */
  const sim = useRef(null);
  if (!sim.current || sim.current.sig !== sig) sim.current = Object.assign(fireSimNew(gun), { sig });
  const [big, setBig] = useState(false);
  const [saved, setSaved] = useState(0);
  const flip = () => setBig(b => !b);
  /** @param {any} e */
  const keep = e => { e.preventDefault(); e.stopPropagation(); savePresets(addPreset(loadPresets(), gun.name, gun)); SFX.fx('open'); setSaved(n => n + 1); };
  return h('div', { className: 'agunpanel ' + cls + (big ? ' big' : ''), style: { '--pc': col } },
    h(GunStats, { gun, sim, sig }),
    h(PreviewWindow, { sim, sig, onLit, pl, gi, flip }),
    !noSave && devShown() ? h('button', { className: 'agpsave', title: 'Save as a preset', onPointerDown: keep }, saved ? h('span', { key: saved, className: 'agpsaved' }, '✓') : '💾') : null);
}

// the firing window: the preview scene on a canvas, at the play area's scale (css px per world unit, as the level is drawn)
// the hologram (the old window's dummy you, ui/editor.js GunFire): its own little layer, HOLO_P px a world unit, through the
// guide's hologram look (render/guide.js holoPass); dark at rest, lit and glitching for PV_HIT_T after a hit
const HOLO_P = 3;
/** @param {{ sim: { current: import('../../spells/bagsim.js').FireSim | null }, sig: string, onLit?: (lit: any) => void, pl: RunPlayer, gi: number, flip: () => void }} props */
function PreviewWindow({ sim, sig, onLit, pl, gi, flip }) {
  const tapT = useRef(0);
  /** a second tap within BIG_TAP ms: grow / shrink @param {any} e */
  const tap = e => { e.preventDefault(); const t = performance.now(); if (t - tapT.current < BIG_TAP) { tapT.current = 0; flip(); } else tapT.current = t; };
  /** @type {{ current: HTMLCanvasElement | null }} */
  const ref = useRef(null);
  const litFn = useRef(onLit);
  litFn.current = onLit;
  // the DPS graph outlives the scene (rebuilt on every gun change): carried into the next one, the change marked on it
  /** @type {{ current: { graph: number[], gmark: number[], sig: string } }} */
  const hist = useRef({ graph: [], gmark: [], sig: sig });
  useEffect(() => {
    const c = ref.current;
    if (!c) return undefined;
    /** @type {TitleCam | null} */
    let cam = null;
    let prev = null;
    const DL = document.createElement('canvas'), dlx = DL.getContext('2d', { willReadFrequently: true });
    const DLW = Math.ceil((PW + 8) * HOLO_P), DLH = Math.ceil((PH + 6) * HOLO_P);
    DL.width = DLW; DL.height = DLH;
    // the level's scale: the play area's canvas is TITLE_VW world units across
    const play = document.querySelector('.aplaycvs');
    const kpx = () => Math.max(1, (play && play.clientWidth) || window.innerWidth) / TITLE_VW;
    const stop = runScene(c, {
      size: () => ({ w: c.clientWidth, hh: c.clientHeight }),
      make: (w, hh, seed) => {
        const k = kpx(), vw = w / k, vh = hh / k, S = previewScene(vw, vh, pl, gi, seed);
        const pv0 = previewState(S), H0 = hist.current;
        if (pv0) { pv0.graph = H0.graph; pv0.gmark = H0.gmark; pv0.mark = H0.sig !== sig && H0.graph.length > 0; H0.sig = sig; }
        // the camera: the whole room, at k px a unit (titleDraw draws w / TITLE_VW × C.z px a unit)
        const z = TITLE_VW / vw, C = titleCam(vh * z / 2, vh);
        C.z = C.zmin = z; C.w = vw; C.x = vw / 2; C.y = vh / 2; C.lock = -1;
        cam = C;
        if (window.__TEST_TITLE) window.__pvScene = S;   // shot scripts reach the preview (tools/discrimshots.js)
        return { S, C, warm: 20 };
      },
      quiet: true, still: true,
      step: S => {
        const pv = previewState(S), p = S.team && S.team[0], g = p && p.guns[p.active];
        if (sim.current && g) pvSim(sim.current, g);
        if (pv && pv.lit !== prev) { prev = pv.lit; if (litFn.current) litFn.current(pv.lit); }
      },
      over: (ctx, S, w) => {
        const pv = previewState(S);
        if (!pv || !cam) return;
        const k = w / TITLE_VW, z = cam.z * k, at = camTo(cam, pv.dx - PW / 2, pv.dy - PH / 2), hx = at.x * k, hy = at.y * k;
        // the hologram you, facing the gun, over the scene (the dark included: it glows)
        if (dlx) {
          const hurt = pv.hitT > 0, fl = hurt && Math.floor(pv.hitT * 30) % 2 === 0;
          dlx.setTransform(1, 0, 0, 1, 0, 0); dlx.clearRect(0, 0, DLW, DLH);
          dlx.setTransform(HOLO_P, 0, 0, HOLO_P, 4 * HOLO_P, 3 * HOLO_P);
          drawRunner(dlx, 0, 0, PW, PH, -1, null, false, 0, fl);
          dlx.setTransform(1, 0, 0, 1, 0, 0);
          holoPass(dlx, DLW, DLH, S.t, hurt ? 0.4 + pv.hitT / PV_HIT_T * 0.6 : 0);
          ctx.save();
          ctx.globalAlpha = hurt ? (fl ? 1 : 0.6) : 0.4;    // dark at rest, lit when hit
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(DL, hx - 4 * z, hy - 3 * z, DLW / HOLO_P * z, DLH / HOLO_P * z);
          ctx.restore();
        }
        // its damage per second over its head (red, as the old window's; gone at 0), and the graph across the top third
        if (pv.dps > 0) {
          ctx.font = '700 11px ui-monospace,SFMono-Regular,Menlo,monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
          const txt = (pv.dps >= 10 ? Math.round(pv.dps) : pv.dps.toFixed(1)) + ' dps', gw0 = c.clientWidth;
          const tx = Math.min(hx + PW * z / 2, gw0 - ctx.measureText(txt).width / 2 - 2), ty = Math.max(12, hy - 2);
          ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.strokeText(txt, tx, ty);
          ctx.fillStyle = '#ff4a4a'; ctx.fillText(txt, tx, ty); ctx.textBaseline = 'alphabetic';
        }
        const vals = pv.graph, peak = Math.max(...vals, 0), H = c.clientHeight, gw = c.clientWidth;
        if (vals.length > 1 && peak > 0) {
          const top = 4, bot = H / 3, step = gw / (PV_GRAPH_N - 1), x0 = gw - (vals.length - 1) * step;
          ctx.strokeStyle = '#ff4a4a'; ctx.lineWidth = 1.2; ctx.globalAlpha = 0.7; ctx.beginPath();
          vals.forEach((v, i) => { const x = x0 + i * step, y = bot - (v / peak) * (bot - top); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
          ctx.stroke();
          // a dotted line where the gun changed
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.globalAlpha = 0.45; ctx.setLineDash([2, 2]); ctx.beginPath();
          pv.gmark.forEach((m, i) => { if (m) { const x = Math.round(x0 + i * step) + 0.5; ctx.moveTo(x, top); ctx.lineTo(x, bot); } });
          ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
        }
        c.dataset.hit = pv.hitT > 0 ? '1' : '0'; c.dataset.big = String(Math.round(cam.w || 0));
        c.dataset.pulls = String(pv.pulls); c.dataset.dps = pv.dps.toFixed(1); c.dataset.shots = String(S.shots.length);
      },
    });
    return () => { stop(); if (litFn.current) litFn.current(null); };
  }, [sig]);
  return h('canvas', { ref, className: 'gfire apv', onPointerDown: tap });
}

/** @param {{ it: BagItem }} props */
export function ItemIcon({ it }) {
  if (it.kind === 'gun' && it.gun) return h(GunIcon, { gun: it.gun });
  /** @type {{ glyph: string, col: string, tier?: number } | null} */
  let g = null;
  if (it.kind === 'mod') { const m = MODS[it.id || '']; g = m ? { glyph: m.glyph, col: famCol(it.id || '') } : { glyph: '?', col: '#888' }; }   // its family's colour (owner)
  else if (it.kind === 'exo') {
    return h('span', { className: 'aglyph' }, h(PixIcon, { id: it.cat || 'hp', size: '64%', tint: HUB_MACHINES.exo.hue }), it.tier ? h('i', { className: 'atier' }, ROMAN[it.tier - 1]) : null);
  }
  else if (it.kind === 'perk') { const pk = PERKS[it.id || '']; g = pk ? { glyph: pk.glyph, col: HUB_MACHINES.perk.hue } : { glyph: '?', col: '#888' }; }   // the perk machine's (owner)
  else if (it.kind === 'gold' || it.kind === 'red' || it.kind === 'green') return h('span', { className: 'aglyph' }, h(NuggetIcon, { kind: it.kind }));   // (owner v1.0.74) the world's sprite
  if (!g) return null;
  const tg = it.kind === 'mod' ? targetOf(it.id) : null;   // a set Discriminate: its target's picture in the corner (v1.0.71)
  return h('span', { className: 'aglyph' }, h(GlyphIcon, { glyph: g.glyph, col: g.col }),
    g.tier ? h('i', { className: 'atier' }, ROMAN[g.tier - 1]) : null,
    tg && isAutoTarget(tg) ? h(TargetPic, { t: tg, size: 22, className: 'atgt aon' }) : null);
}


// the grab handle: a circle round the tile's centre, DEV.autoGrab of the tile's width in radius (touch-action none:
// only it starts a drag; the rest of the tile scrolls the bag)
export function Grab() {
  const d = (200 * DEV.autoGrab).toFixed(1) + '%';
  return h('i', { className: 'agrab', style: { width: d, height: d } });
}

// a tile's outline by the item's group (owner): auto/itemtile.js itemEdgeCol (the canvas's tiles share it)
/** @param {BagItem | null} it @returns {any} */
export const itemEdge = it => it ? { '--ic': itemEdgeCol(it) } : undefined;

// a pickup's tile flying into its bag slot (owner): FLY_MS, eased, from the player (a little small) to the slot (its size)
/** @typedef {{ k: number, it: BagItem, slot: number, fresh: boolean, x0: number, y0: number, x1: number, y1: number, s: number }} Fly */
export const FLY_MS = 500;
/** @param {{ f: Fly, done: () => void }} props */
export function FlyTile({ f, done }) {
  /** @type {{ current: HTMLDivElement | null }} */
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !el.animate) { done(); return undefined; }
    const a = el.animate([{ transform: 'translate(' + (f.x0 - f.x1) + 'px,' + (f.y0 - f.y1) + 'px) scale(0.55)' }, { transform: 'translate(0px,0px) scale(1)' }],
      { duration: FLY_MS, easing: 'cubic-bezier(.45,0,.25,1)', fill: 'forwards' });
    a.onfinish = done;
    return () => a.cancel();
  }, []);
  return h('div', { ref, className: 'aslot full afly k-' + f.it.kind, 'data-fly': f.slot,
    style: { left: (f.x1 - f.s / 2) + 'px', top: (f.y1 - f.s / 2) + 'px', width: f.s + 'px', height: f.s + 'px', ...itemEdge(f.it) } }, h(ItemIcon, { it: f.it }));
}
