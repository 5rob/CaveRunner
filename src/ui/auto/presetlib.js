// @ts-check
// Dev → Presets (owner, Grem Mode): the gun presets library (save/presets.js, shared with the old game's Spawn gun). A grid of
// every saved gun in its order, which is the order Grem Mode unlocks them (auto/grem.js); 💾 on a gun's panel in the nav
// (dev mode) adds one. (owner, v1.0.89) The ⠿ handle in a tile's corner drags it onto another tile's place (the order). A tap
// opens the gun editor (PresetEdit): the gun panel (AutoScreen GunPanel: its stats and the firing window simulating it), its
// mod slots (tap one to pick it; tap another to swap them; ✕ empties it), the Dev mod grid (a tap on a mod puts it in the
// picked slot, else the first empty one), its name, ◀ ▶ to move it in the order, 🗑️ (twice) to delete it, and Save changes
// (writes it back; nothing is saved until then). (owner) The editor takes the whole window (over the Dev panel, as the grown
// mod row does): everything down to the slots stays put at the top, the mod grid scrolls under it. (owner, v1.0.89) Drags: a
// slot's mod dragged onto another slot swaps them, dragged onto the mod grid (the editor's bag) throws it away; a mod's grab
// circle in the grid drags a new one onto a slot. 🖼️ opens the gun look gallery (ui/gunart.js GunArtPicker: the gun's `art`).

import { SFX } from '../../audio/sfx.js';
import { MODS } from '../../spells/mods.js';
import { PRESET_NAME_MAX, loadPresets, movePreset, presetGun, removePreset, savePresets, setPreset } from '../../save/presets.js';
import { gremPrice } from '../../auto/grem.js';
import { newPlayer } from '../../auto/run.js';
import { GunIcon } from '../editor.js';
import { GunArtPicker } from '../gunart.js';
import { ModGrid } from '../modgrid.js';
import { GunPanel, ItemIcon, itemEdge } from './AutoScreen.js';
import { h, useRef, useState } from '../h.js';

/** @param {() => void} fn @returns {(e: any) => void} */
const tap = fn => e => { e.preventDefault(); e.stopPropagation(); fn(); };

// A press followed until the finger lifts (window listeners): `move` once it has gone DRAG_PX, `end` with where it lifted
// and whether it moved (no: a tap)
const DRAG_PX = 8;
/** @param {any} e @param {(x: number, y: number) => void} move @param {(x: number, y: number, moved: boolean) => void} end */
function follow(e, move, end) {
  const x0 = e.clientX, y0 = e.clientY;
  let moved = false;
  /** @param {PointerEvent} ev */
  const mv = ev => {
    if (!moved && Math.hypot(ev.clientX - x0, ev.clientY - y0) > DRAG_PX) moved = true;
    if (moved) move(ev.clientX, ev.clientY);
  };
  /** @param {PointerEvent} ev */
  const up = ev => {
    window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
    end(ev.clientX, ev.clientY, moved && ev.type === 'pointerup');
  };
  window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
}
/** the element under a point (the ghost lets it through) @param {number} x @param {number} y @param {string} sel */
const under = (x, y, sel) => { const el = document.elementFromPoint(x, y); return el && el.closest ? el.closest(sel) : null; };

export function PresetLib() {
  const [list, setList] = useState(loadPresets);
  const [open, setOpen] = useState(-1);
  /** @type {[{ i: number, x: number, y: number, over: number } | null, (d: any) => void]} */
  const [drag, setDrag] = useState(null);
  if (open >= 0 && list[open]) {
    return h(PresetEdit, { key: open + '|' + list[open].name, list, i: open, setList, setOpen });
  }
  /** the ⠿ handle pressed: drag tile i @param {any} e @param {number} i */
  const grab = (e, i) => {
    e.preventDefault(); e.stopPropagation();
    /** @param {number} x @param {number} y */
    const at = (x, y) => { const t = under(x, y, '[data-preset]'); return t ? Number(t.getAttribute('data-preset')) : -1; };
    follow(e, (x, y) => setDrag({ i, x, y, over: at(x, y) }), (x, y, moved) => {
      setDrag(null);
      const j = moved ? at(x, y) : -1;
      if (j < 0 || j === i) return;
      const next = movePreset(loadPresets(), i, j - i);
      savePresets(next); setList(next); SFX.ui('tap');
    });
  };
  const dp = drag ? list[drag.i] : null;
  return h('div', { className: 'aplib' },
    h('p', { className: 'devnote' }, 'Your saved guns, in the order Grem Mode unlocks them. Tap one to see it fire and change it; drag ⠿ to move it. 💾 on a gun’s panel (dev mode) saves a new one.'),
    list.length ? h('div', { className: 'apltiles' }, list.map((p, i) => h('button', { key: i,
      className: 'apltile' + (drag && drag.i === i ? ' lift' : '') + (drag && drag.over === i && drag.i !== i ? ' drop' : ''), 'data-preset': i,
      onPointerDown: tap(() => { SFX.fx('open'); setList(loadPresets()); setOpen(i); }) },
      h('i', { className: 'aplnum' }, i + 1),
      h('i', { className: 'aplhandle', onPointerDown: e => grab(e, i) }, '⠿'),
      h('span', { className: 'aplicon' }, h(GunIcon, { gun: p.gun })),
      h('b', { className: 'aplname' }, p.name),
      h('i', { className: 'aplprice' }, gremPrice(i) + 'g'))))
      : h('p', { className: 'prenone' }, 'No presets yet — open a gun in the nav and tap 💾 on its panel.'),
    drag && dp ? h('div', { className: 'apltile aplghost', style: { left: drag.x + 'px', top: drag.y + 'px' } },
      h('span', { className: 'aplicon' }, h(GunIcon, { gun: dp.gun })), h('b', { className: 'aplname' }, dp.name)) : null);
}

/** @param {{ list: GunPreset[], i: number, setList: (l: GunPreset[]) => void, setOpen: (i: number) => void }} props */
function PresetEdit({ list, i, setList, setOpen }) {
  const [draft] = useState(() => presetGun(list[i]));
  const [name, setName] = useState(list[i].name);
  const [v, setV] = useState(0);              // bumped on each change to the draft (its panel restarts)
  const [dirty, setDirty] = useState(false);
  const [pick, setPick] = useState(-1);       // the picked mod slot
  const [asking, setAsking] = useState(false);
  const [flash, setFlash] = useState('');
  const [art, setArt] = useState(false);      // the gun look gallery open
  /** a mod being dragged: from slot `from` (-1: out of the mod grid), under the finger at x, y, over slot `over` (-1 none) */
  /** @type {[{ id: string, from: number, x: number, y: number, over: number, out: boolean } | null, (d: any) => void]} */
  const [drag, setDrag] = useState(null);
  const pl = useRef(newPlayer(0));
  if (!draft) return h('p', { className: 'prenone' }, 'This preset can’t be read.');
  pl.current.guns[0] = draft; pl.current.active = 0;
  const changed = () => { setDirty(true); setV(n => n + 1); };
  /** @param {number} s */
  const slotTap = s => {
    SFX.ui('tap');
    if (pick < 0) { setPick(s); return; }
    if (pick === s) { setPick(-1); return; }
    const a = draft.slots[pick];
    draft.slots[pick] = draft.slots[s]; draft.slots[s] = a;
    setPick(-1); changed();
  };
  /** a mod tapped in the grid: into the picked slot, else the first empty one @param {string} id */
  const put = id => {
    const s = pick >= 0 ? pick : draft.slots.indexOf(null);
    if (s < 0) { setFlash('No empty slot: pick one to replace'); return; }
    draft.slots[s] = id; setPick(-1); changed(); SFX.fx('open');
  };
  /** where a drag is: the slot under it, or over the mod grid (out: throw away) @param {number} x @param {number} y */
  const spot = (x, y) => {
    const t = under(x, y, '[data-eslot]');
    return { over: t ? Number(t.getAttribute('data-eslot')) : -1, out: !t && !!under(x, y, '.apledgrid') };
  };
  /** drag mod `id` from slot `from` (-1: the mod grid); a slot pressed and not moved is a tap @param {any} e @param {string} id @param {number} from */
  const dragMod = (e, id, from) => {
    follow(e, (x, y) => setDrag(Object.assign({ id, from, x, y }, spot(x, y))), (x, y, moved) => {
      setDrag(null);
      if (!moved) { if (from >= 0) slotTap(from); return; }
      const { over, out } = spot(x, y);
      if (over >= 0 && over !== from) {
        if (from >= 0) { draft.slots[from] = draft.slots[over]; draft.slots[over] = id; } else draft.slots[over] = id;
        setPick(-1); changed(); SFX.fx('open');
      } else if (out && from >= 0) { draft.slots[from] = null; setPick(-1); changed(); SFX.fx('close'); }
    });
  };
  const empty = () => { if (pick < 0) return; draft.slots[pick] = null; setPick(-1); changed(); SFX.fx('close'); };
  const save = () => {
    const next = setPreset(loadPresets(), i, name, draft);
    savePresets(next); setList(next); setDirty(false); setFlash('Saved'); SFX.fx('open');
  };
  /** @param {number} d */
  const move = d => {
    const j = Math.max(0, Math.min(list.length - 1, i + d));
    if (j === i) return;
    const next = movePreset(loadPresets(), i, d);
    savePresets(next); setList(next); setOpen(j); SFX.ui('tap');
  };
  const del = () => {
    if (!asking) { setAsking(true); return; }
    const next = removePreset(loadPresets(), i);
    savePresets(next); setList(next); setOpen(-1); SFX.fx('close');
  };
  const sig = 'pre|' + i + '|' + v + '|' + draft.slots.join() + '|' + (draft.art || '');
  /** @type {BagItem | null} */
  const dit = drag ? { kind: 'mod', id: drag.id, n: 1 } : null;
  return ReactDOM.createPortal(h('div', { className: 'apled' + (drag && drag.from >= 0 && drag.out ? ' bin' : '') }, h('div', { className: 'apledtop' },
    h('div', { className: 'apledhead' },
      h('button', { className: 'dbg apledback', onPointerDown: tap(() => { SFX.fx('close'); setOpen(-1); }) }, '‹ Presets'),
      h('b', null, '#' + (i + 1) + ' of ' + list.length),
      h('button', { className: 'dbg apledart', title: 'Gun look', onPointerDown: tap(() => { SFX.fx('open'); setArt(true); }) }, '🖼️'),
      h('button', { className: 'dbg', disabled: i === 0, onPointerDown: tap(() => move(-1)) }, '◀'),
      h('button', { className: 'dbg', disabled: i === list.length - 1, onPointerDown: tap(() => move(1)) }, '▶'),
      h('button', { className: 'dbg apleddel' + (asking ? ' sure' : ''), onPointerDown: tap(del) }, asking ? 'Delete' : '🗑️')),
    h('input', { className: 'devsearch aplname', value: name, maxLength: PRESET_NAME_MAX, placeholder: draft.name,
      onChange: e => { setName(e.target.value); setDirty(true); } }),
    h(GunPanel, { gun: draft, sig, col: '#ffc93a', cls: 'apledpanel', pl: pl.current, gi: 0, noSave: true }),
    h('div', { className: 'apledslots' }, draft.slots.map((id, s) => {
      /** @type {BagItem | null} */
      const it = id && MODS[id] ? { kind: 'mod', id, n: 1 } : null;
      const lifted = drag && drag.from === s, over = drag && drag.over === s && drag.from !== s;
      return h('button', { key: s, className: 'aslot anavs' + (it ? ' full k-mod' : '') + (s === pick ? ' sel' : '') + (lifted ? ' lift' : '') + (over ? ' drop' : ''),
        'data-eslot': s, style: itemEdge(it),
        onPointerDown: e => { e.preventDefault(); e.stopPropagation(); if (id) dragMod(e, id, s); else slotTap(s); } }, it ? h(ItemIcon, { it }) : null);
    })),
    h('div', { className: 'apledbtns' },
      h('button', { className: 'dbg', disabled: pick < 0 || !draft.slots[pick], onPointerDown: tap(empty) }, '✕ Empty slot'),
      h('button', { className: 'dbg apledsave' + (dirty ? ' on' : ''), disabled: !dirty, onPointerDown: tap(save) }, 'Save changes'),
      flash ? h('span', { key: flash + v, className: 'apledflash' }, flash) : null)),
    h('div', { className: 'apledgrid' },
      h(ModGrid, { onMod: put, onTap: put, onDrag: (e, id) => dragMod(e, id, -1),
        note: 'Drag a mod (its middle) onto a slot, or tap one to put it in the picked slot (no slot picked: the first empty one). Drag a slot’s mod onto another slot to swap them, or down here to throw it away.' })),
    drag && dit ? h('div', { className: 'aslot full aghost k-mod', style: Object.assign({ left: drag.x + 'px', top: drag.y + 'px' }, itemEdge(dit)) }, h(ItemIcon, { it: dit })) : null,
    art ? h(GunArtPicker, { gun: draft, onPick: changed, close: () => setArt(false) }) : null), document.body);
}
