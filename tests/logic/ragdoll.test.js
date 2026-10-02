// The corpse's ragdoll (world/ragdoll.js): it falls and slumps on a floor, a shove throws it,
// a wall stops it, the sticks hold it together, it goes to sleep, and a blast wakes it.
const R = require('../load');

let pass = 0, fail = 0;
const check = (name, ok, got) => {
  ok ? pass++ : fail++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ' -> ' + JSON.stringify(got)}`);
};
let seed = 1;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const FLOOR = 100, WALL = 260;
const solid = (x, y) => y >= FLOOR || x >= WALL || x < 0;
const run = (rag, secs) => { for (let i = 0; i < secs * 60; i++) R.ragStep(rag, 1 / 60, solid); };
const stretch = rag => Math.max(...R.RAG_STICKS.slice(0, 8).map(([a, b], k) =>
  Math.abs(Math.hypot(rag.joints[a].x - rag.joints[b].x, rag.joints[a].y - rag.joints[b].y) / rag.len[k] - 1)));

// standing still on the floor: it crumples
const a = R.ragNew(100, FLOOR - 22, 12, 1, 0, 0, rnd);
check('starts in the sprite pose (head up top)', a.joints[0].y < a.joints[2].y && a.joints[2].y < a.joints[4].y);
run(a, 3);
const ys = a.joints.map(j => j.y);
check('nothing sinks into the floor', Math.max(...ys) < FLOOR, Math.max(...ys));
check('the head ends up near the floor (it fell over)', a.joints[0].y > FLOOR - 9, a.joints[0].y);
check('it holds together (sticks within 25%)', stretch(a) < 0.25, stretch(a));
check('and goes to sleep', a.still, a.rest);

// shoved hard to the right: thrown, but stopped by the wall
seed = 7;
const b = R.ragNew(100, FLOOR - 22, 12, 1, 700, -300, rnd);
run(b, 0.25);
check('a shove throws it', R.ragHip(b).x > 140, R.ragHip(b).x);
run(b, 3);
check('the wall stops it', Math.max(...b.joints.map(j => j.x)) < WALL, Math.max(...b.joints.map(j => j.x)));
check('still in one piece', stretch(b) < 0.3, stretch(b));
check('lands on the floor', Math.max(...b.joints.map(j => j.y)) < FLOOR && R.ragHip(b).y > FLOOR - 12, R.ragHip(b).y);

// a blast wakes it and throws it the other way
run(b, 2);
check('asleep before the blast', b.still);
const hx = R.ragHip(b).x;
R.ragPush(b, hx + 15, FLOOR - 4, 60);
check('a blast wakes it', !b.still);
run(b, 0.3);
check('and throws it away from the blast', R.ragHip(b).x < hx - 10, [hx, R.ragHip(b).x]);

// the replay copies it deep, so a later move doesn't change a snapshot
const c = R.rpClone({ x: 1, rag: a });
a.joints[0].x += 50;
check('a snapshot keeps its own joints', c.rag.joints[0].x !== a.joints[0].x);
const mid = R.rpLerp({ rag: { joints: [{ x: 0, y: 0 }] } }, { rag: { joints: [{ x: 10, y: 4 }] } }, 0.5);
check('and the joints slide between snapshots', mid.rag.joints[0].x === 5 && mid.rag.joints[0].y === 2, mid.rag);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
