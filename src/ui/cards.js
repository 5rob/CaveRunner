// @ts-check
// The detail cards: GunCard (a gun's stats, optionally compared with another), ModCard
// (a spell: what it does, its numbers, a use example in the editor) and PerkCard. The same
// card shows in the build screen and in the shop/pickup panel (ingame).

import { PERKS } from '../data/perks.js';
import { modPreview } from '../spells/advisor.js';
import { effRecharge, gunPassives } from '../spells/cast.js';
import { gunColor, gunLvCol } from '../spells/guns.js';
import { MODS, famCol, famOf } from '../spells/mods.js';
import { targetIcon } from '../spells/discrim.js';
import { devShown } from './devmode.js';
import { auditGet, auditNotes, auditToggle, loadAudit, saveAudit } from '../save/audit.js';
import { h, useState } from './h.js';

// The same detail card is used by the build screen and by the shop, so what you
// read standing on a plinth is exactly what you get once you own it.
// Every gun stat in one place, with which direction counts as an improvement:
// a smaller cast delay, recharge or spread is better, so those read green.
export const GUN_STATS = [
  { k: 'cap', label: 'slots', better: 1, get: g => g.cap, fmt: v => String(v) },
  { k: 'delay', label: 'cast delay', better: -1, get: g => g.castDelay, fmt: v => v.toFixed(2) + 's' },
  { k: 'rech', label: 'recharge', better: -1, get: effRecharge, fmt: v => v.toFixed(2) + 's' },
  { k: 'mana', label: 'mana', better: 1,
    get: g => g.manaMax + gunPassives(g).manaMax, fmt: v => String(Math.round(v)) },
  { k: 'regen', label: 'mana regen', better: 1,
    get: g => g.manaRegen + gunPassives(g).manaRegen, fmt: v => Math.round(v) + '/s' },
  { k: 'spread', label: 'spread', better: -1, get: g => g.spread, fmt: v => v.toFixed(1) + '\u00b0' },
  { k: 'multi', label: 'shots per cast', better: 1, get: g => g.multi, fmt: v => String(v) },
  { k: 'speed', label: 'shot speed', better: 1, get: g => g.speedMul || 1, fmt: v => 'x' + v.toFixed(2) },
  { k: 'order', label: 'cast order', better: 1,
    get: g => (g.shuffle ? 0 : 1), fmt: v => (v ? 'in order' : 'shuffle') },
];

// A mod's card over everything, the shade behind it closing it: a portal to the page, so the card it
// was opened from (a gun card: a pickup, the gun machine, the Bag) neither clips nor restyles it
/** @param {{ id: string, close: () => void }} props */
export function ModPop({ id, close }) {
  return ReactDOM.createPortal(h('div', { className: 'modpop' },
    h('div', { className: 'shade', onPointerDown: e => { e.preventDefault(); close(); } }),
    h(ModCard, { id, onClose: close, top: true })), document.body);
}

// One card for a gun: its rolled stats and the mods sitting on it, as the square tiles the Bag uses
// (v0.0.144, owner; `tapMods`: tapping one shows its card, ModPop).
// `split` is the gun-pickup variant: the stats collapse to wrapping chips and the
// card becomes a flex column, so the mod row at the bottom never gets pushed off.
/** @param {{ gun: Gun, label?: string, onClose?: () => void, ingame?: boolean, flow?: boolean, split?: boolean, mark?: string, compare?: Gun | null, compareName?: string, tapMods?: boolean }} props */
export function GunCard({ gun, label, onClose, ingame, flow, split, mark, compare, compareName, tapMods }) {
  const [info, setInfo] = useState(null);       // the mod whose card is up (tapMods)
  const vs = compare && compare !== gun ? compare : null;
  const stats = GUN_STATS.map(st => {
    const v = st.get(gun);
    let cls = '';
    if (vs) {
      const o = st.get(vs);
      if (Math.abs(v - o) > 1e-6) cls = (v > o) === (st.better > 0) ? ' up' : ' down';
    }
    return { st, v, cls };
  });
  return h('div', { className: 'pop scroll' + (ingame ? ' ingame' : '') + (flow ? ' flow' : '') +
      (split ? ' split' : '') + (mark ? ' ' + mark : '') },
    h('div', { className: 'phead' },
      h('div', { className: 'pglyph', style: { borderColor: gunLvCol(gun) || '#c9ccd4', color: gunLvCol(gun) || '#c9ccd4' } }, '⌥'),
      h('div', { className: 'ptitle' },
        h('b', { style: { color: gunColor(gun) } }, gun.name),
        h('span', null, (label || 'Gun') + (gun.lvl ? ' · Lv ' + gun.lvl : '') + ' · ' + gun.cap + ' slots')),
      onClose ? h('button', { className: 'pclose',
        onPointerDown: e => { e.preventDefault(); onClose(); } }, '×') : null
    ),
    vs ? h('p', { className: 'vs' }, 'compared with ' + compareName) : null,
    split
      ? h('div', { className: 'stats gstats' },
          stats.map(r => h('div', { className: 'st' + r.cls, key: r.st.k },
            h('b', null, r.st.fmt(r.v)), h('span', null, r.st.label))))
      : h('div', { className: 'prows' },
          stats.map(r => h('div', { className: 'prow' + r.cls, key: r.st.k },
            h('span', null, r.st.label), h('b', null, r.st.fmt(r.v))))),
    h('div', { className: 'pdemo' },
      h('div', { className: 'gmods' },
        gun.slots.map((id, i) => {
          const m = id ? MODS[id] : null;
          return h('div', { key: i, 'data-mod': id || undefined,
              className: 'tile' + (m ? '' : ' hole') + (m && m.kind === 'shot' ? ' shot' : '') + (m && tapMods ? ' tap' : ''),
              style: m ? { borderColor: famCol(id), color: famCol(id) } : null,
              onPointerDown: m && tapMods ? e => { e.preventDefault(); e.stopPropagation(); setInfo(id); } : undefined },
            h('span', { className: 'tg' }, m ? m.glyph : ''),
            m ? h('span', { className: 'tn' }, m.name) : null,
            m && m.mark ? h('span', { className: 'tmark' }, m.mark) : null);
        })),
      split && gun.slots.some(Boolean) ? null       // the split view needs the height more
        : h('span', { className: 'dnote' }, gun.slots.some(Boolean)
          ? 'cast left to right' + (tapMods ? ' · tap one for its card' : '') : 'nothing fitted yet')),
    info && MODS[info] ? h(ModPop, { id: info, close: () => setInfo(null) }) : null
  );
}

/** @typedef {import('../save/audit.js').Audit} AuditData */
// The owner's audit (LIST3 #6, save/audit.js): one item's mark and notes, read fresh from storage
/** @param {string} key */
function useAudit(key) {
  // keyed by the item, so a card reused for another mod (the Bag's) reads that one's afresh
  const [st, setSt] = useState(() => ({ key, e: auditGet(loadAudit(), key), fb: false }));
  const cur = st.key === key ? st : { key, e: auditGet(loadAudit(), key), fb: false };
  /** @param {(a: AuditData) => AuditData} fn */
  const commit = fn => {
    const a = fn(loadAudit());
    saveAudit(a); setSt({ key, e: auditGet(a, key), fb: false });
  };
  /** @param {'keep' | 'trash'} m */
  const toggle = m => commit(a => auditToggle(a, key, m));
  /** @param {string} n */
  const setNotes = n => commit(a => auditNotes(a, key, n));
  /** @param {boolean} on */
  const setFb = on => setSt(Object.assign({}, cur, { fb: on }));
  return { e: cur.e, fb: cur.fb, setFb, toggle, setNotes };
}
/** @typedef {ReturnType<typeof useAudit>} AuditState */

// The pin (keep) and trash (remove) toggles in a card's head; only on cards you can tap (not `ingame`),
// and only in dev mode (ui/devmode.js), like Give Feedback
/** @param {{ au: AuditState }} props */
function AuditMarks({ au }) {
  const b = (/** @type {'keep' | 'trash'} */ m, /** @type {string} */ icon, /** @type {string} */ label) =>
    h('button', { className: 'aumark ' + m + (au.e.mark === m ? ' on' : ''), 'data-audit': m, 'aria-label': label,
      'aria-pressed': au.e.mark === m, onPointerDown: e => { e.preventDefault(); e.stopPropagation(); au.toggle(m); } }, icon);
  return h('div', { className: 'aumarks' }, b('keep', '📌', 'Pin: keep'), b('trash', '🗑️', 'Trash: remove'));
}

// "Give Feedback" under the card, with a one-line peek at the saved notes
/** @param {{ au: AuditState }} props */
function AuditFoot({ au }) {
  const n = au.e.notes.trim();
  return h('div', { className: 'aufoot' },
    h('button', { className: 'aufb', onPointerDown: e => { e.preventDefault(); e.stopPropagation(); au.setFb(true); } },
      n ? 'Edit feedback' : 'Give Feedback'),
    n ? h('span', { className: 'aupeek' }, n) : null);
}

// The card turned into a text screen: the notes so far in a box near the top (so a phone keyboard
// leaves Save in view), Save and Cancel
/** @param {{ au: AuditState, name: string, glyph: string, col: string, cls: string }} props */
function AuditText({ au, name, glyph, col, cls }) {
  const [t, setT] = useState(au.e.notes);
  return h('div', { className: 'pop scroll aufbpop' + cls },
    h('div', { className: 'phead' },
      h('div', { className: 'pglyph', style: { borderColor: col, color: col } }, glyph),
      h('div', { className: 'ptitle' }, h('b', null, name), h('span', null, 'Feedback · your notes'))),
    h('textarea', { className: 'autext', value: t, autoFocus: true, placeholder: 'What should change about it?',
      onChange: e => setT(e.target.value) }),
    h('div', { className: 'aubtns' },
      h('button', { className: 'aucancel', onPointerDown: e => { e.preventDefault(); au.setFb(false); } }, 'Cancel'),
      h('button', { className: 'ausave', onPointerDown: e => { e.preventDefault(); au.setNotes(t); } }, 'Save')));
}

// A Discriminate copy's target, as a little icon in the corner of its tile (Bag, gun slots, cards)
/** @param {string | null | undefined} id */
export const tgtBadge = id => id && MODS[id] && MODS[id].tgt ? h('span', { className: 'ttgt' }, targetIcon(MODS[id].tgt)) : null;

/** @param {{ id: string, onClose?: () => void, ingame?: boolean, top?: boolean, flow?: boolean, act?: { label: string, run: () => void } | null }} props */
export function ModCard({ id, onClose, ingame, top, flow, act }) {
  const m = MODS[id];
  const au = useAudit('mod:' + id);
  const kind = famOf(id).name + (m.kind === 'passive' ? ' \u00b7 always on' : '');
  const rows = modPreview(id).rows;
  // the examples' mods: the Bag's square tiles too (v0.0.144, owner)
  const dtile = (did, key, faded) => h('div', {
      key, className: 'tile' + (faded ? ' off' : '') + (MODS[did].kind === 'shot' ? ' shot' : ''),
      style: { borderColor: famCol(did), color: famCol(did) } },
    h('span', { className: 'tg' }, MODS[did].glyph), h('span', { className: 'tn' }, MODS[did].name));
  const drow = (ok, tiles, note, key) => h('div', { className: 'drow', key },
    h('span', { className: 'dmark ' + (ok ? 'yes' : 'no') }, ok ? '\u2713' : '\u2717'),
    h('div', null,
      h('div', { className: 'dtiles' }, tiles),
      h('span', { className: 'dnote' }, note)));
  // cast delay is walked in order, so anything that touches it needs explaining
  let timing = null;
  if (m.setDelay !== undefined) {
    timing = 'Sets the gun\u2019s cast delay to ' + m.setDelay + 's the moment it is cast, ' +
      'instead of nudging it like other mods. Anything cast AFTER it adds its own delay back ' +
      'on top, so it only pays off last \u2014 usually at the tail of a multicast group, where ' +
      'it fires alongside your real shot and leaves the gun ready immediately.';
  } else if (m.d) {
    timing = (m.d < 0 ? 'Takes ' + Math.abs(m.d) : 'Adds ' + m.d) + 's ' +
      (m.d < 0 ? 'off' : 'to') + ' the cast delay of the pull it is drawn in. ' +
      'Cast delay is the gap between shots; a mod that zeroes it outright (Buzzsaw) ' +
      'wipes this out if it comes after.';
  } else if (m.rech || m.rechMul) {
    timing = 'Recharge is the pause once the gun reaches the end of its list. This counts ' +
      'from any slot, so position does not matter for it.';
  }

  let demo;
  if (m.setDelay !== undefined) {
    demo = [drow(true, [dtile('double', 'a'), dtile('bolt', 'b'), dtile(id, 'c')],
              'the bolt fires, then this wipes the delay \u2014 shoot again at once', 1),
            drow(false, [dtile(id, 'd'), dtile('bolt', 'e', true)],
              'the bolt adds its delay back after the reset', 2)];
  } else if (m.kind === 'passive') {
    demo = [drow(true, [dtile(id, 'a'), dtile('bolt', 'b')], 'counts wherever you put it', 1),
            drow(true, [dtile('bolt', 'c'), dtile(id, 'd')], 'same here — order does not matter', 2)];
  } else if (m.kind === 'shot') {
    demo = [drow(true, [dtile('dmg_up', 'a'), dtile(id, 'b')], 'modifiers go to its left', 1),
            drow(false, [dtile(id, 'c'), dtile('dmg_up', 'd', true)], 'a modifier here comes too late', 2)];
  } else if (m.kind === 'static') {
    demo = [drow(true, [dtile('dmg_up', 'a'), dtile(id, 'b')],
              'modifiers to its left still count', 1),
            drow(true, [dtile('double', 'c'), dtile(id, 'd'), dtile('bolt', 'e')],
              'it takes a cast slot like any shot does', 2)];
  } else if (m.copy === 'mods') {
    demo = [drow(true, [dtile(id, 'a'), dtile('bolt', 'b'), dtile('heavy', 'c')],
              'the heavy shot counts even though it sits after the bolt', 1),
            drow(true, [dtile('heavy', 'd'), dtile(id, 'e'), dtile('bolt', 'f')],
              'and here too \u2014 Mu does not care where they are', 2)];
  } else if (m.copy) {
    demo = [drow(true, [dtile('bolt', 'a'), dtile(id, 'b')],
              'it copies off the gun, so give it something to copy', 1),
            drow(false, [dtile(id, 'c'), dtile('bolt', 'd', true)],
              'first in an empty gun, there is nothing to copy yet', 2)];
  } else if (m.myriad) {
    demo = [drow(true, [dtile(id, 'a'), dtile('bolt', 'b'), dtile('bolt', 'c'), dtile('slug', 'd')],
              'all three fire together on one pull', 1),
            drow(false, [dtile('bolt', 'e'), dtile(id, 'f', true)], 'nothing left after it', 2)];
  } else if (m.multi) {
    demo = [drow(true, [dtile(id, 'a'), dtile('bolt', 'b'), dtile('bolt', 'c')],
              'both bolts fire on one pull', 1),
            drow(false, [dtile('bolt', 'd'), dtile(id, 'e', true)], 'nothing after it to gather', 2)];
  } else if (m.kind === 'util' && !m.f) {
    demo = [drow(true, [dtile(id, 'a'), dtile('bolt', 'b')],
              'it fires along with the pull it is drawn in', 1),
            drow(true, [dtile('bolt', 'c'), dtile(id, 'd')], 'same pull, same effect', 2)];
  } else {
    demo = [drow(true, [dtile(id, 'a'), dtile('bolt', 'b')], 'the bolt gets the effect', 1),
            drow(false, [dtile('bolt', 'c'), dtile(id, 'd', true)], 'too late — the bolt already fired', 2)];
  }
  const cls = (ingame ? ' ingame' : '') + (top ? ' top' : '') + (flow ? ' flow' : '');
  if (au.fb && !ingame) return h(AuditText, { au, name: m.name, glyph: m.glyph, col: famCol(id), cls });
  return h('div', { className: 'pop scroll' + cls },
    h('div', { className: 'phead' },
      h('div', { className: 'pglyph', style: { borderColor: famCol(id), color: famCol(id) } }, m.glyph, tgtBadge(id)),
      h('div', { className: 'ptitle' },
        h('b', null, m.name),
        h('span', null, kind + (m.mana ? ' \u00b7 ' + m.mana + ' mana' : ''))),
      ingame || !devShown() ? null : h(AuditMarks, { au }),
      onClose ? h('button', { className: 'pclose',
        onPointerDown: e => { e.preventDefault(); onClose(); } }, '\u00d7') : null
    ),
    m.info ? h('p', { className: 'pinfo' }, m.info) : null,
    act ? h('button', { className: 'pact', onPointerDown: e => { e.preventDefault(); act.run(); } }, act.label) : null,
    timing ? h('p', { className: 'pnote' }, timing) : null,
    rows.length ? h('div', { className: 'prows' },
      rows.map((r, i) => h('div', { className: 'prow', key: i },
        h('span', null, r[0]), h('b', null, r[1])))) : null,
    // the placement use-example is for the editor, where you're deciding where a mod
    // goes — the shop/pickup preview leaves it off and keeps the card compact.
    ingame ? null : h('div', { className: 'pdemo' }, demo),
    ingame || !devShown() ? null : h(AuditFoot, { au })
  );
}

// The card that comes up standing on a perk altar, so you know what you're taking before
// you take it. A perk is permanent, so this is the only look you get.
/** @param {{ id: string, ingame?: boolean, flow?: boolean, top?: boolean, onClose?: () => void }} props */
export function PerkCard({ id, ingame, flow, top, onClose }) {
  const pk = PERKS[id];
  const au = useAudit('perk:' + id);
  const cls = (ingame ? ' ingame' : '') + (flow ? ' flow' : '') + (top ? ' top' : '');
  if (au.fb && !ingame) return h(AuditText, { au, name: pk.name, glyph: pk.glyph, col: pk.tint, cls });
  return h('div', { className: 'pop scroll' + cls },
    h('div', { className: 'phead' },
      h('div', { className: 'pglyph', style: { borderColor: pk.tint, color: pk.tint } }, pk.glyph),
      h('div', { className: 'ptitle' },
        h('b', { style: { color: pk.tint } }, pk.name),
        h('span', null, 'Perk · counts while fitted to your Exo Suit')),
      ingame || !devShown() ? null : h(AuditMarks, { au }),
      onClose ? h('button', { className: 'pclose',
        onPointerDown: e => { e.preventDefault(); onClose(); } }, '×') : null),
    h('p', { className: 'pinfo' }, pk.info),
    ingame || !devShown() ? null : h(AuditFoot, { au }));
}
