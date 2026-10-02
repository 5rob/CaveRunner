// @ts-check
// The autosave's Game side (save/save.js reads it back).

import { SAVE_KEY } from '../../save/save.js';

// ---- autosave: the run as it stands, written every couple of seconds and whenever the
// app is put away, so closing it mid-floor loses almost nothing. A dead run is wiped. ----
/** @param {World} W @param {GameCtx} G */
export function saveRun(W, G) {
  if (W.p.dead) return;
  const pk = W.pickups.filter(q => !q.taken && (q.kind === 'mod' || q.kind === 'gun' || q.kind === 'crystal'))
    .map(q => (q.kind === 'mod' ? { kind: 'mod', id: q.id, x: q.x, y: q.y, t: q.t }
      : q.kind === 'crystal' ? { kind: 'crystal', floor: q.floor, x: q.x, y: q.y, t: q.t }
      : { kind: 'gun', gun: q.gun, x: q.x, y: q.y, t: q.t, old: !!q.old }));
  const data = { ver: VERSION, floor: W.floor, hasLvl: W.hasLvl, hp: W.p.hp, loadout: G.input.current.loadout,
    level: { seed: W.levelSeed, owned: W.levelOwned, alive: W.enemies.map(e => e.sid),
      sold: W.stock.map((it, i) => (it.sold ? i : -1)).filter(i => i >= 0),
      heals: (W.stock.find(it => it.kind === 'heal') || { bought: 0 }).bought || 0,
      rooms: W.rooms.map((r, i) => (r.taken ? i : -1)).filter(i => i >= 0),
      pickups: pk,
      // each nest's rats still inside, and the ones out (a rat isn't saved: it goes back in)
      brood: W.enemies.filter(e => e.nest).map(e => [e.sid, e.nest.left + W.enemies.filter(r => r.home === e && !r.dead).length]) } };
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (_) {}
}
