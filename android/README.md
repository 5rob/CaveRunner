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

1. Edit `index.html`, bump the version in both places (`<title>` and
   `const VERSION`).
2. `node tests/run.js`.
3. Push to **`main`**. CI redeploys Pages within a minute.
4. Next time you open the app it says "Update available (vNN)" → **Update**.

Pages URL (also playable in a phone browser):
**https://5rob.github.io/CaveRunner/**

## Notes

- Updating the **game** never touches the shell. You only reinstall the APK if
  the shell code itself changes (rare). The committed debug keystore means a new
  shell installs in place without losing your saved game.
- Offline / away from a signal: the app just plays the version it has and checks
  again next time it can reach Pages.
