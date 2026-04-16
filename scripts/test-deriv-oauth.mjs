#!/usr/bin/env node
/**
 * Local Deriv OAuth smoke test — two flows:
 *
 * 1) Legacy “third-party” (ai-trader-education-bot style): open
 *      https://oauth.deriv.com/oauth2/authorize?app_id=…&redirect_uri=…
 *    Deriv expects a **numeric legacy application id** in `app_id` (dashboard “App ID” digits).
 *    Set `DERIV_OAUTH_LEGACY_APP_ID=12345` or use **digit-only** `DERIV_APP_ID`.
 *    Callback: `acct1`, `token1`, `cur1`, … (no PKCE).
 *
 * 2) OAuth2 + PKCE: `https://auth.deriv.com/oauth2/auth` + token exchange.
 *    Use for **opaque** OAuth client ids (e.g. `32Zv7y…`). Set `DERIV_OAUTH_CLIENT_ID` or put that
 *    value in `DERIV_APP_ID` when it is not digits-only. Force with `DERIV_OAUTH_FLOW=pkce`.
 *
 * Redirect URI: Deriv docs prefer HTTPS. Defaults:
 *   https://127.0.0.1:<port>/callback   (port 8765)
 * with a short-lived self-signed cert (needs `openssl` on PATH) for direct loopback HTTPS.
 *
 * Register the EXACT redirect URI on your Deriv app (Applications / app settings).
 *
 * Tunnel mode (ngrok, etc.): TLS at tunnel; local listener is HTTP.
 *   export DERIV_OAUTH_REDIRECT_URI=https://YOUR_SUBDOMAIN.ngrok-free.app/callback
 *   export DERIV_OAUTH_SERVER_HTTP=1
 *   export DERIV_OAUTH_LISTEN_PORT=8765
 *
 * Usage:
 *   # Legacy (numeric app id only)
 *   export DERIV_OAUTH_LEGACY_APP_ID=12345
 *   node scripts/test-deriv-oauth.mjs
 *
 *   # PKCE
 *   export DERIV_OAUTH_FLOW=pkce
 *   export DERIV_OAUTH_CLIENT_ID=…
 *   node scripts/test-deriv-oauth.mjs
 *
 * Optional env:
 *   DERIV_OAUTH_PORT / DERIV_OAUTH_LISTEN_PORT
 *   DERIV_OAUTH_REDIRECT_URI
 *   DERIV_OAUTH_SCOPE (PKCE only)
 *   DERIV_OAUTH_LEGACY_APP_ID — numeric id for oauth.deriv.com authorize only
 *   DERIV_OAUTH_APP_ID — optional extra `app_id` on PKCE authorize (legacy API bridge)
 *   DERIV_OAUTH_NO_OPEN=1
 *   DERIV_OAUTH_SERVER_HTTP=1
 *   DERIV_OAUTH_USE_HTTP=1
 *
 * Loads .env from repo root if present (does not print secrets).
 */

import http from "node:http";
import https from "node:https";
import crypto from "node:crypto";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { execSync, spawn } from "node:child_process";
import { dirname, resolve, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadDotEnv() {
  const envPath = resolve(__dirname, "..", ".env");
  try {
    const raw = readFileSync(envPath, "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = val;
    }
  } catch {
    // no .env
  }
}

function generatePkce() {
  const bytes = crypto.randomBytes(64);
  const charset =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  let codeVerifier = "";
  for (let i = 0; i < bytes.length; i++) {
    codeVerifier += charset[bytes[i] % charset.length];
  }
  const hash = crypto.createHash("sha256").update(codeVerifier).digest();
  const codeChallenge = hash.toString("base64url");
  return { codeVerifier, codeChallenge };
}

function buildPkceAuthUrl({
  clientId,
  redirectUri,
  codeChallenge,
  state,
  scope,
  appId,
}) {
  const params = new URLSearchParams();
  params.set("response_type", "code");
  params.set("client_id", clientId);
  params.set("redirect_uri", redirectUri);
  params.set("scope", scope);
  params.set("state", state);
  params.set("code_challenge", codeChallenge);
  params.set("code_challenge_method", "S256");
  if (appId) params.set("app_id", appId);
  return `https://auth.deriv.com/oauth2/auth?${params.toString()}`;
}

/** Same pattern as ai-trader-education-bot `generateOAuthURL` third-party branch. */
function buildLegacyAuthorizeUrl(appId, redirectUri) {
  const params = new URLSearchParams({ app_id: appId });
  if (redirectUri) {
    params.set("redirect_uri", redirectUri.replace(/\/$/, ""));
  }
  return `https://oauth.deriv.com/oauth2/authorize?${params.toString()}`;
}

function parseDerivLegacyAccounts(searchParams) {
  const accounts = [];
  let n = 1;
  while (true) {
    const acct = searchParams.get(`acct${n}`);
    const token = searchParams.get(`token${n}`);
    const cur = searchParams.get(`cur${n}`);
    if (!acct || !token) break;
    accounts.push({
      account: acct,
      token,
      currency: (cur || "usd").toLowerCase(),
    });
    n += 1;
  }
  return accounts;
}

async function exchangeCode(clientId, code, codeVerifier, redirectUri) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    code,
    code_verifier: codeVerifier,
    redirect_uri: redirectUri,
  });
  const res = await fetch("https://auth.deriv.com/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    const err = new Error(`token endpoint HTTP ${res.status}`);
    err.detail = json;
    throw err;
  }
  return json;
}

function openBrowser(url) {
  const platform = process.platform;
  const cmd =
    platform === "darwin"
      ? "open"
      : platform === "win32"
        ? "cmd"
        : "xdg-open";
  const args =
    platform === "win32" ? ["/c", "start", "", url] : [url];
  spawn(cmd, args, { detached: true, stdio: "ignore" }).unref();
}

function maskToken(t) {
  if (!t || typeof t !== "string") return "(none)";
  if (t.length <= 12) return "***";
  return `${t.slice(0, 6)}…${t.slice(-4)} (${t.length} chars)`;
}

function normalizePath(p) {
  if (p.length > 1 && p.endsWith("/")) return p.slice(0, -1);
  return p || "/";
}

/** Strip a trailing slash on the path only (`/callback/` → `/callback`). Deriv allowlists are exact-match. */
function canonicalizeRedirectUri(uri) {
  try {
    const u = new URL(uri);
    if (u.pathname.length > 1 && u.pathname.endsWith("/")) {
      u.pathname = u.pathname.slice(0, -1);
    }
    return u.toString();
  } catch {
    return uri;
  }
}

/** Self-signed TLS for https://127.0.0.1 (browser will warn once). */
function createLoopbackTlsMaterial() {
  const dir = mkdtempSync(join(tmpdir(), "deriv-oauth-"));
  const keyPath = join(dir, "key.pem");
  const certPath = join(dir, "cert.pem");
  try {
    execSync(
      `openssl req -x509 -newkey rsa:2048 -nodes -keyout "${keyPath}" -out "${certPath}" -days 1 -subj "/CN=127.0.0.1"`,
      { stdio: "ignore" },
    );
    const key = readFileSync(keyPath);
    const cert = readFileSync(certPath);
    return { key, cert, dir };
  } catch {
    rmSync(dir, { recursive: true, force: true });
    throw new Error(
      "Could not run openssl to create a local TLS cert. Install OpenSSL, or use tunnel mode " +
        "(DERIV_OAUTH_REDIRECT_URI=https://…& DERIV_OAUTH_SERVER_HTTP=1).",
    );
  }
}

loadDotEnv();

const defaultPort = Number(process.env.DERIV_OAUTH_LISTEN_PORT || process.env.DERIV_OAUTH_PORT || "8765") || 8765;

let redirectUri =
  process.env.DERIV_OAUTH_REDIRECT_URI?.trim() || "";
const forceHttpLoopback = process.env.DERIV_OAUTH_USE_HTTP === "1";

if (!redirectUri) {
  redirectUri = forceHttpLoopback
    ? `http://127.0.0.1:${defaultPort}/callback`
    : `https://127.0.0.1:${defaultPort}/callback`;
}

redirectUri = canonicalizeRedirectUri(redirectUri.trim());

const redirectParsed = new URL(redirectUri);
const callbackPath = normalizePath(redirectParsed.pathname);

const listenPort = Number(
  process.env.DERIV_OAUTH_LISTEN_PORT ||
    redirectParsed.port ||
    defaultPort,
);

const isLoopbackHost =
  redirectParsed.hostname === "127.0.0.1" ||
  redirectParsed.hostname === "localhost";

const serverHttp =
  process.env.DERIV_OAUTH_SERVER_HTTP === "1" ||
  redirectParsed.protocol === "http:";

const useLocalTls =
  redirectParsed.protocol === "https:" &&
  isLoopbackHost &&
  !serverHttp &&
  !forceHttpLoopback;

let tlsDir;
let tlsMaterial;
if (useLocalTls) {
  tlsMaterial = createLoopbackTlsMaterial();
  tlsDir = tlsMaterial.dir;
}

const rawDerivAppId = (process.env.DERIV_APP_ID || "").trim();
const forcePkce = process.env.DERIV_OAUTH_FLOW === "pkce";

/** oauth.deriv.com only accepts a valid numeric legacy app id here — not the opaque OAuth2 client_id. */
function resolveLegacyAuthorizeAppId() {
  const explicit = (process.env.DERIV_OAUTH_LEGACY_APP_ID || "").trim();
  if (explicit) return explicit;
  if (/^\d+$/.test(rawDerivAppId)) return rawDerivAppId;
  return "";
}

const legacyAuthorizeAppId = resolveLegacyAuthorizeAppId();
const useLegacyAuthorize = Boolean(legacyAuthorizeAppId) && !forcePkce;

const pkceClientId =
  process.env.DERIV_OAUTH_CLIENT_ID ||
  process.env.DERIV_CLIENT_ID ||
  rawDerivAppId;
const scope =
  process.env.DERIV_OAUTH_SCOPE || "trade account_manage";
const legacyApiAppId = process.env.DERIV_OAUTH_APP_ID || "";

if (!useLegacyAuthorize) {
  if (!pkceClientId) {
    console.error(
      "Set DERIV_OAUTH_CLIENT_ID or DERIV_CLIENT_ID or DERIV_APP_ID (opaque OAuth client id) for PKCE,\n" +
        "or set DERIV_OAUTH_LEGACY_APP_ID / digit-only DERIV_APP_ID for legacy oauth.deriv.com.",
    );
    process.exit(1);
  }
  if (/^\d+$/.test(String(pkceClientId).trim())) {
    console.warn(
      "\nHint: OAuth client_id is often `app` + numeric id " +
        `(e.g. app${pkceClientId}). Try DERIV_OAUTH_CLIENT_ID=app${pkceClientId}\n`,
    );
  }
}

let codeVerifier = "";
let codeChallenge = "";
let state = "";
let authUrl = "";

if (useLegacyAuthorize) {
  authUrl = buildLegacyAuthorizeUrl(legacyAuthorizeAppId, redirectUri);
} else {
  const pkce = generatePkce();
  codeVerifier = pkce.codeVerifier;
  codeChallenge = pkce.codeChallenge;
  state = crypto.randomBytes(16).toString("hex");
  authUrl = buildPkceAuthUrl({
    clientId: pkceClientId,
    redirectUri,
    codeChallenge,
    state,
    scope,
    appId: legacyApiAppId || undefined,
  });
}

function cleanupTls() {
  if (tlsDir) {
    try {
      rmSync(tlsDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

const requestListener = async (req, res) => {
  const host = req.headers.host || "";
  const url = new URL(req.url || "/", `http://${host}`);

  if (normalizePath(url.pathname) !== callbackPath) {
    res.writeHead(404);
    res.end("not found");
    return;
  }

  const errParam = url.searchParams.get("error");
  const errDesc = url.searchParams.get("error_description");
  if (errParam) {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(
      `<!DOCTYPE html><html><body><h1>OAuth error</h1><pre>${escapeHtml(
        errParam,
      )}\n${escapeHtml(errDesc || "")}</pre></body></html>`,
    );
    console.error("Authorization error:", errParam, errDesc || "");
    cleanupTls();
    server.close();
    process.exit(1);
    return;
  }

  /** Session-style redirect (oauth.deriv.com / some app configs) — not authorization `code`. */
  const sessionAccounts = parseDerivLegacyAccounts(url.searchParams);
  if (sessionAccounts.length > 0) {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(
      "<!DOCTYPE html><html><body><h1>OK</h1><p>You can close this tab.</p></body></html>",
    );

    console.log(
      useLegacyAuthorize
        ? "\n--- Legacy OAuth callback (acct1/token1, masked) ---"
        : "\n--- Callback: acct1/token1 session params (no PKCE code — Deriv returned session-style redirect; masked) ---",
    );
    console.log(
      JSON.stringify(
        sessionAccounts.map((a) => ({
          account: a.account,
          currency: a.currency,
          token: maskToken(a.token),
        })),
        null,
        2,
      ),
    );
    console.log(
      "\nUse these tokens only on your machine; do not commit them. " +
        "For API V2 Bearer flows you may still need the PKCE access_token from auth.deriv.com.",
    );
    cleanupTls();
    server.close();
    return;
  }

  if (useLegacyAuthorize) {
    res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
    res.end(
      `<!DOCTYPE html><html><body><h1>Missing legacy params</h1><p>Expected <code>acct1</code> and <code>token1</code> in the query. Got: <code>${escapeHtml(url.search || "(empty)")}</code></p></body></html>`,
    );
    console.error(
      "Legacy authorize flow expected acct1/token1. Query:",
      url.search || "(empty)",
    );
    cleanupTls();
    server.close();
    process.exit(1);
    return;
  }

  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state");
  if (!code) {
    res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
    res.end(
      `<!DOCTYPE html><html><body><h1>Missing authorization code</h1>` +
        `<p>Query string: <code>${escapeHtml(url.search || "(empty)")}</code></p>` +
        `<p>If you see <code>code=…</code> only <strong>after a #</strong> in the browser address bar, ` +
        `fragments are not sent to this server — use a real app route (Next.js page) as redirect, or ` +
        `ensure Deriv returns <code>code</code> in the query for PKCE.</p>` +
        `<p>If you see <code>acct1</code> / <code>token1</code> instead, this script now handles that above; ` +
        `reload may have dropped params — start login again from <code>node scripts/test-deriv-oauth.mjs</code>.</p>` +
        `</body></html>`,
    );
    console.error(
      "PKCE callback missing `code`. Full URL path+search:",
      url.pathname + (url.search || ""),
    );
    cleanupTls();
    server.close();
    process.exit(1);
    return;
  }
  if (returnedState !== state) {
    res.writeHead(400);
    res.end("state mismatch");
    console.error("CSRF: state mismatch");
    cleanupTls();
    server.close();
    process.exit(1);
    return;
  }

  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(
    "<!DOCTYPE html><html><body><h1>OK</h1><p>You can close this tab.</p></body></html>",
  );

  try {
    const tokenJson = await exchangeCode(
      pkceClientId,
      code,
      codeVerifier,
      redirectUri,
    );
    console.log("\n--- Token response (access_token masked) ---");
    console.log(
      JSON.stringify(
        {
          ...tokenJson,
          access_token: maskToken(tokenJson.access_token),
          refresh_token: tokenJson.refresh_token
            ? maskToken(tokenJson.refresh_token)
            : undefined,
        },
        null,
        2,
      ),
    );
    console.log(
      "\nIf you need the raw access token for API calls, re-run and read it from your own secure storage; avoid committing it.",
    );
  } catch (e) {
    console.error("\nToken exchange failed:", e.message);
    if (e.detail) console.error(JSON.stringify(e.detail, null, 2));
    process.exitCode = 1;
  } finally {
    cleanupTls();
    server.close();
  }
};

const server = useLocalTls
  ? https.createServer(
      { key: tlsMaterial.key, cert: tlsMaterial.cert },
      requestListener,
    )
  : http.createServer(requestListener);

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function printDerivRedirectChecklist() {
  console.log("\n──────── If Deriv says redirect_uri does not match ────────");
  console.log(
    "Per https://developers.deriv.com/docs/intro/oauth/ the authorize redirect_uri must match a pre-registered URL for this OAuth client.",
  );
  if (useLegacyAuthorize) {
    console.log("Legacy flow — app_id:", legacyAuthorizeAppId);
  } else {
    console.log("PKCE flow — register the URL on the app whose client_id is:", pkceClientId);
    console.log(
      "(DERIV_OAUTH_CLIENT_ID overrides DERIV_APP_ID for client_id — both must match the same Deriv app.)",
    );
  }
  console.log("\nPaste this EXACT line into developers.deriv.com → your OAuth app → Redirect URLs:");
  console.log(redirectUri);
  try {
    const bu = new URL(authUrl);
    const sent = bu.searchParams.get("redirect_uri");
    if (sent && sent !== redirectUri) {
      console.log("\nDecoded redirect_uri on the wire:", sent);
    }
  } catch {
    /* ignore */
  }
  console.log(
    "\n• New OAuth app = empty redirect list: add the URL again on the new app.\n" +
      "• ngrok URL changes when you restart ngrok: update Deriv and .env together.\n" +
      "• No trailing slash on path unless you registered one (this script normalizes /callback/).",
  );
}

server.listen(listenPort, "127.0.0.1", () => {
  console.log(
    useLegacyAuthorize
      ? "Deriv OAuth test (legacy authorize — oauth.deriv.com, same idea as education-bot)"
      : "Deriv OAuth test (PKCE — auth.deriv.com)",
  );
  if (useLegacyAuthorize) {
    console.log(
      "Legacy app_id (numeric): %s",
      legacyAuthorizeAppId.length > 6
        ? `${legacyAuthorizeAppId.slice(0, 2)}…${legacyAuthorizeAppId.slice(-2)} (${legacyAuthorizeAppId.length} chars)`
        : legacyAuthorizeAppId,
    );
  } else if (rawDerivAppId && !/^\d+$/.test(rawDerivAppId)) {
    console.log(
      "Opaque DERIV_APP_ID → using PKCE as client_id (oauth.deriv.com needs numeric DERIV_OAUTH_LEGACY_APP_ID).",
    );
  }
  console.log("Listen: 127.0.0.1:%s (%s)", listenPort, useLocalTls ? "HTTPS" : "HTTP");
  console.log("redirect_uri (must match Deriv app settings exactly):", redirectUri);
  printDerivRedirectChecklist();
  if (useLocalTls) {
    console.log(
      "\nUsing a self-signed certificate. Your browser will warn — continue to localhost.",
    );
  }
  if (redirectParsed.protocol === "https:" && serverHttp && isLoopbackHost) {
    console.warn(
      "\nYou have HTTPS redirect_uri but HTTP listener — that only works behind a TLS reverse proxy / tunnel.",
    );
  }
  if (forceHttpLoopback) {
    console.warn(
      "\nDERIV_OAUTH_USE_HTTP=1: Deriv’s docs require HTTPS on redirect URLs. " +
        "If Deriv rejects this, remove USE_HTTP and use the default https://127.0.0.1 callback.",
    );
  }
  console.log("\nAuthorize URL:\n", authUrl);
  if (process.env.DERIV_OAUTH_NO_OPEN === "1") {
    console.log("\n(DERIV_OAUTH_NO_OPEN=1 — open the URL manually.)");
  } else {
    console.log("\nOpening browser…");
    openBrowser(authUrl);
  }
});

server.on("error", (err) => {
  console.error("Server error:", err.message);
  cleanupTls();
  process.exit(1);
});

const maxWaitMs = 5 * 60 * 1000;
setTimeout(() => {
  console.error("Timed out waiting for OAuth callback.");
  cleanupTls();
  server.close();
  process.exit(1);
}, maxWaitMs).unref();
