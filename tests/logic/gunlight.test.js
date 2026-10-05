// v0.0.145: the gun light's shape (world/vision.js beamLift, beamFan): a cone out along the aim,
// soft at its sides, fading to nothing at its reach; a small round glow round you; and the fan of
// line of sight cut back outside the cone, so the beam uncovers the fog further than the glow does.
const G = require('../load');
const { beamLift, beamFan, beamSide, DEV, DEV_DEFAULTS, HAND_TORCH } = G;
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
for (const k of ['beamDeg', 'beamReach', 'beamNear', 'beamGlow']) DEV[k] = DEV_DEFAULTS[k];
DEV.beamDeg = 50;
check('the hand torch is archived', HAND_TORCH === false);
const R = 250, N = 60;
// aiming right (a = 0)
check('straight ahead, half way out: fully lit', beamLift(100, 1, 0, 0, R, N) === 1);
check('straight ahead, near the end: fading', beamLift(220, 1, 0, 0, R, N) > 0 && beamLift(220, 1, 0, 0, R, N) < 1);
check('straight ahead, past the reach: dark', beamLift(260, 1, 0, 0, R, N) === 0);
check('behind you, as far: dark', beamLift(100, -1, 0, 0, R, N) === 0);
check('right beside you, behind: the round glow', beamLift(20, -1, 0, 0, R, N) === 1);
const edge = 25 * Math.PI / 180;
check('just inside the cone: lit', beamLift(100, Math.cos(edge - 0.02), Math.sin(edge - 0.02), 0, R, N) === 1);
const soft = beamLift(100, Math.cos(edge + 0.1), Math.sin(edge + 0.1), 0, R, N);
check('just past its side: soft, not a hard edge', soft > 0 && soft < 1, soft);
check('well past its side: dark', beamLift(100, Math.cos(1), Math.sin(1), 0, R, N) === 0);
check('it turns with the aim (aim up: up lit, right dark)',
  beamLift(100, 0, -1, -Math.PI / 2, R, N) === 1 && beamLift(100, 1, 0, -Math.PI / 2, R, N) === 0);
check('no gun (reach 0): only the round glow', beamLift(100, 1, 0, 0, 0, N) === 0 && beamLift(20, 1, 0, 0, 0, N) === 1 && beamLift(0, 1, 0, 0, 0, N) === 1);
check('the cone across the wrap (aim just under pi)', beamSide(-Math.PI + 0.05, Math.PI - 0.05) === 1);
// the fan: 8 rays all 300 long round (0, 0), aiming right, cut back to 100 outside the cone
const rays = 8, pts = [];
for (let i = 0; i < rays; i++) { const a = i / rays * Math.PI * 2; pts.push(Math.cos(a) * 300, Math.sin(a) * 300); }
beamFan(pts, 0, 0, 100, 0);
const len = i => Math.round(Math.hypot(pts[2 * i], pts[2 * i + 1]));
check('the fan: the ray along the beam keeps its length', len(0) === 300, len(0));
check('the fan: the rest cut back to the glow', [1, 2, 3, 4, 5, 6, 7].every(i => len(i) === 100), pts.map((_, i) => i % 2 ? null : len(i / 2)).filter(v => v !== null));
process.exit(fails ? 1 : 0);
