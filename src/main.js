// The entry point tools/build.js bundles: mounts Root (src/ui/title.js: the title, then CaveRunner Auto) into
// the page's #root. Everything else lives in the modules under src/ (REFACTOR.md, section 4).
// Stage 13 (autobattler branch): the old game (ui/app.js App) and its level worker (game/levelgen.js) are
// unhooked from the build; their files stay (main still uses them).
import { h } from './ui/h.js';
import { Root } from './ui/title.js';

const root = typeof document === 'undefined' ? null : document.getElementById('root');
if (root) ReactDOM.createRoot(root).render(h(Root));
