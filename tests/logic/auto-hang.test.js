// CaveRunner Auto: the hand-steered player hangs on vines and web lines as the old game's player does (auto/hang.js,
// art/titlescene.js ctlStep): no jet and in his hands, he hangs on (and the tank refills); the stick climbs him down a
// vine; not pushed across he swings about its root, settling; on a web line the stick runs him along it, and a push
// across it lets go. The autopilot never grabs. In a sandbox: the flat start pad, the cave's own plants and webs cleared,
// one vine and one web line placed exactly.
const G = require('../load');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
const D = G.DEV;
Object.assign(D, { autoFoeDmg: 0, autoWallMin: 0, autoWallMax: 0 });

const sandbox = () => {
  const S = G.levelScene(200, 3, 2, undefined, G.newRun(3).players.slice(0, 2));   // (a team: the tank is on)
  S.lvl.step = null; S.pace = 0; S.spawn = 1e9;
  S.props.length = 0; S.webs.length = 0; S.foes.length = 0; S.still = false;
  for (const r of S.runners) r.hide = false;
  return S;
};
const stick = (nx, ny, mag = 1) => ({ active: true, nx, ny, mag });
const REST = { active: false, nx: 0, ny: 0, mag: 0 };
const steps = (S, s, f) => { for (let i = 0; i < Math.round(s * 60); i++) { G.titleStep(S, 1 / 60); if (f) f(i); } };
const wx = (S, r) => r.x + G.PW / 2 + S.scroll;

// ---- a vine ----
{
  const S = sandbox();
  const r = S.runners[0], o = S.runners[1];
  r.x = 120; r.y -= 70; r.vy = 0; r.ground = false; r.mode = 'fly';
  const vine = { k: 'climb', st: 'vine', ox: wx(S, r), x: 0, y: r.y - 40, len: 110, seed: 0.3, side: 1, burn: 0, ac: 0, ar: 0 };
  S.props.push(vine);
  G.levelControl(S, r.id, stick(0, 1, 0.5));      // a light push down: no jet
  steps(S, 0.1);
  check('in his hands, no jet: he hangs on', r.hang === vine, r.hang && r.hang.st);
  G.levelControl(S, r.id, REST);
  const y0 = r.y;
  steps(S, 1);
  check('the stick let go: he still hangs there (not falling, not back on the autopilot)', r.hang === vine && Math.abs(r.y - y0) < 2 && G.ctlOn(r), [y0, r.y]);
  G.levelControl(S, r.id, stick(0, 1));
  const y1 = r.y;
  steps(S, 0.4);
  check('pushed down: he climbs down the vine', r.hang === vine && r.y > y1 + 10, [y1, r.y]);
  G.levelControl(S, r.id, REST);
  steps(S, 0.3);
  // the tank refills hanging on
  r.fuel = 0.3; r.empty = false;
  steps(S, 1);
  check('hanging, the jet refills (as on the ground)', r.fuel > 0.4 && r.hang === vine, r.fuel);
  // a swing: a shove sideways, the stick at rest
  r.cvx = 60;
  let lo = 0, hi = 0, swung = false;
  const root = vine.ox;
  steps(S, 2, () => { const d = wx(S, r) - root; lo = Math.min(lo, d); hi = Math.max(hi, d); swung = swung || Math.abs(vine.sw || 0) > 0.05; });
  check('shoved, he swings about the vine\'s root, both ways', r.hang === vine && lo < -1 && hi > 1 && r.swing === 1, [lo, hi]);
  check('… and the vine swings with him (hangs through his hands)', swung, vine.sw);
  steps(S, 5);
  check('… settling under it', r.hang === vine && Math.abs(wx(S, r) - root) < 1.5 && Math.abs(r.cvx) < 5, [wx(S, r) - root, r.cvx]);
  // jetting: he lets go
  G.levelControl(S, r.id, stick(0, -1));
  steps(S, 0.3);
  check('jetting up: he lets go of it', !r.hang && r.y < y1, [r.y, y1]);
  // the autopilot never grabs: the other one parked over the vine, not steered
  G.levelControl(S, r.id, REST);
  o.x = vine.ox - S.scroll - G.PW / 2; o.y = vine.y + 30;
  G.titleStep(S, 1 / 60);
  check('the autopilot never grabs', !o.hang);
}

// ---- a web line ----
{
  const S = sandbox();
  const r = S.runners[0];
  r.x = 120; r.y -= 70; r.vy = 0; r.ground = false; r.mode = 'fly';
  const cx = wx(S, r), ly = r.y + 3;
  const L = { ax: cx - 60, ay: ly, bx: cx + 60, by: ly, a0x: cx - 60, a0y: ly, b0x: cx + 60, b0y: ly, ain: { x: cx - 60, y: ly }, bin: { x: cx + 60, y: ly }, owner: null, sag: 0 };
  S.webs.push(L);
  const h = G.hangFind(S.props, S.webs, cx, r.y, false);
  check('touching a web line slows him (webSlow)', h.web === L && h.webMul < 1, h.webMul);
  G.levelControl(S, r.id, stick(1, 0, 0.6));
  steps(S, 0.1);
  check('on a web line, no jet: he hangs on it', r.hang === L);
  const x0 = wx(S, r);
  steps(S, 0.6);
  const q = G.webNearU(L, wx(S, r), r.y + G.WEB_HAND);
  check('pushed along it: he runs along the line, hands on it', r.hang === L && wx(S, r) > x0 + 8 && Math.abs(q.y - (r.y + G.WEB_HAND)) < 3, [x0, wx(S, r), q.y, r.y]);
  G.levelControl(S, r.id, REST);
  steps(S, 0.5);
  const yh = r.y;
  check('the stick let go: he hangs on the line', r.hang === L && Math.abs(r.y - yh) < 2);
  G.levelControl(S, r.id, stick(0, 1));
  steps(S, 0.1);
  check('pushed across it (down): he lets go, and can\'t grab again for a moment', !r.hang && r.hangGo > 0, r.hangGo);
  steps(S, 0.3);
  check('… and drops off it', r.y > yh + 8, [yh, r.y]);
  check('lineLetGo: across lets go, along does not, past an end does', G.lineLetGo(0, 1, 1, 1, 0, false, false) && !G.lineLetGo(1, 0, 1, 1, 0, false, false) && G.lineLetGo(1, 0, 1, 1, 0, false, true));
}

console.log(fails ? `${fails} FAILED` : 'all passed');
process.exit(fails ? 1 : 0);
