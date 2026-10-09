// The blocked-zone variants on one contact sheet for the owner (strike or keep): the play area of each
// tests/build/autoshots/b-<variant>.png (tools/blockshots.js makes them), labelled, 4 across -> b-sheet.png.
//   node tools/blocksheet.js
const { launch } = require('../tests/chromium');
const path = require('path');
const fs = require('fs');

const DIR = path.join(__dirname, '..', 'tests', 'build', 'autoshots');
const files = fs.readdirSync(DIR).filter(f => /^b-/.test(f) && f !== 'b-sheet.png' && f !== 'b-busy.png').sort();
(async () => {
  const browser = await launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 400 } });
  const cells = files.map(f => `<figure><div style="background-image:url('data:image/png;base64,${fs.readFileSync(path.join(DIR, f)).toString('base64')}')"></div><figcaption>${f.slice(2, -4)}</figcaption></figure>`).join('');
  await page.setContent(`<style>body{margin:0;background:#111;display:grid;grid-template-columns:repeat(4,300px);gap:0;font:600 18px system-ui;color:#eee}
figure{margin:0;padding:4px}div{width:292px;height:340px;background-size:292px auto;background-position:0 -6px;border-radius:6px}
figcaption{text-align:center;padding:2px}</style>${cells}`);
  await page.screenshot({ path: path.join(DIR, 'b-sheet.png'), fullPage: true });
  await browser.close();
  console.log(files.length + ' variants -> b-sheet.png');
})();
