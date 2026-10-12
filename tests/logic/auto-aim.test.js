// What the players shoot at in a level (owner v1.0.59; art/titlescene.js titleAimPick): far enough to reach the roof of the
// tall level from its floor (DEV.autoAimR), but nothing in the strips DEV.autoAimEdge wide down each side of the screen or
// past them, on the right; on the left a hail mary up to DEV.autoAimLeft past the edge; the boss wherever it is. One player on the floor, one creature placed exactly.
const G = require('../load');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
const D = G.DEV;

const run = G.newRun(3), S = G.levelScene(400, 5, 1, G.levelPlan(5), run.players.slice(0, 1)), r = S.runners[0];
r.x = 110; r.y = S.bot - 30;
/** is a creature at screen (fx, fy) his target? */
const picks = (fx, fy, boss = false) => {
  S.foes.length = 0;
  const f = G.titleFoeAt(S, boss ? G.bossKind('meduusa', 1) : G.enemyFor('meduusa', 1), S.scroll + fx);
  f.x = S.scroll + fx; f.y = f.ty = fy;
  return G.titleAimPick(S, r) === f;
};
check('a creature high overhead, near the roof: his target', picks(130, S.top + 20), [S.top, S.bot]);
check('… in the right-hand side strip: not', !picks(G.TITLE_VW - D.autoAimEdge / 2, S.bot - 40));
check('(hail mary) left of the screen, within autoAimLeft: yes', picks(-D.autoAimLeft / 2, S.bot - 40) && picks(4, S.bot - 40));
check('… further off to the left: not', !picks(-D.autoAimLeft - 10, S.bot - 40));
check('… off the screen: not', !picks(G.TITLE_VW + 30, S.bot - 40));
check('… just inside the right strip: yes', picks(G.TITLE_VW - D.autoAimEdge - 2, S.bot - 40));
check('the boss, even in a side strip: yes', picks(G.TITLE_VW - 4, S.bot - 40, true));
const keep = D.autoAimR; D.autoAimR = 90;
check('with the old short reach, the high one is out of reach', !picks(130, S.top + 20));
D.autoAimR = keep;
console.log(fails ? `${fails} FAILED` : 'all passed');
process.exit(fails ? 1 : 0);
