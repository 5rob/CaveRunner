// The undefined-name check (`node tests/run.js` runs it before the suites). Only one rule,
// no-undef: once the game is split into modules, a forgotten import doesn't fail the
// build, it fails when that line first runs, maybe mid-game on floor 7. This catches it.
const globals = require('globals');

module.exports = [
  {
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        React: 'readonly', ReactDOM: 'readonly',   // the two CDN <script> tags
        VERSION: 'readonly',                        // written into the page by tools/build.js
      },
    },
    linterOptions: { reportUnusedDisableDirectives: 'off' },
    rules: { 'no-undef': 'error' },
  },
];
