// @ts-check
// GunSwap: the chooser that opens when you take a gun off the ground (found or bought).

import { SFX } from '../audio/sfx.js';
import { PICKUP_COOL } from '../core/consts.js';
import { gunColor, resetGun } from '../spells/guns.js';
import { GunCard } from './cards.js';
import { h, useEffect, useState } from './h.js';
import { holdPress } from './hud.js';

// Walked onto a gun: compare it with yours and pick which of your four it replaces, or
// leave it. Mods are taken straight (no screen); guns keep this chooser because a gun goes
// into one of four slots and is worth comparing before you commit.
/** @param {{ input: { current: GameInput }, refresh: () => void, onDone: () => void }} props */
export function GunSwap({ input, refresh, onDone }) {
  const LO = input.current.loadout;
  useEffect(() => { SFX.fx('open'); }, []);
  const found = input.current.found;
  const [base, setBase] = useState(LO.guns[LO.sel] ? LO.sel : LO.guns.findIndex(Boolean));
  const [held, setHeld] = useState(-1);
  if (!found) return null;
  const baseGun = base >= 0 ? LO.guns[base] : null;

  const take = i => {
    const old = LO.guns[i];
    LO.guns[i] = resetGun(found.gun);   // taking a gun never changes which one you hold
    SFX.ui('gun');
    if (old) { found.gun = old; found.old = true; }   // your old gun stays here, no glow: you've had it
    else found.taken = true;
    found.cool = PICKUP_COOL;           // don't reopen the moment you step past it
    input.current.found = null;
    refresh();
    onDone();
  };
  const leave = () => {
    found.cool = PICKUP_COOL;         // same for one you looked at and walked away from
    input.current.found = null; refresh(); onDone();
  };

  // Both guns are on screen at once and split the space between them: the found one
  // above, the slot you are comparing it against below. Each card keeps its head and
  // its mod row pinned, so the mods are never the thing that falls off the bottom.
  return h('div', { className: 'sheet swapsheet' },
    h('div', { className: 'shead' },
      h('h2', null, 'Gun on the ground'),
      h('button', { className: 'done', onPointerDown: e => { e.preventDefault(); leave(); } }, 'Leave it')
    ),
    h(GunCard, { gun: found.gun, label: 'Found', flow: true, split: true, mark: 'found', tapMods: true,
      compare: baseGun,
      compareName: baseGun ? 'slot ' + (base + 1) + ', ' + baseGun.name : '' }),
    baseGun
      ? h(GunCard, { gun: baseGun, label: 'Slot ' + (base + 1) + ' \u00b7 yours', flow: true,
          split: true, mark: 'mine', tapMods: true, compare: found.gun, compareName: found.gun.name })
      : h('p', { className: 'lab mine' }, base >= 0
          ? 'Slot ' + (base + 1) + ' is empty' : 'No guns to compare it with'),
    h('p', { className: 'lab hint' }, 'Hold a slot to swap it \u00b7 tap to compare it'),
    h('div', { className: 'swaprow' },
      LO.guns.map((g, i) => h('button', {
          key: i,
          className: 'gtab' + (g ? '' : ' empty') + (held === i ? ' holding' : '') +
            (base === i ? ' base' : ''),
          onPointerDown: holdPress(
            () => { if (g) setBase(i); },
            () => take(i),
            on => setHeld(on ? i : -1)),
        },
        h('span', { className: 'num' }, i + 1),
        h('span', { className: 'gname', style: g ? { color: gunColor(g) } : null }, g ? g.name : 'Empty slot'),
        h('span', { className: 'gsub' }, g ? g.slots.filter(Boolean).length + '/' + g.cap + ' mods' : 'hold to take')
      ))
    )
  );
}
