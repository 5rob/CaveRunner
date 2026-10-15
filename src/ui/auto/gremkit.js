// @ts-check
// Dev → Grem (owner, Grem Mode): what Grem Mode's player 1 starts with (auto/grem.js gremKit: exo mods and perks only, kept on
// this device; the next Grem run uses it). Each exo category is a row of its 5 slots: a tap steps a slot empty → I → … → V →
// empty. Each perk slot is a list of the perks. The Grem Mode knobs (prices, when players join) are under it.

import { SFX } from '../../audio/sfx.js';
import { PERKS } from '../../data/perks.js';
import { EXO_CATS } from '../../auto/run.js';
import { EXO_NAMES } from '../../auto/nav.js';
import { GREM_NAME_MAX, gremKitLoad, gremKitSave } from '../../auto/grem.js';
import { TITLE_COLS } from '../../art/titlescene.js';
import { HUB_MACHINES } from '../../auto/hub.js';
import { PixIcon } from './icons.js';
import { h, useState } from '../h.js';

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V'];
// the perks a slot may hold: the named ones (not the exo suit's stat perks), not turned off for Auto
const PERK_IDS = Object.keys(PERKS).filter(id => !PERKS[id].stat && !PERKS[id].off).sort((a, b) => PERKS[a].name.localeCompare(PERKS[b].name));

export function GremKit() {
  const [kit, setKit] = useState(gremKitLoad);
  /** @param {(k: import('../../auto/grem.js').GremKit) => void} fn */
  const change = fn => { const k = JSON.parse(JSON.stringify(kit)); fn(k); gremKitSave(k); setKit(k); };
  return h('div', { className: 'agkit' },
    h('p', { className: 'devnote' }, 'Name tags: shown small over each player’s head in Grem Mode (empty: none).'),
    h('div', { className: 'agknames' }, kit.names.map((n, i) => h('input', { key: i, className: 'agkname', 'data-name': i, value: n, maxLength: GREM_NAME_MAX,
      placeholder: 'Player ' + (i + 1), style: { color: TITLE_COLS[i % TITLE_COLS.length], borderColor: TITLE_COLS[i % TITLE_COLS.length] },
      onChange: e => { const v = String(e.target.value).slice(0, GREM_NAME_MAX); change(k => { k.names[i] = v; }); } }))),
    h('p', { className: 'devnote' }, 'Grem Mode’s player 1 starts with these (the next Grem run). Tap an exo slot to step its tier.'),
    ...EXO_CATS.map(c => h('div', { key: c, className: 'agkrow', 'data-cat': c },
      h('span', { className: 'agklab' }, h(PixIcon, { id: c, size: 18, tint: HUB_MACHINES.exo.hue }), EXO_NAMES[c]),
      ...kit.exo[c].map((t, i) => h('button', { key: i, className: 'agkslot' + (t ? ' on' : ''), 'data-slot': i,
        onPointerDown: e => { e.preventDefault(); SFX.ui('tap'); change(k => { k.exo[c][i] = (t + 1) % 6; }); } }, ROMAN[t] || '·')))),
    h('div', { className: 'agkperks' }, kit.perks.map((id, i) => h('select', { key: i, className: 'agkperk' + (id ? ' on' : ''), value: id || '', 'data-slot': i,
      onChange: e => { const v = e.target.value; change(k => { k.perks[i] = v || null; }); } },
      h('option', { value: '' }, 'Perk ' + (i + 1) + ': none'),
      ...PERK_IDS.map(p => h('option', { key: p, value: p }, PERKS[p].glyph + ' ' + PERKS[p].name))))),
    h('button', { className: 'dbg', onPointerDown: e => { e.preventDefault(); SFX.fx('close'); change(k => { for (const c of EXO_CATS) k.exo[c] = k.exo[c].map(() => 0); k.perks = k.perks.map(() => null); }); } }, 'Clear kit'));
}
