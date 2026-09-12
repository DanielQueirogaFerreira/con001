// Cloudflare Worker: serves the built site behind an email/password gate.
//
// The Worker runs BEFORE static assets, so nothing in web/ is reachable
// without a session. See docs/15-access.md.
//
// Identity is stored so that SSO can be added without reshaping anything: a
// `users` row is the person, an `identities` row is one way of proving you are
// them. Today the only provider is 'password'; adding 'google' or 'oidc' later
// is a new identities row, not a migration of users.

import { compile } from '../tools/prompt-compiler.mjs';
import { BADGE_CSS, BADGE_SCRIPT, badgeHtml } from '../tools/badge.mjs';
import { AREAS_CSS, areasNav } from '../tools/areas.mjs';
import {
  DUMMY_RECORD, LOGIN_FAILED, PASSWORD_MIN, SESSION_COOKIE, SESSION_TTL_SECONDS,
  hashPassword, hashToken, isLockedOut, looksLikeEmail, newSessionToken,
  normaliseCode, normaliseEmail, passwordProblem, readCookie, resetCodeHash, serializeCookie,
  verifyPassword,
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
    // frame-src covers the console's two srcdoc frames, which hold the status
    // page and the reader as separate documents so their stylesheets cannot
    // collide. Still no remote origin anywhere in this policy.
    // connect-src is for the reader fetching /corpus/bible/<BOOK>.json — its own
    // origin, one book at a time. Still no remote origin in this policy.
    // media-src carries generated video back to the page as a blob; img-src
    // data: carries generated stills. Both are produced by this Worker and
    // handed over inline, so no remote origin appears in the policy.
    "img-src 'self' data:; media-src 'self' data: blob:; connect-src 'self'; " +
    "frame-src 'self'; form-action 'self'; " +
    "frame-ancestors 'none'; base-uri 'none'",
};

const html = (body, status = 200, headers = {}) =>
  new Response(body, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', ...SECURITY_HEADERS, ...headers },
  });

const clientIp = (request) => request.headers.get('CF-Connecting-IP') ?? 'unknown';

/* ------------------------------------------------------------------ pages */

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/**
 * A password field with a reveal control.
 *
 * Typing a 25-character generated credential blind, on a phone, is how people
 * end up locked out of an account that was working — and a failed sign-in here
 * costs a lockout slot. The eye is not a convenience; it is the difference
 * between a credential you can check and one you can only hope you typed.
 */
const passwordField = (id, label, { autocomplete = 'current-password', min = false } = {}) => `
    <label for="${id}">${esc(label)}</label>
    <div class="pw">
      <input id="${id}" name="${id}" type="password" required autocomplete="${autocomplete}"${min ? ` minlength="${PASSWORD_MIN}"` : ''}>
      <button type="button" class="reveal" data-for="${id}" aria-controls="${id}"
              aria-pressed="false" aria-label="Show password" title="Show password">${EYE}</button>
    </div>`;

// Two inline SVGs rather than an emoji or a webfont: the CSP names no remote
// origin, and an eye that renders as a box on some phone is worse than none.
const EYE = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M1 10s3.2-5.5 9-5.5S19 10 19 10s-3.2 5.5-9 5.5S1 10 1 10z"/><circle cx="10" cy="10" r="2.6"/></svg>';
const EYE_OFF = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M1 10s3.2-5.5 9-5.5S19 10 19 10s-3.2 5.5-9 5.5S1 10 1 10z"/><circle cx="10" cy="10" r="2.6"/><path d="M3 3l14 14"/></svg>';

const REVEAL_SCRIPT = `
  const EYE_OFF = ${JSON.stringify(EYE_OFF)};
  const EYE_ON = ${JSON.stringify(EYE)};
  for (const b of document.querySelectorAll('.reveal')) {
    b.addEventListener('click', () => {
      const input = document.getElementById(b.dataset.for);
      const showing = input.type === 'text';
      input.type = showing ? 'password' : 'text';
      b.setAttribute('aria-pressed', String(!showing));
      b.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
      b.title = b.getAttribute('aria-label');
      b.innerHTML = showing ? EYE_ON : EYE_OFF;
      // Put the caret back where it was; toggling type moves it to the end.
      const at = input.value.length;
      input.focus();
      input.setSelectionRange(at, at);
    });
  }`;

/**
 * The build this Worker is running, read once from its own assets.
 *
 * A Worker has no build step to inject a version into, and the pages it renders itself —
 * the gate — are exactly the pages someone is looking at when they cannot get in and need
 * to say which build refused them. So it reads the file the build wrote, through the asset
 * binding rather than over HTTP: fetching it over HTTP would mean a gated page asking a
 * gated asset what it is, and being handed a redirect to the login page.
 */
let BUILD = null;
async function buildInfo(env) {
  if (BUILD) return BUILD;
  try {
    const res = await env.ASSETS.fetch(new URL('https://assets.invalid/version.json'));
    BUILD = res.ok ? await res.json() : {};
  } catch {
    BUILD = {};   // a missing version file must never cost anyone a sign-in
  }
  return BUILD;
}

const badge = () => (BUILD && BUILD.short)
  ? badgeHtml({ short: BUILD.short, built: BUILD.built ?? '', area: 'gate' })
  : '';

const shell = (title, body, status = 200) => html(`<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Open Hermeneutics — ${esc(title)}</title>
<style>${PAGE_CSS}${BADGE_CSS}${AREAS_CSS}</style></head><body><main class="card">${body}</main>
${badge()}
<script>${REVEAL_SCRIPT}${BADGE_SCRIPT}</script></body></html>`, status);

const PAGE_CSS = `
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
  .ok{border-left:3px solid var(--accent);color:var(--accent);padding-left:10px;font-size:12.5px;margin:0 0 16px}
  button.ghost{background:none;border:1px solid var(--line);color:var(--ink);font-weight:500;margin-top:0}
  a{color:var(--accent)}
  .note{color:var(--muted);font-size:11.5px;border-top:1px dashed var(--line);margin-top:20px;padding-top:12px}
  .pw{position:relative;display:flex;align-items:center}
  .pw input{padding-right:44px}
  .reveal{position:absolute;right:4px;width:36px;height:36px;margin:0;padding:0;display:grid;place-items:center;
          background:none;border:0;border-radius:6px;color:var(--muted);cursor:pointer}
  .reveal:hover{color:var(--ink)}
  .reveal:focus-visible{outline:2px solid var(--accent);outline-offset:-2px}
  .reveal svg{width:19px;height:19px;fill:none;stroke:currentColor;stroke-width:1.5;
              stroke-linecap:round;stroke-linejoin:round}
  .reveal[aria-pressed="true"]{color:var(--accent)}
`;

function loginPage({ error = '', email = '', notice = '' } = {}) {
  return shell('sign in', `
  <h1>Open Hermeneutics</h1>
  <p class="sub">Private alpha. Access is by invitation.</p>
  ${notice ? `<p class="ok">${esc(notice)}</p>` : ''}
  <form method="POST" action="/login" autocomplete="on">
    <label for="email">Email</label>
    <input id="email" name="email" type="email" required autocomplete="username" value="${esc(email)}" autofocus>
    ${passwordField('password', 'Password', { min: true })}
    <button type="submit">Sign in</button>
    ${error ? `<p class="err">${esc(error)}</p>` : ''}
  </form>
  <p class="note">No self-registration. Lost your password? Ask the project lead for a
    reset code, then <a href="/reset">enter it here</a>.</p>`, error ? 401 : 200);
}

function accountPage(user, { error = '', notice = '', sessions = 1 } = {}) {
  return shell('account', `
  <h1>Account</h1>
  <p class="sub">Signed in as ${esc(user.email)}</p>
  ${notice ? `<p class="ok">${esc(notice)}</p>` : ''}
  ${error ? `<p class="err">${esc(error)}</p>` : ''}
  <form method="POST" action="/account/password" autocomplete="on">
    <input type="hidden" name="username" value="${esc(user.email)}" autocomplete="username">
    ${passwordField('current', 'Current password')}
    ${passwordField('next', 'New password', { autocomplete: 'new-password', min: true })}
    ${passwordField('confirm', 'Confirm new password', { autocomplete: 'new-password', min: true })}
    <button type="submit">Change password</button>
  </form>
  <p class="note">Changing your password signs out every other session. At least
    ${sessions} session${sessions === 1 ? ' is' : 's are'} currently active.</p>
  <form method="POST" action="/account/revoke-all" style="margin-top:14px">
    <button type="submit" class="ghost">Sign out everywhere else</button>
  </form>
  <form method="POST" action="/logout" style="margin-top:10px">
    <button type="submit" class="ghost">Sign out</button>
  </form>
  <div class="note">${areasNav('/account')}</div>`);
}

function resetPage({ error = '', email = '' } = {}) {
  return shell('reset password', `
  <h1>Reset password</h1>
  <p class="sub">Enter the reset code you were given, and choose a new password.</p>
  <form method="POST" action="/reset" autocomplete="on">
    <label for="email">Email</label>
    <input id="email" name="email" type="email" required autocomplete="username" value="${esc(email)}" autofocus>
    <label for="code">Reset code</label>
    <input id="code" name="code" type="text" required autocomplete="one-time-code"
           spellcheck="false" placeholder="XXXXX-XXXXX-XXXXX-XXXXX">
    ${passwordField('next', 'New password', { autocomplete: 'new-password', min: true })}
    ${passwordField('confirm', 'Confirm new password', { autocomplete: 'new-password', min: true })}
    <button type="submit">Set new password</button>
    ${error ? `<p class="err">${esc(error)}</p>` : ''}
  </form>
  <p class="note">Codes are issued by the project lead and delivered out of band. They
    expire in an hour and work once. <a href="/login">Back to sign in</a></p>`, error ? 400 : 200);
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

const countSessions = async (env, userId) =>
  (await env.DB.prepare(`SELECT COUNT(*) AS n FROM sessions WHERE user_id = ?1`).bind(userId).first())?.n ?? 1;

/**
 * The statements that set a password — built, not run, so a caller can commit
 * them in one transaction with whatever else must happen at the same moment.
 *
 * The hashing happens here too, and that ordering is the point: it is the only
 * expensive, throwing step, so it must complete before anything is written.
 */
async function passwordStatements(env, userId, password) {
  const secret = await hashPassword(password);
  return [
    env.DB.prepare(`UPDATE identities SET secret = ?1 WHERE user_id = ?2 AND provider = 'password'`)
      .bind(secret, userId),
    // Every session dies on a password change. If the change is happening because
    // the old one leaked, leaving other sessions alive defeats the whole point.
    env.DB.prepare(`DELETE FROM sessions WHERE user_id = ?1`).bind(userId),
    // Outstanding reset codes die too: a code issued before the change must not
    // still be able to take the account over afterwards.
    env.DB.prepare(`DELETE FROM password_resets WHERE user_id = ?1 AND used_at IS NULL`).bind(userId),
  ];
}

async function setPassword(env, userId, password) {
  await env.DB.batch(await passwordStatements(env, userId, password));
}

async function issueSession(env, userId, ip) {
  const token = newSessionToken();
  await env.DB.prepare(
    `INSERT INTO sessions (token_hash, user_id, created_at, expires_at, ip) VALUES (?1, ?2, ?3, ?4, ?5)`
  ).bind(await hashToken(token), userId, Date.now(), Date.now() + SESSION_TTL_SECONDS * 1000, ip).run();
  return token;
}

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

async function handleChangePassword(request, env, user) {
  const form = await request.formData();
  const current = String(form.get('current') ?? '');
  const next = String(form.get('next') ?? '');
  const confirm = String(form.get('confirm') ?? '');
  const sessions = await countSessions(env, user.id);
  const fail = (error) => accountPage(user, { error, sessions });

  const identity = await findIdentity(env, user.email);
  // Re-authentication. This is also what makes the route CSRF-proof on its own
  // merits: an attacker who can forge the request still cannot supply this.
  if (!identity || !(await verifyPassword(current, identity.secret ?? DUMMY_RECORD)))
    return fail('Current password is incorrect.');

  if (next !== confirm) return fail('The new passwords do not match.');
  const problem = passwordProblem(next, { current });
  if (problem) return fail(problem);

  await setPassword(env, user.id, next);
  const token = await issueSession(env, user.id, clientIp(request));

  // The acting browser gets a NEW token rather than keeping the old one, so the
  // credential in play after the change is not the one that existed before it.
  return new Response(null, {
    status: 303,
    headers: {
      Location: '/account?changed=1',
      'Set-Cookie': serializeCookie(SESSION_COOKIE, token, { maxAge: SESSION_TTL_SECONDS }),
      ...SECURITY_HEADERS,
    },
  });
}

async function handleRevokeAll(request, env, user) {
  await env.DB.prepare(`DELETE FROM sessions WHERE user_id = ?1`).bind(user.id).run();
  const token = await issueSession(env, user.id, clientIp(request));
  return new Response(null, {
    status: 303,
    headers: {
      Location: '/account?revoked=1',
      'Set-Cookie': serializeCookie(SESSION_COOKIE, token, { maxAge: SESSION_TTL_SECONDS }),
      ...SECURITY_HEADERS,
    },
  });
}

/* ---------------------------------------------------------- generation */

/**
 * Answers one question: does this Worker hold a generation credential Google
 * accepts?
 *
 * It exists because the alternative ways of finding out are all worse. The
 * value of a secret cannot be read back, a binding cannot be seen from outside,
 * and the route that uses it needs a browser session — so "is the key working?"
 * could only be answered by a person clicking a button and reporting back.
 *
 * It takes no session, so it needs its own key to the door: a single-use probe
 * token, minted by whoever can write to the database, spent on first use. What
 * it can do with that token is deliberately almost nothing — ask Google whether
 * the two models are reachable with this Worker's credential, and say yes or
 * no. It generates nothing, costs nothing, returns no content, and never echoes
 * the key.
 */
async function handleSelfTest(request, env) {
  const offered = request.headers.get('X-Probe-Token') ?? '';
  if (!offered) return json({ error: 'no-probe-token' }, 401);

  const hash = await hashToken(normaliseCode(offered));
  const row = await env.DB.prepare(
    `SELECT hash, expires_at, used_at FROM probe_tokens WHERE hash = ?1`
  ).bind(hash).first();

  // One message whether the token is unknown, spent or expired.
  if (!row || row.used_at || row.expires_at < Date.now())
    return json({ error: 'probe-token-not-valid' }, 403);

  await env.DB.prepare(`UPDATE probe_tokens SET used_at = ?1 WHERE hash = ?2`)
    .bind(Date.now(), hash).run();

  const key = env.GEMINI_API_KEY;
  if (!key) return json({ credential: false, detail: 'GEMINI_API_KEY is not set on this Worker' }, 200);

  // Metadata only. Asking whether a model exists costs nothing and proves the
  // credential is accepted; generating something to find out would bill the
  // account for a question that did not need an image.
  const reach = async (model) => {
    try {
      const res = await fetch(`${GEMINI}/models/${model}?key=${encodeURIComponent(key)}`);
      const body = await res.json().catch(() => ({}));
      return { model, ok: res.ok, status: res.status, detail: res.ok ? (body.displayName ?? '') : (body?.error?.message ?? '') };
    } catch (e) {
      return { model, ok: false, status: 0, detail: String(e.message ?? e) };
    }
  };

  const [image, video] = await Promise.all([reach(MODELS.image), reach(MODELS.video)]);
  return json({ credential: true, image, video, checked: new Date().toISOString() });
}

// Google's endpoints. The model ids are written down rather than passed in:
// which model rendered a reading is part of the record, not a client's choice.
const GEMINI = 'https://generativelanguage.googleapis.com/v1beta';
const MODELS = {
  image: 'gemini-3-pro-image',        // Nano Banana Pro
  video: 'gemini-omni-flash-preview', // Omni Flash
};

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...SECURITY_HEADERS },
  });

/**
 * Compose an image or a video from a reading of a passage.
 *
 * THE API TAKES NO PROMPT. It takes an anchor and the lenses active on it, and
 * composes the prompt here with the same compiler the reader runs. That is what
 * makes the guardrails real rather than decorative: a corpus that blocks
 * figural depiction blocks it on the server, where a hand-written request
 * cannot route around the UI, and the negatives the policy locks are attached
 * after the caller's words rather than in place of them.
 *
 * It also refuses to merge contending readings, for the same reason the
 * compiler does: an image splitting the difference between two readings
 * represents neither.
 */
async function handleGenerate(request, env, user) {
  const key = env.GEMINI_API_KEY;
  if (!key)
    return json({
      error: 'not-configured',
      detail: 'No generation credential is set on this Worker. Set GEMINI_API_KEY as a Worker secret; ' +
              'until then the Studio compiles payloads but cannot render them.',
    }, 501);

  let req;
  try { req = await request.json(); } catch { return json({ error: 'bad-request' }, 400); }

  const medium = req.medium === 'video' ? 'video' : 'image';
  const result = compile({
    anchor: req.anchor ?? {},
    lenses: Array.isArray(req.lenses) ? req.lenses : [],
    oppositions: Array.isArray(req.oppositions) ? req.oppositions : [],
    policy: req.policy ?? {},
  });

  if (result.decision !== 'compiled')
    return json({ error: result.decision, note: result.note ?? result.reason, blocks: result.blocks ?? [] }, 403);
  if (result.payloads.length !== 1)
    return json({
      error: 'contending',
      note: result.note,
      readings: result.payloads.map((p) => ({ id: p.id, lenses: p.lenses })),
    }, 409);

  const payload = result.payloads[0];
  // The negatives are stated to the model in words, because neither endpoint
  // takes a negative-prompt field. Locked ones are named first.
  const prompt = payload.negative.length
    ? `${payload.positive}\n\nDo not include: ${payload.negative.join('; ')}.`
    : payload.positive;

  const res = medium === 'image'
    ? await renderImage(key, prompt, payload)
    : await startVideo(key, prompt, payload);

  // Provenance travels with the artefact, always: which reading directed it,
  // which model rendered it, and which build composed the prompt.
  return json({
    ...res,
    provenance: {
      anchor: payload.anchor,
      lenses: payload.lenses,
      model: MODELS[medium],
      payload: payload.id,
      locked_negative: payload.locked_negative,
      by: user.email,
      at: new Date().toISOString(),
    },
  }, res.error ? 502 : 200);
}

async function renderImage(key, prompt, payload) {
  const res = await fetch(`${GEMINI}/models/${MODELS.image}:generateContent?key=${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ['IMAGE'],
        imageConfig: { aspectRatio: payload.aspect },
      },
    }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok)
    return { error: 'upstream', status: res.status, detail: body?.error?.message ?? 'the image model refused' };

  const part = (body.candidates?.[0]?.content?.parts ?? []).find((p) => p.inlineData);
  if (!part) return { error: 'no-image', detail: 'the model returned no image part' };

  return {
    medium: 'image',
    mime: part.inlineData.mimeType ?? 'image/png',
    data: part.inlineData.data,
    prompt,
  };
}

// Video is long-running: this starts it and hands back the id the page polls.
async function startVideo(key, prompt, payload) {
  const res = await fetch(`${GEMINI}/interactions?key=${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODELS.video,
      input: prompt,
      response_format: { type: 'video', aspect_ratio: payload.aspect },
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok)
    return { error: 'upstream', status: res.status, detail: body?.error?.message ?? 'the video model refused' };
  return { medium: 'video', interaction: body.id ?? body.name ?? null, status: body.status ?? 'running', prompt };
}

async function pollVideo(env, id) {
  const key = env.GEMINI_API_KEY;
  if (!key) return json({ error: 'not-configured' }, 501);
  const res = await fetch(`${GEMINI}/interactions/${encodeURIComponent(id)}?key=${encodeURIComponent(key)}`);
  const body = await res.json().catch(() => ({}));
  if (!res.ok)
    return json({ error: 'upstream', status: res.status, detail: body?.error?.message ?? '' }, 502);

  // The finished video arrives as a step carrying video content.
  const steps = body.steps ?? [];
  const video = steps.flatMap((st) => st.content ?? []).find((c) => c.type === 'video');
  return json({
    status: body.status ?? 'running',
    video: video ? { uri: video.uri ?? video.url ?? null, mime: video.mime_type ?? 'video/mp4' } : null,
  });
}

// One message for every reset failure. An unknown address, a wrong code, an
// expired code and a spent code are all the same sentence — otherwise the form
// answers "does this person have an account, and is their code still live?".
const RESET_FAILED = 'That reset code is not valid. Ask for a new one.';

async function handleReset(request, env) {
  const form = await request.formData();
  const email = normaliseEmail(form.get('email'));
  const code = normaliseCode(form.get('code'));
  const next = String(form.get('next') ?? '');
  const confirm = String(form.get('confirm') ?? '');
  const ip = clientIp(request);

  if (!looksLikeEmail(email)) return resetPage({ error: RESET_FAILED });

  if (isLockedOut(await recentFailures(env, email, ip)))
    return resetPage({ error: 'Too many attempts. Try again in 15 minutes.', email });

  // Check the new password BEFORE spending the code, so a mistyped confirmation
  // does not burn a single-use credential and force a second round trip to the
  // administrator.
  if (next !== confirm) return resetPage({ error: 'The new passwords do not match.', email });
  const problem = passwordProblem(next);
  if (problem) return resetPage({ error: problem, email });

  const row = await env.DB.prepare(
    `SELECT r.code_hash, r.user_id, r.expires_at, r.used_at, u.email, u.status
       FROM password_resets r JOIN users u ON u.id = r.user_id
      WHERE r.code_hash = ?1`
  ).bind(await resetCodeHash(code)).first();

  const usable = row && !row.used_at && row.expires_at > Date.now()
    && row.email === email && row.status === 'active';

  if (!usable) {
    await recordFailure(env, email, ip);
    return resetPage({ error: RESET_FAILED, email });
  }

  // Hash the new password BEFORE anything is written. Hashing is the expensive
  // step and the one that can throw, and a code must never be spent for an
  // attempt that then fails: the person would be left holding a dead code, no
  // password, and no way back in without an administrator.
  const setting = await passwordStatements(env, row.user_id, next);

  // One transaction. Marking the code spent comes first because the third
  // statement deletes every UNUSED code for the account — the other order
  // deletes the code being redeemed and destroys the record that it was ever
  // used. Safe either way (a deleted code cannot be replayed) but "spent" and
  // "never existed" should not look the same in the table.
  await env.DB.batch([
    env.DB.prepare(`UPDATE password_resets SET used_at = ?1 WHERE code_hash = ?2`)
      .bind(Date.now(), row.code_hash),
    ...setting,
    env.DB.prepare(`DELETE FROM login_attempts WHERE email = ?1`).bind(email),
  ]);

  // No session is issued here. Whoever used the code must now sign in with the
  // password they just set, which proves they hold it rather than merely
  // holding a code that was handed to them.
  return new Response(null, { status: 303, headers: { Location: '/login?reset=1', ...SECURITY_HEADERS } });
}

// An unhandled exception in a Worker becomes Cloudflare's error 1101 page:
// no message, no route, nothing in the account unless log collection is on.
// This project has no observability of its own, so it keeps its own record —
// route and message only, never a body, an address or a credential.
async function recordFailure_(env, request, err) {
  const id = [...crypto.getRandomValues(new Uint8Array(6))]
    .map((b) => b.toString(16).padStart(2, '0')).join('');
  try {
    await env.DB.prepare(
      `INSERT INTO worker_errors (id, at, route, method, message) VALUES (?1, ?2, ?3, ?4, ?5)`
    ).bind(id, Date.now(), new URL(request.url).pathname, request.method,
           String(err?.stack ?? err).slice(0, 900)).run();
  } catch {
    // The database is the most likely thing to be broken when we get here.
    // Losing the record is acceptable; failing to answer the request is not.
  }
  return id;
}

export default {
  async fetch(request, env) {
    try {
      return await handle(request, env);
    } catch (err) {
      const id = await recordFailure_(env, request, err);
      // The reference is the whole point: it lets an operator find this exact
      // failure in worker_errors. The visitor is told nothing else.
      return shell('something went wrong', `
  <h1>Something went wrong</h1>
  <p class="sub">The failure was recorded. Nothing you did caused it.</p>
  <p class="note">Reference <b>${esc(id)}</b> &middot; <a href="/login">Back to sign in</a></p>`, 500);
    }
  },
};

async function handle(request, env) {
  {
    const url = new URL(request.url);
    await buildInfo(env);

    if (url.pathname === '/healthz')
      return new Response('ok', { headers: { 'Content-Type': 'text/plain', ...SECURITY_HEADERS } });

    if (url.pathname === '/login')
      return request.method === 'POST'
        ? handleLogin(request, env)
        : loginPage({ notice: url.searchParams.has('reset') ? 'Password set. Sign in with it now.' : '' });

    if (url.pathname === '/reset')
      return request.method === 'POST' ? handleReset(request, env) : resetPage();

    if (url.pathname === '/logout' && request.method === 'POST') return handleLogout(request, env);

    // Before the session gate on purpose: this is how an operator with no
    // browser asks whether generation is configured. Its own token gates it.
    if (url.pathname === '/api/selftest' && request.method === 'POST')
      return handleSelfTest(request, env);

    const user = await currentUser(env, request);

    // Everything a signed-in reader acts through. /api answers JSON rather than
    // a redirect: a fetch that quietly receives a login page is worse than one
    // that is told plainly it has no session.
    if (url.pathname.startsWith('/account') || url.pathname.startsWith('/api/')) {
      if (!user)
        return url.pathname.startsWith('/api/')
          ? json({ error: 'no-session' }, 401)
          : new Response(null, { status: 303, headers: { Location: '/login', ...SECURITY_HEADERS } });
      if (url.pathname === '/account' && request.method === 'GET')
        return accountPage(user, {
          sessions: await countSessions(env, user.id),
          notice: url.searchParams.has('changed') ? 'Password changed. Every other session was signed out.'
                : url.searchParams.has('revoked') ? 'Signed out everywhere else.' : '',
        });
      if (url.pathname === '/account/password' && request.method === 'POST')
        return handleChangePassword(request, env, user);
      if (url.pathname === '/account/revoke-all' && request.method === 'POST')
        return handleRevokeAll(request, env, user);
      if (url.pathname === '/api/generate' && request.method === 'POST')
        return handleGenerate(request, env, user);
      if (url.pathname.startsWith('/api/generate/') && request.method === 'GET')
        return pollVideo(env, url.pathname.slice('/api/generate/'.length));
      return new Response('Not found', { status: 404, headers: SECURITY_HEADERS });
    }

    if (!user) {
      // No redirect parameter is carried across the login boundary — an
      // attacker-supplied `?next=` is how open redirects get built.
      return new Response(null, { status: 303, headers: { Location: '/login', ...SECURITY_HEADERS } });
    }

    // Clean paths for the pages people actually name. The root is the platform
    // itself — a reader who signs in wants the text, not a dashboard about the
    // text — and the build status lives one path along at /status.
    const PAGES = { '/': '/reader.html', '/status': '/status.html', '/console': '/console.html',
                    // An ADDRESS, not a name: it sits in links and bookmarks, and should not
                    // churn because a word improved.
                    '/evolution': '/evolution.html' };
    const target = PAGES[url.pathname] ? new URL(PAGES[url.pathname], url) : request;
    const asset = await env.ASSETS.fetch(target);
    const res = new Response(asset.body, asset);
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.headers.set(k, v);
    // Signed-in pages must never be cached by a shared proxy.
    res.headers.set('Cache-Control', 'private, no-store');
    res.headers.set('X-Signed-In-As', user.email);
    return res;
  }
}
