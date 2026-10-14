// @ts-check
// Dev → Presets (owner, Grem Mode): the gun presets library (save/presets.js, shared with the old game's Spawn gun). A grid of
// every saved gun in its order, which is the order Grem Mode unlocks them (auto/grem.js); 💾 on a gun's panel in the nav
// (dev mode) adds one. A tap opens the gun editor (PresetEdit): the gun panel (AutoScreen GunPanel: its stats and the firing
// window simulating it), its mod slots (tap one to pick it; tap another to swap them; ✕ empties it), the Dev mod grid (a tap
// on a mod puts it in the picked slot, else the first empty one), its name, ◀ ▶ to move it in the order, 🗑️ (twice) to
// delete it, and Save changes (writes it back; nothing is saved until then).

import { SFX } from '../../audio/sfx.js';
import { MODS } from '../../spells/mods.js';
import { PRESET_NAME_MAX, loadPresets, movePreset, presetGun, removePreset, savePresets, setPreset } from '../../save/presets.js';
import { gremPrice } from '../../auto/grem.js';
import { newPlayer } from '../../auto/run.js';
import { GunIcon } from '../editor.js';
import { ModGrid } from '../modgrid.js';
import { GunPanel, ItemIcon, itemEdge } from './AutoScreen.js';
import { h, useRef, useState } from '../h.js';

/** @param {() => void} fn @returns {(e: any) => void} */
const tap = fn => e => { e.preventDefault(); e.stopPropagation(); fn(); };

export function PresetLib() {
  const [list, setList] = useState(loadPresets);
  const [open, setOpen] = useState(-1);
  if (open >= 0 && list[open]) {
    return h(PresetEdit, { key: open + '|' + list[open].name, list, i: open, setList, setOpen });
  }
  return h('div', { className: 'aplib' },
    h('p', { className: 'devnote' }, 'Your saved guns, in the order Grem Mode unlocks them. Tap one to see it fire and change it. 💾 on a gun’s panel (dev mode) saves a new one.'),
    list.length ? h('div', { className: 'apltiles' }, list.map((p, i) => h('button', { key: i, className: 'apltile', 'data-preset': i,
      onPointerDown: tap(() => { SFX.fx('open'); setList(loadPresets()); setOpen(i); }) },
      h('i', { className: 'aplnum' }, i + 1),
      h('span', { className: 'aplicon' }, h(GunIcon, { gun: p.gun })),
      h('b', { className: 'aplname' }, p.name),
      h('i', { className: 'aplprice' }, gremPrice(i) + 'g'))))
      : h('p', { className: 'prenone' }, 'No presets yet — open a gun in the nav and tap 💾 on its panel.'));
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
  const sig = 'pre|' + i + '|' + v + '|' + draft.slots.join();
  return h('div', { className: 'apled' },
    h('div', { className: 'apledhead' },
      h('button', { className: 'dbg apledback', onPointerDown: tap(() => { SFX.fx('close'); setOpen(-1); }) }, '‹ Presets'),
      h('b', null, '#' + (i + 1) + ' of ' + list.length),
      h('button', { className: 'dbg', disabled: i === 0, onPointerDown: tap(() => move(-1)) }, '◀'),
      h('button', { className: 'dbg', disabled: i === list.length - 1, onPointerDown: tap(() => move(1)) }, '▶'),
      h('button', { className: 'dbg apleddel' + (asking ? ' sure' : ''), onPointerDown: tap(del) }, asking ? 'Delete' : '🗑️')),
    h('input', { className: 'devsearch aplname', value: name, maxLength: PRESET_NAME_MAX, placeholder: draft.name,
      onChange: e => { setName(e.target.value); setDirty(true); } }),
    h(GunPanel, { gun: draft, sig, col: '#ffc93a', cls: 'apledpanel', pl: pl.current, gi: 0, noSave: true }),
    h('div', { className: 'apledslots' }, draft.slots.map((id, s) => {
      /** @type {BagItem | null} */
      const it = id && MODS[id] ? { kind: 'mod', id, n: 1 } : null;
      return h('button', { key: s, className: 'aslot' + (it ? ' full k-mod' : '') + (s === pick ? ' sel' : ''), 'data-pslot': s, style: itemEdge(it),
        onPointerDown: tap(() => slotTap(s)) }, it ? h(ItemIcon, { it }) : null);
    })),
    h('div', { className: 'apledbtns' },
      h('button', { className: 'dbg', disabled: pick < 0 || !draft.slots[pick], onPointerDown: tap(empty) }, '✕ Empty slot'),
      h('button', { className: 'dbg apledsave' + (dirty ? ' on' : ''), disabled: !dirty, onPointerDown: tap(save) }, 'Save changes'),
      flash ? h('span', { key: flash + v, className: 'apledflash' }, flash) : null),
    h(ModGrid, { onMod: put, onTap: put, note: 'Tap a slot to pick it (tap another to swap them), then tap a mod to put it there; no slot picked: the first empty one.' }));
}
