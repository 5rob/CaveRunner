// The entry point tools/build.js bundles: mounts App (src/ui/app.js) into the page's #root.
// Everything else lives in the modules under src/ (REFACTOR.md, section 4).
import { h } from './ui/h.js';
import { App } from './ui/app.js';

ReactDOM.createRoot(document.getElementById('root')).render(h(App));
