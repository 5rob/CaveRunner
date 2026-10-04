// What the page gives the game as globals, for the type check (tsconfig.json). Not code:
// esbuild never sees this file.
//
// React and ReactDOM are the two CDN <script> tags in src/shell.html (UMD builds, no
// import). Typed loosely on purpose: the game uses createElement and four hooks, and
// @types/react would be a new dependency for that.
declare const React: any;
declare const ReactDOM: any;
// written into the page by tools/build.js as `const VERSION = 'vNN';` (D4, D7)
declare const VERSION: string;
// the old prefixed Web Audio constructor (audio/sfx.js falls back to it on older WebViews)
interface Window { webkitAudioContext?: typeof AudioContext }
// the browser test page's hooks (tests/build.js sets __TEST; src/game/testhook.js makes __lvl)
interface Window { __TEST?: boolean; __TEST_VOID?: boolean; __TEST_INTRO?: boolean; __TEST_EMPTY?: boolean; __lvl?: any; __in?: any }
// the Android app's bridge (android/.../MainActivity.java VideoSaver): an exported Witness video, in
// base64 pieces, into the phone's Movies/CaveRunner. Missing in a browser and in an older app.
interface Window { CaveApp?: { videoBegin(name: string, mime: string): boolean; videoChunk(b64: string): boolean; videoEnd(): string } }
// ffmpeg.wasm's UMD build, loaded from the CDN only if a video has to be converted (ui/clips.js toMp4)
interface Window { FFmpegWASM?: any }
