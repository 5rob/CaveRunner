// Save slots and the title scene (LIST4 #3, #4): slotKey keeps slot 1 on the old keys and gives
// slots 2/3 their own, slotSummary reads a run for the title's slot line, and the title's action
// scene (art/titlescene.js) really kills creatures and sprays gold, within its caps.
const { slotKey, slotSummary, SAVE_KEY, COLLECTION_KEY, PERK_COLLECTION_KEY, SLOTS,
  titleScene, titleStep, TITLE_FOES, TITLE_PARTS, TITLE_GOLD } = require('../load');

let pass = 0, fail = 0;
const check = (name, ok, got) => {
  ok ? pass++ : fail++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ' -> ' + JSON.stringify(got)}`);
};

check('three slots', SLOTS === 3);
check('slot 1 keeps the old keys', slotKey(SAVE_KEY, 1) === 'caverunner-save' && slotKey(COLLECTION_KEY, 1) === 'caverunner-collection'
  && slotKey(PERK_COLLECTION_KEY, 1) === 'caverunner-perkcollection');
check('slot 2 and 3 add -2 / -3', slotKey(SAVE_KEY, 2) === 'caverunner-save-2' && slotKey(PERK_COLLECTION_KEY, 3) === 'caverunner-perkcollection-3');
check('a bad slot is slot 1', slotKey(SAVE_KEY, 0) === SAVE_KEY && slotKey(SAVE_KEY, 9) === SAVE_KEY && slotKey(SAVE_KEY, NaN) === SAVE_KEY);

check('no save: empty slot', slotSummary(null) === null && slotSummary('junk') === null && slotSummary('{}') === null);
const run = JSON.stringify({ ver: 'x', floor: 4, hp: 30, loadout: { guns: [{ name: 'Pistol', slots: ['bolt', null] }, null, { name: 'B', slots: [null] }, null],
  sel: 0, bag: ['bolt', 'bolt'], gold: 1234.7 } });
const s = slotSummary(run);
check('summary: floor, gold, guns, mods', s && s.floor === 4 && s.gold === 1234 && s.guns === 2 && s.mods === 3, s);

const S = titleScene(400, 7);
let maxFoes = 0, maxParts = 0, maxGold = 0;
for (let i = 0; i < 60 * 20; i++) {
  titleStep(S, 1 / 60);
  maxFoes = Math.max(maxFoes, S.foes.length); maxParts = Math.max(maxParts, S.parts.length); maxGold = Math.max(maxGold, S.nuggets.length);
}
check('the title scene kills creatures', S.kills >= 10, S.kills);
check('and sprays gold', S.gold >= 40, S.gold);
check('within its caps', maxFoes <= TITLE_FOES && maxParts <= TITLE_PARTS && maxGold <= TITLE_GOLD, { maxFoes, maxParts, maxGold });
check('the runners stay on screen', S.runners.every(r => r.x > -20 && r.x < 240 && r.y > S.top - 40 && r.y < S.bot + 20), S.runners.map(r => [r.x, r.y]));
const A = titleScene(400, 3), B = titleScene(400, 3);
for (let i = 0; i < 300; i++) { titleStep(A, 1 / 60); titleStep(B, 1 / 60); }
check('same seed, same scene', A.kills === B.kills && A.runners[0].x === B.runners[0].x);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
