# CaveRunner Android app

A thin WebView app that installs the game on the phone so you don't need the
artifact link or `serve.js` any more. The game plays **offline**; when you're
online it checks for a newer version on launch, whenever it comes back to the front, and
every two minutes while open, and offers to update — from
anywhere, not just your home WiFi.

## How it fits together

- **Shell** (`android/`) — a tiny WebView app, installed once as an APK. It
  bundles the game and React so first launch works with no network.
- **Update source** — GitHub Pages serves `index.html` + `version.txt`. The app
  compares `version.txt` to what it has and, if newer, downloads the new
  `index.html`, rewrites the two React `<script>` tags to the bundled local
  copies, saves it, and reloads. No APK reinstall for game updates.
- **CI** (`.github/workflows/android.yml`) — GitHub builds the APK and publishes
  Pages. Nothing is built on your PC.

Your canonical `index.html` is never modified — the CDN React tags stay, so the
artifact, LAN and the Pages browser version all keep working. Only the *bundled*
and *downloaded* copies get the local-React rewrite.

## One-time setup (in the GitHub repo settings)

1. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
2. **Settings → Actions → General → Workflow permissions: Read and write.**
   (Lets CI publish the Release and commit the debug keystore once.)
3. Push these files to `main` (or run the workflow manually from the Actions
   tab). The first run creates a stable debug keystore, builds the APK, and
   deploys Pages.

## Install on the phone (once)

- Open **https://github.com/5rob/CaveRunner/releases/tag/app** on the phone and
  download `app-debug.apk`.
- Tap it; Android will ask to allow installs from your browser — allow it, then
  install.

## Releasing an update to the phone

Same as before, but the delivery is Pages instead of the artifact:

1. Edit `src/`, bump `VERSION = 'vX.Y.Z'` in `src/version.js` (the build fills the page; CLAUDE.md
   has the update number the app compares: X × 1,000,000 + Y × 1,000 + Z, in `version.txt` as
   `132 v0.0.132`, which an app from before v0.0.132 reads too).
2. `node tests/run.js`.
3. Push to **`main`**. CI redeploys Pages within a minute.
4. Next time you open the app it says "Update available (v0.0.132)" → **Update** (an APK from
   before v0.0.132 shows "132 v0.0.132": it works the same; reinstalling the APK tidies the label).

Pages URL (also playable in a phone browser):
**https://5rob.github.io/CaveRunner/**

## The second app: CaveRunner Auto (branch `autobattler`)

The same shell, built with `gradle assembleDebug -PcaveAuto=true`: package `com.caverunner.auto` (installs
beside the main app, with its own save), name "CaveRunner Auto", updates from
**https://5rob.github.io/CaveRunner/auto/** (`BuildConfig.PAGES_BASE`, set in `app/build.gradle`). Without the
flag the build is the main app as always. CI passes the flag only on pushes to `autobattler` and publishes the
APK to the release **https://github.com/5rob/CaveRunner/releases/tag/app-auto**. Pages is one site, so every run
deploys both: main's build at the root, the branch's under `auto/` (the workflow checks out both branches; keep
the workflow file the same on both). The `github-pages` environment must allow deploys from `autobattler`
(Settings → Environments → github-pages → Deployment branches).

## Notes

- Updating the **game** never touches the shell. You only reinstall the APK if
  the shell code itself changes (rare; last: v124 added `VideoSaver`, the `window.CaveApp` bridge
  that saves an exported Witness video into Movies/CaveRunner — `videoBegin`, `videoChunk` (base64
  pieces), `videoEnd`; an older shell just says to reinstall). The committed debug keystore means a new
  shell installs in place without losing your saved game.
- Offline / away from a signal: the app just plays the version it has and checks
  again next time it can reach Pages.
