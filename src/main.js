// The entry point tools/build.js bundles: mounts App (src/ui/app.js) into the page's #root.
// Everything else lives in the modules under src/ (REFACTOR.md, section 4).
// Inside a Web Worker the same bundle makes levels ahead of time instead (game/levelgen.js).
import { h } from './ui/h.js';
import { Root } from './ui/title.js';
import { levelWorker, setBundle } from './game/levelgen.js';

if (typeof document === 'undefined' || !document.getElementById('root')) {
  if ('importScripts' in globalThis) levelWorker();
} else {
  setBundle(document.currentScript ? document.currentScript.textContent || '' : '');
  ReactDOM.createRoot(document.getElementById('root')).render(h(Root));
}
