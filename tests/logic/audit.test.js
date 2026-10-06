// The owner's audit (save/audit.js): pin/trash marks exclude each other, notes stick, junk is dropped,
// and auditText makes the Markdown "Copy audit" puts on the clipboard.
const { cleanAudit, auditToggle, auditNotes, auditGet, auditText, MODS, PERKS } = require('../load');

let pass = 0, fail = 0;
const check = (name, ok, got) => {
  ok ? pass++ : fail++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ' -> ' + JSON.stringify(got)}`);
};

check('junk is an empty audit', JSON.stringify(cleanAudit('x')) === '{}' && JSON.stringify(cleanAudit(null)) === '{}');
check('bad keys and marks dropped', JSON.stringify(cleanAudit({ 'foo:x': { mark: 'keep' }, 'mod:bolt': { mark: 'zap', notes: 3 } })) === '{}');

const mod = Object.keys(MODS)[0], perk = Object.keys(PERKS)[0];
const other = Object.keys(MODS)[1];
let a = auditToggle({}, 'mod:' + mod, 'keep');
check('pin sets keep', auditGet(a, 'mod:' + mod).mark === 'keep', a);
a = auditToggle(a, 'mod:' + mod, 'trash');
check('trash clears the pin', auditGet(a, 'mod:' + mod).mark === 'trash', a);
a = auditToggle(a, 'mod:' + mod, 'trash');
check('tapping trash again clears it (and the entry)', !a['mod:' + mod], a);

a = auditNotes(a, 'perk:' + perk, 'too strong\nmaybe halve it');
a = auditToggle(a, 'perk:' + perk, 'keep');
check('a mark keeps the notes', auditGet(a, 'perk:' + perk).notes === 'too strong\nmaybe halve it', a);
a = auditToggle(a, 'mod:' + mod, 'trash');
a = auditNotes(a, 'mod:' + other, 'needs a sound');
check('empty notes and no mark: no entry', !auditNotes(a, 'mod:homing', '   ')['mod:homing']);

const t = auditText(a);
console.log(t);
check('header line', t.startsWith('CaveRunner audit — work through these one at a time; ask me before deleting anything'));
check('sections in order', t.indexOf('## Remove (trash)') < t.indexOf('## Keep (pinned)') && t.indexOf('## Keep (pinned)') < t.indexOf('## Notes'), t);
check('a trash line with name and id', t.includes('- [mod] ' + MODS[mod].name + ' (`' + mod + '`)'), t);
check('a perk line with its notes on one line', t.includes('- [perk] ' + PERKS[perk].name + ' (`' + perk + '`) — too strong / maybe halve it'), t);
check('notes-only item under Notes', t.split('## Notes')[1].includes('(`' + other + '`) — needs a sound'), t);
const onlyNotes = auditText({ 'mod:bolt': { mark: null, notes: 'hi' } });
check('empty sections skipped', !onlyNotes.includes('Remove') && !onlyNotes.includes('Keep') && onlyNotes.includes('## Notes'), onlyNotes);
check('nothing audited: empty text', auditText({}) === '');
check('a removed item still lists by id', auditText({ 'mod:gone_x': { mark: 'trash', notes: '' } }).includes('(`gone_x`)'));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
