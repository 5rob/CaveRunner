// The one place to bump the version: major.minor.patch (a major release, a major update, a minor
// update). Keep the exact shape `VERSION = 'vX.Y.Z'` (single quotes): tools/build.js copies it into
// the page as a plain, un-bundled `<script>const VERSION = 'vX.Y.Z';</script>` and into the <title>,
// and works out the app's update number from it, X × 1,000,000 + Y × 1,000 + Z (each part under
// 1000; 0.0.132 is 132), written as `<!-- VERSION = 'v132' -->` near the top of the page: the shape
// the installed app (and CI's version.txt) has always looked for, so an app from before v0.0.132
// still sees every update as a bigger number.
export const VERSION = 'v1.0.32';
