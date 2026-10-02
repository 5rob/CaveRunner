// The one place to bump the version. Keep the exact shape `VERSION = 'vNN'` (single
// quotes): tools/build.js copies it into the page as a plain, un-bundled
// `<script>const VERSION = 'vNN';</script>` and into the <title>, and CI and the Android
// app find it in index.html with /VERSION\s*=\s*'v(\d+)'/.
export const VERSION = 'v125';
