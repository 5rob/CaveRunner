// @ts-check
// The buy machine's menu (game/systems/vend.js opens it: input.current.shopOpen = 'levels'): every
// floor's level as a row, what it puts on your debt, what selling it back pays, the reward that's
// yours and how much a kill is worth there (all climbing exponentially: data/levels.js). Floor 1 is
// always for sale; any other once the floor under it has been sold this run (LO.soldTop), the rest
// locked. "Buy on credit" hands the floor back to the game (input.current.buyFloor) and closes.
// Touch, or the right-stick pointer and keys like the other machines (useMenuNav).

import { SFX } from '../audio/sfx.js';
import { goldScale } from '../data/creatures.js';
import { canBuyFloor, lvlBuy, lvlReward, lvlSell, menuFloors } from '../data/levels.js';
import { THEMES } from '../data/themes.js';
import { dueMs } from '../dev/knobs.js';
import { fmtGold } from './hud.js';
import { h, useRef, useState } from './h.js';
import { useMenuNav } from './vendshop.js';

// 64000000000 -> "64,000,000,000"
/** @param {number} n */
const full = n => Math.round(n).toLocaleString('en-US');

// how long a floor's debt runs, said plainly
/** @param {number} floor */
const repayText = floor => {
  const m = Math.round(dueMs(floor) / 60000);
  return m >= 120 ? Math.round(m / 60) + ' hours' : m + ' min';
};

/** @param {{ input: { current: GameInput }, close: () => void }} props */
export function LevelVend({ input, close }) {
  const LO = input.current.loadout, top = LO.soldTop || 0;
  const floors = menuFloors(top);
  const best = Math.min(top + 1, floors[floors.length - 1]);
  const [sel, setSel] = useState(() => {
    const f = input.current.floor || best;
    return canBuyFloor(top, f) ? f : best;
  });
  const [focus, setFocus] = useState('buy');
  const [msg, setMsg] = useState('');
  const root = useRef(null);
  const can = canBuyFloor(top, sel);

  const buy = () => {
    if (!can) { SFX.ui('poor'); setMsg('Sell level ' + (sel - 1) + ' first'); return; }
    input.current.buyFloor = sel;
    close();
  };
  /** @param {string} key */
  const press = key => {
    if (key === 'close') close();
    else if (key === 'buy') buy();
    else if (key.startsWith('f:')) { setSel(Number(key.slice(2))); setMsg(''); SFX.fx('switch'); }
  };
  const ptr = useMenuNav(input, root, focus, setFocus, press);
  /** @param {string} key @param {string} cls */
  const navCls = (key, cls) => cls + (focus === key ? ' navon' : '');
  /** @param {string} key @returns {(e: PointerEvent) => void} */
  const tap = key => e => { e.preventDefault(); setFocus(key); press(key); };

  return h('div', { className: 'vshop lvshop', ref: root, style: { bottom: (input.current.ctlH || 0) + 'px' } },
    ptr,
    h('div', { className: 'vhead' },
      h('b', null, 'Levels'),
      h('span', { className: 'vgold' }, fmtGold(LO.gold), h('i', null, 'g')),
      h('button', { className: navCls('close', 'vclose'), 'data-nav': 'close', onPointerDown: tap('close') }, '×')),
    h('div', { className: 'lvlist scroll' },
      floors.map(f => {
        const open = canBuyFloor(top, f), key = 'f:' + f, T = THEMES[(f - 1) % THEMES.length];
        return h('div', { key: f, 'data-nav': key, 'data-floor': f,
            className: navCls(key, 'lvrow') + (sel === f ? ' sel' : '') + (open ? '' : ' locked'), onPointerDown: tap(key) },
          h('div', { className: 'lvn' }, h('b', null, 'LVL ' + f), h('span', null, T.name)),
          h('div', { className: 'lvnums' },
            h('div', null, h('span', null, 'Debt'), h('em', { className: 'lvdebt' }, full(lvlBuy(f)) + 'g')),
            h('div', null, h('span', null, 'Sells for'), h('em', null, full(lvlSell(f)) + 'g')),
            h('div', null, h('span', null, 'Reward'), h('em', { className: 'lvgain' }, '+' + full(lvlReward(f)) + 'g'),
              h('span', null, 'Kills'), h('em', { className: 'lvgain' }, '×' + goldScale(f).toFixed(2)))),
          h('div', { className: 'lvtag' }, f <= top ? h('i', { className: 'lvsold' }, '✓ sold') : null,
            open ? null : h('i', { className: 'lvlock' }, '🔒')));
      })),
    h('div', { className: 'lvsum' },
      msg ? h('div', { className: 'vmsg' }, msg)
        : h('p', { className: 'vhint lvhint' }, can
          ? 'Repay within ' + repayText(sel) + ', or it is repossessed. Sell it back once nothing biological is left.'
          : 'Locked: sell level ' + (sel - 1) + ' first to buy level ' + sel + ' on credit.'),
      h('button', { className: navCls('buy', 'vbuy') + (can ? '' : ' cant'), 'data-nav': 'buy', onPointerDown: tap('buy') },
        h('b', null, 'Buy LVL ' + sel + ' on credit'), h('span', null, full(lvlBuy(sel)) + 'g'))));
}
