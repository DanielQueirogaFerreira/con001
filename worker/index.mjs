// Cloudflare Worker: serves the built site behind an email/password gate.
//
// The Worker runs BEFORE static assets, so nothing in web/ is reachable
// without a session. See docs/15-access.md.
//
// Identity is stored so that SSO can be added without reshaping anything: a
// `users` row is the person, an `identities` row is one way of proving you are
// them. Today the only provider is 'password'; adding 'google' or 'oidc' later
// is a new identities row, not a migration of users.

import {
  DUMMY_RECORD, LOGIN_FAILED, SESSION_COOKIE, SESSION_TTL_SECONDS,
  hashToken, isLockedOut, looksLikeEmail, newSessionToken, normaliseEmail,
  readCookie, serializeCookie, verifyPassword,
} from './auth.mjs';

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Cross-Origin-Opener-Policy': 'same-origin',
  // The built pages are self-contained: no external scripts, styles, or fonts.
  // 'unsafe-inline' is required only because reader.html inlines its own script
  // and style; there is no remote origin in this policy at all.
  'Content-Security-Policy':
    "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; " +
    "img-src 'self' data:; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
};

const html = (body, status = 200, headers = {}) =>
  new Response(body, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', ...SECURITY_HEADERS, ...headers },
  });

const clientIp = (request) => request.headers.get('CF-Connecting-IP') ?? 'unknown';

/* ------------------------------------------------------------- login page */

function loginPage({ error = '', email = '' } = {}) {
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  return html(`<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Open Hermeneutics — sign in</title>
<style>
  :root{--bg:#faf8f4;--panel:#fffefb;--ink:#1d1a16;--muted:#6b6459;--line:#e3ddd2;--accent:#7a5c3e;--hot:#a3402f;color-scheme:light}
  @media(prefers-color-scheme:dark){:root{--bg:#16140f;--panel:#1e1b16;--ink:#ece6dc;--muted:#9b9285;--line:#332e26;--accent:#c9a173;--hot:#e08a76;color-scheme:dark}}
  *{box-sizing:border-box}
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:var(--bg);color:var(--ink);
       font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;line-height:1.5;padding:24px}
  .card{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:26px;width:100%;max-width:380px}
  h1{font-family:ui-serif,Georgia,serif;font-size:19px;font-weight:600;margin:0 0 4px}
  p.sub{color:var(--muted);font-size:12.5px;margin:0 0 20px}
  label{display:block;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin:14px 0 5px}
  input{width:100%;font:inherit;font-size:14px;padding:9px 11px;border:1px solid var(--line);border-radius:7px;
        background:var(--bg);color:var(--ink)}
  input:focus{outline:2px solid var(--accent);outline-offset:1px}
  button{width:100%;margin-top:20px;font:inherit;font-size:14px;font-weight:600;padding:10px;border:0;border-radius:7px;
         background:var(--accent);color:var(--panel);cursor:pointer}
  .err{border-left:3px solid var(--hot);color:var(--hot);padding-left:10px;font-size:12.5px;margin:16px 0 0}
  .note{color:var(--muted);font-size:11.5px;border-top:1px dashed var(--line);margin-top:20px;padding-top:12px}
</style></head><body>
<main class="card">
  <h1>Open Hermeneutics</h1>
  <p class="sub">Private alpha. Access is by invitation.</p>
  <form method="POST" action="/login" autocomplete="on">
    <label for="email">Email</label>
    <input id="email" name="email" type="email" required autocomplete="username" value="${esc(email)}" autofocus>
    <label for="password">Password</label>
    <input id="password" name="password" type="password" required autocomplete="current-password" minlength="12">
    <button type="submit">Sign in</button>
    ${error ? `<p class="err">${esc(error)}</p>` : ''}
  </form>
  <p class="note">There is no self-registration. If you need access, ask the project lead to add you.</p>
</main></body></html>`, error ? 401 : 200);
}

/* ------------------------------------------------------------- data layer */

async function findIdentity(env, email) {
  return env.DB.prepare(
    `SELECT u.id AS user_id, u.email, u.status, i.secret
       FROM users u JOIN identities i ON i.user_id = u.id
      WHERE u.email = ?1 AND i.provider = 'password'`
  ).bind(email).first();
}

async function recentFailures(env, email, ip) {
  const since = Date.now() - 15 * 60 * 1000;
  const rows = await env.DB.prepare(
    `SELECT at FROM login_attempts WHERE at > ?1 AND (email = ?2 OR ip = ?3)`
  ).bind(since, email, ip).all();
  return (rows.results ?? []).map((r) => r.at);
}

const recordFailure = (env, email, ip) =>
  env.DB.prepare(`INSERT INTO login_attempts (email, ip, at) VALUES (?1, ?2, ?3)`)
    .bind(email, ip, Date.now()).run();

async function currentUser(env, request) {
  const token = readCookie(request.headers.get('Cookie'), SESSION_COOKIE);
  if (!token) return null;
  const row = await env.DB.prepare(
    `SELECT u.id, u.email, u.display_name, s.expires_at
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ?1`
  ).bind(await hashToken(token)).first();
  if (!row) return null;
  if (row.expires_at < Date.now()) {
    await env.DB.prepare(`DELETE FROM sessions WHERE token_hash = ?1`).bind(await hashToken(token)).run();
    return null;
  }
  return row;
}

/* --------------------------------------------------------------- handlers */

async function handleLogin(request, env) {
  const form = await request.formData();
  const email = normaliseEmail(form.get('email'));
  const password = String(form.get('password') ?? '');
  const ip = clientIp(request);

  if (!looksLikeEmail(email)) return loginPage({ error: LOGIN_FAILED, email: '' });

  if (isLockedOut(await recentFailures(env, email, ip))) {
    // Deliberately distinct from LOGIN_FAILED: the lockout is not a secret, and
    // telling someone to wait is kinder than a third wrong-password message.
    return loginPage({ error: 'Too many attempts. Try again in 15 minutes.' });
  }

  const identity = await findIdentity(env, email);

  // Always run a verification, even with no account, so the response takes the
  // same time either way. Anything cheaper answers "is this address a user?".
  const ok = await verifyPassword(password, identity?.secret ?? DUMMY_RECORD);

  if (!ok || !identity || identity.status !== 'active') {
    await recordFailure(env, email, ip);
    return loginPage({ error: LOGIN_FAILED });
  }

  const token = newSessionToken();
  const expiresAt = Date.now() + SESSION_TTL_SECONDS * 1000;
  await env.DB.prepare(
    `INSERT INTO sessions (token_hash, user_id, created_at, expires_at, ip) VALUES (?1, ?2, ?3, ?4, ?5)`
  ).bind(await hashToken(token), identity.user_id, Date.now(), expiresAt, ip).run();

  // Clear this account's failure history on success, so one bad night does not
  // keep a legitimate user locked out.
  await env.DB.prepare(`DELETE FROM login_attempts WHERE email = ?1`).bind(email).run();

  return new Response(null, {
    status: 303,
    headers: {
      Location: '/',
      'Set-Cookie': serializeCookie(SESSION_COOKIE, token, { maxAge: SESSION_TTL_SECONDS }),
      ...SECURITY_HEADERS,
    },
  });
}

async function handleLogout(request, env) {
  const token = readCookie(request.headers.get('Cookie'), SESSION_COOKIE);
  // Server-side revocation, not just cookie clearing: a copied cookie must die too.
  if (token)
    await env.DB.prepare(`DELETE FROM sessions WHERE token_hash = ?1`).bind(await hashToken(token)).run();
  return new Response(null, {
    status: 303,
    headers: {
      Location: '/login',
      'Set-Cookie': serializeCookie(SESSION_COOKIE, '', { expire: true }),
      ...SECURITY_HEADERS,
    },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/healthz')
      return new Response('ok', { headers: { 'Content-Type': 'text/plain', ...SECURITY_HEADERS } });

    if (url.pathname === '/login')
      return request.method === 'POST' ? handleLogin(request, env) : loginPage();

    if (url.pathname === '/logout' && request.method === 'POST') return handleLogout(request, env);

    const user = await currentUser(env, request);
    if (!user) {
      // No redirect parameter is carried across the login boundary — an
      // attacker-supplied `?next=` is how open redirects get built.
      return new Response(null, { status: 303, headers: { Location: '/login', ...SECURITY_HEADERS } });
    }

    const asset = await env.ASSETS.fetch(request);
    const res = new Response(asset.body, asset);
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.headers.set(k, v);
    // Signed-in pages must never be cached by a shared proxy.
    res.headers.set('Cache-Control', 'private, no-store');
    res.headers.set('X-Signed-In-As', user.email);
    return res;
  },
};
