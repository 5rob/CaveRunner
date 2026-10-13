// @ts-check
// (owner v1.0.74) The Dev panel's mod grid (CaveRunner Auto): every mod in MODS, grouped by family in its colour, each
// as the bag draws it (GlyphIcon). A tap shows its name and what it does under the grid; held DEV.autoHoldMs it goes
// into the bag (onMod), a flash on the tile. Mods the audit turned off (`off`) are dimmed. For browsing and auditing.

import { DEV } from '../dev/knobs.js';
import { FAMILIES, FAMILY_OF, MODS, famCol } from '../spells/mods.js';
import { GlyphIcon } from './auto/icons.js';
import { h, useRef, useState } from './h.js';

// the mods shown: every plain id (a set Discriminate's 'discrim:…' copies left out), by family, then name
const gridIds = () => {
  const fams = Object.keys(FAMILIES);
  return Object.keys(MODS).filter(id => !id.includes(':'))
    .sort((a, b) => fams.indexOf(FAMILY_OF[a] || 'shots') - fams.indexOf(FAMILY_OF[b] || 'shots') || MODS[a].name.localeCompare(MODS[b].name));
};

/** @param {{ onMod: (id: string) => void }} props */
export function ModGrid({ onMod }) {
  /** @type {[string | null, (v: string | null) => void]} */
  const [pick, setPick] = useState(null);
  /** @type {[string, (v: string | ((g: string) => string)) => void]} */
  const [got, setGot] = useState('');
  /** @type {{ current: { id: string, t: number, done: boolean } | null }} */
  const hold = useRef(null);
  /** @param {any} e @param {string} id */
  const down = (e, id) => {
    e.preventDefault();
    const H = { id, t: 0, done: false };
    hold.current = H;
    H.t = window.setTimeout(() => {
      if (hold.current !== H) return;
      H.done = true; onMod(id); setGot(id); setPick(id);
      window.setTimeout(() => setGot(g => (g === id ? '' : g)), 450);
    }, DEV.autoHoldMs);
  };
  const up = () => {
    const H = hold.current;
    hold.current = null;
    if (!H) return;
    window.clearTimeout(H.t);
    if (!H.done) setPick(H.id);
  };
  const cancel = () => { if (hold.current) window.clearTimeout(hold.current.t); hold.current = null; };
  const m = pick ? MODS[pick] : null;
  return h('div', { className: 'modgrid' },
    h('p', { className: 'devnote' }, 'Tap a mod for what it does; hold it to put one in the bag.'),
    m ? h('div', { className: 'mginfo' },
      h('b', { style: { color: famCol(pick || '') } }, m.name),
      h('span', null, ' · ' + ((FAMILIES[FAMILY_OF[pick || ''] || 'shots'] || FAMILIES.shots).name) + (m.off ? ' · off in Auto' : '') + ' · ' + (m.mana || 0) + ' mana'),
      m.info ? h('p', null, m.info) : null) : null,
    h('div', { className: 'mgtiles' }, gridIds().map(id => {
      const M = MODS[id], col = famCol(id);
      return h('button', { key: id, className: 'mgtile' + (M.off ? ' off' : '') + (id === pick ? ' on' : '') + (id === got ? ' got' : ''), 'data-mod': id,
        style: { borderColor: col }, title: M.name,
        onPointerDown: e => down(e, id), onPointerUp: up, onPointerLeave: cancel, onPointerCancel: cancel, onContextMenu: e => e.preventDefault() },
        h(GlyphIcon, { glyph: M.glyph || '?', col }));
    })));
}
