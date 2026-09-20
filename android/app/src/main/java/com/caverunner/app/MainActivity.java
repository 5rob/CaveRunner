package com.caverunner.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.view.View;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.webkit.WebViewAssetLoader;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * A thin WebView shell for CaveRunner.
 *
 * The game (index.html) is stored locally so it plays with no network. On each
 * launch the app asks GitHub Pages whether a newer version exists; if so it
 * offers to download it, swaps the local copy, and reloads. React is bundled in
 * the APK and the two CDN <script> tags are rewritten to local paths, so the
 * game runs fully offline.
 */
public class MainActivity extends Activity {

    // Where updates come from. Trailing slash required.
    static final String PAGES_BASE = "https://5rob.github.io/CaveRunner/";
    // The stable origin the WebView serves the local game from.
    static final String LOCAL_URL = "https://appassets.androidplatform.net/game/index.html";
    static final String PREFS = "caverunner";

    // The two CDN tags in index.html, and their bundled-local replacements.
    static final String CDN_REACT = "https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js";
    static final String CDN_REACTDOM = "https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js";

    WebView web;
    File webRoot;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        webRoot = new File(getFilesDir(), "web");
        ensureSeeded();

        web = new WebView(this);
        setContentView(web);

        final WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
                .addPathHandler("/game/", new WebViewAssetLoader.InternalStoragePathHandler(this, webRoot))
                .build();

        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return loader.shouldInterceptRequest(request.getUrl());
            }
        });

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);

        immersive();
        web.loadUrl(LOCAL_URL);

        checkForUpdate();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) immersive();
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    void immersive() {
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                        | View.SYSTEM_UI_FLAG_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
    }

    SharedPreferences prefs() {
        return getSharedPreferences(PREFS, MODE_PRIVATE);
    }

    // ---- first-run seeding -------------------------------------------------

    /** Copy the bundled game + React into internal storage the first time. */
    void ensureSeeded() {
        if (!webRoot.exists()) webRoot.mkdirs();
        File idx = new File(webRoot, "index.html");
        if (idx.exists()) return;
        try {
            copyAsset("react.production.min.js");
            copyAsset("react-dom.production.min.js");
            copyAsset("index.html"); // already rewritten to local refs at build time
            prefs().edit().putInt("version", readLocalVersion()).apply();
        } catch (Exception e) {
            // Leave webRoot partial; next launch retries the copy.
        }
    }

    void copyAsset(String name) throws Exception {
        try (InputStream in = getAssets().open(name);
             OutputStream out = new FileOutputStream(new File(webRoot, name))) {
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
        }
    }

    // ---- update flow -------------------------------------------------------

    void checkForUpdate() {
        new Thread(() -> {
            try {
                String remoteRaw = httpGet(PAGES_BASE + "version.txt").trim();
                int remote = verNum(remoteRaw);
                int local = prefs().getInt("version", readLocalVersion());
                int skipped = prefs().getInt("skip", -1);
                if (remote > local && remote != skipped) {
                    runOnUiThread(() -> promptUpdate(remote, remoteRaw));
                }
            } catch (Exception e) {
                // Offline or PC/Pages unreachable — keep the version we have.
            }
        }).start();
    }

    void promptUpdate(int remote, String label) {
        if (isFinishing()) return;
        new AlertDialog.Builder(this)
                .setTitle("Update available")
                .setMessage("A new version (" + label + ") is ready. Download and install it now?")
                .setPositiveButton("Update", (d, w) -> doUpdate(remote))
                .setNegativeButton("Later", (d, w) ->
                        prefs().edit().putInt("skip", remote).apply())
                .show();
    }

    void doUpdate(int remote) {
        Toast.makeText(this, "Downloading update…", Toast.LENGTH_SHORT).show();
        new Thread(() -> {
            try {
                String html = localize(httpGet(PAGES_BASE + "index.html"));
                if (verNum(html) < remote) throw new Exception("version mismatch");
                writeFile(new File(webRoot, "index.html"), html);
                prefs().edit().putInt("version", remote).remove("skip").apply();
                runOnUiThread(() -> {
                    Toast.makeText(this, "Updated. Reloading…", Toast.LENGTH_SHORT).show();
                    web.loadUrl(LOCAL_URL);
                });
            } catch (Exception e) {
                runOnUiThread(() -> Toast.makeText(this,
                        "Update failed: " + e.getMessage(), Toast.LENGTH_LONG).show());
            }
        }).start();
    }

    /** Point the two CDN <script> tags at the locally bundled React files. */
    static String localize(String html) {
        return html
                .replace(CDN_REACT, "react.production.min.js")
                .replace(CDN_REACTDOM, "react-dom.production.min.js");
    }

    int readLocalVersion() {
        try {
            return verNum(new String(readFile(new File(webRoot, "index.html")), StandardCharsets.UTF_8));
        } catch (Exception e) {
            return 0;
        }
    }

    /** Pull the integer out of "v48" or "const VERSION = 'v48';". 0 if none. */
    static int verNum(String s) {
        Matcher m = Pattern.compile("VERSION\\s*=\\s*'v(\\d+)'").matcher(s);
        if (m.find()) return Integer.parseInt(m.group(1));
        m = Pattern.compile("v?(\\d+)").matcher(s);
        if (m.find()) return Integer.parseInt(m.group(1));
        return 0;
    }

    // ---- tiny IO helpers ---------------------------------------------------

    static String httpGet(String url) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setConnectTimeout(8000);
        c.setReadTimeout(15000);
        c.setInstanceFollowRedirects(true);
        c.setRequestProperty("Cache-Control", "no-cache");
        try {
            int code = c.getResponseCode();
            if (code != 200) throw new Exception("HTTP " + code);
            ByteArrayOutputStream bos = new ByteArrayOutputStream();
            try (InputStream in = c.getInputStream()) {
                byte[] buf = new byte[8192];
                int n;
                while ((n = in.read(buf)) > 0) bos.write(buf, 0, n);
            }
            return bos.toString("UTF-8");
        } finally {
            c.disconnect();
        }
    }

    static byte[] readFile(File f) throws Exception {
        ByteArrayOutputStream bos = new ByteArrayOutputStream();
        try (FileInputStream in = new FileInputStream(f)) {
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) > 0) bos.write(buf, 0, n);
        }
        return bos.toByteArray();
    }

    static void writeFile(File f, String content) throws Exception {
        try (FileOutputStream out = new FileOutputStream(f)) {
            out.write(content.getBytes(StandardCharsets.UTF_8));
        }
    }
}
