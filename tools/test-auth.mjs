#!/usr/bin/env node
// Tests for the access gate — worker/auth.mjs and the Worker's fetch handler.
//
// The Worker runs on WebCrypto only, and Node 22 has WebCrypto, so these tests
// exercise the exact code that will run in production rather than a
// reimplementation of it. The D1 and ASSETS bindings are stubbed in memory.
//
// Usage: node tools/test-auth.mjs

import {
  DUMMY_RECORD, LOCKOUT, LOGIN_FAILED, PBKDF2_ITERATIONS, SESSION_COOKIE,
  hashPassword, hashToken, isLockedOut, looksLikeEmail, newSessionToken,
  normaliseEmail, readCookie, serializeCookie, timingSafeEqual, verifyPassword,
} from '../worker/auth.mjs';
import worker from '../worker/index.mjs';

let failed = 0;
const t = async (name, fn) => {
  try { await fn(); console.log(`ok    ${name}`); }
  catch (e) { console.error(`FAIL  ${name}\n      ${e.message}`); failed++; }
};
const assert = (c, m) => { if (!c) throw new Error(m); };

/* ------------------------------------------------------------- passwords */

const PASSWORD = 'correct horse battery staple';

await t('a password verifies against its own hash and nothing else', async () => {
  const stored = await hashPassword(PASSWORD);
  assert(await verifyPassword(PASSWORD, stored), 'the right password must verify');
  assert(!(await verifyPassword(PASSWORD + 'x', stored)), 'a wrong password must not');
  assert(!(await verifyPassword('', stored)), 'an empty password must not');
});

await t('the same password hashes differently every time', async () => {
  const a = await hashPassword(PASSWORD);
  const b = await hashPassword(PASSWORD);
  assert(a !== b, 'a per-record salt is what stops one rainbow table covering every user');
  assert(await verifyPassword(PASSWORD, a) && await verifyPassword(PASSWORD, b), 'both must still verify');
});

await t('the hash records its own cost, so it can be raised later', async () => {
  const cheap = await hashPassword(PASSWORD, 1000);
  assert(cheap.startsWith(`pbkdf2$sha256$1000$`), `unexpected format: ${cheap.slice(0, 24)}`);
  assert(await verifyPassword(PASSWORD, cheap), 'an older, cheaper record must still verify');
  const now = await hashPassword(PASSWORD);
  assert(now.includes(`$${PBKDF2_ITERATIONS}$`), 'new hashes must use the current cost');
});

await t('short passwords are refused at the point of hashing', async () => {
  let threw = false;
  try { await hashPassword('short'); } catch { threw = true; }
  assert(threw, 'a 5-character password must never reach the database');
});

await t('a malformed stored record fails closed', async () => {
  for (const bad of ['', 'nonsense', 'pbkdf2$sha256$0$a$b', 'md5$x$1$a$b', null, undefined,
                     'pbkdf2$sha256$210000$!!!$!!!'])
    assert(!(await verifyPassword(PASSWORD, bad)), `"${bad}" must not verify`);
});

await t('the dummy record verifies nothing', async () => {
  assert(!(await verifyPassword(PASSWORD, DUMMY_RECORD)), 'the timing decoy must never grant access');
  assert(!(await verifyPassword('', DUMMY_RECORD)), 'not even an empty password');
});

await t('comparison is constant-time by construction', () => {
  const a = new Uint8Array([1, 2, 3, 4]);
  assert(timingSafeEqual(a, new Uint8Array([1, 2, 3, 4])), 'equal arrays compare equal');
  assert(!timingSafeEqual(a, new Uint8Array([1, 2, 3, 5])), 'a difference in the last byte is caught');
  assert(!timingSafeEqual(a, new Uint8Array([9, 2, 3, 4])), 'a difference in the first byte is caught');
  assert(!timingSafeEqual(a, new Uint8Array([1, 2, 3])), 'different lengths are unequal');
});

/* -------------------------------------------------------------- sessions */

await t('session tokens are random and never stored in the clear', async () => {
  const tokens = new Set(Array.from({ length: 200 }, newSessionToken));
  assert(tokens.size === 200, 'every token must be unique');
  const one = [...tokens][0];
  assert(one.length >= 43, `expected 256 bits of entropy, got ${one.length} chars`);
  assert(!/[^A-Za-z0-9_-]/.test(one), 'tokens must be URL-safe');
  const h = await hashToken(one);
  assert(h !== one, 'the stored value must not be the token itself');
  assert(h === await hashToken(one), 'hashing must be deterministic');
  assert(h !== await hashToken(newSessionToken()), 'different tokens must hash differently');
});

/* --------------------------------------------------------------- cookies */

await t('the session cookie is hardened', () => {
  const c = serializeCookie(SESSION_COOKIE, 'abc', { maxAge: 3600 });
  for (const flag of ['HttpOnly', 'Secure', 'SameSite=Strict', 'Path=/'])
    assert(c.includes(flag), `cookie must set ${flag}`);
  assert(!/Domain=/.test(c), '__Host- cookies must not set Domain');
  assert(SESSION_COOKIE.startsWith('__Host-'), 'the __Host- prefix pins the cookie to this exact origin');
  const gone = serializeCookie(SESSION_COOKIE, '', { expire: true });
  assert(gone.includes('Max-Age=0'), 'logout must expire the cookie');
});

await t('cookie parsing picks the right value', () => {
  const header = `other=1; ${SESSION_COOKIE}=wanted; another=2`;
  assert(readCookie(header, SESSION_COOKIE) === 'wanted', 'must find the named cookie');
  assert(readCookie(header, 'missing') === null, 'must return null when absent');
  assert(readCookie(null, SESSION_COOKIE) === null, 'must tolerate no header');
  assert(readCookie('malformed', SESSION_COOKIE) === null, 'must tolerate junk');
});

/* ------------------------------------------------------------ throttling */

await t('lockout counts only failures inside the window', () => {
  const now = Date.now();
  const many = Array.from({ length: LOCKOUT.attempts }, () => now - 1000);
  assert(isLockedOut(many, now), `${LOCKOUT.attempts} recent failures must lock`);
  assert(!isLockedOut(many.slice(1), now), 'one under the threshold must not lock');
  const old = Array.from({ length: 50 }, () => now - LOCKOUT.windowMs - 1);
  assert(!isLockedOut(old, now), 'failures outside the window must expire');
});

await t('emails normalise before comparison', () => {
  assert(normaliseEmail('  Person@Example.COM ') === 'person@example.com', 'trim and lowercase');
  assert(looksLikeEmail('a@b.co') && !looksLikeEmail('nope') && !looksLikeEmail('a@b'), 'basic shape check');
});

/* ---------------------------------------------- the handler, with stubs */

function makeEnv({ users = [], identities = [], sessions = [], attempts = [] } = {}) {
  const db = { users, identities, sessions, attempts };
  const run = (sql, args) => {
    if (sql.includes('FROM users u JOIN identities i')) {
      const u = db.users.find((x) => x.email === args[0]);
      const i = u && db.identities.find((x) => x.user_id === u.id && x.provider === 'password');
      return { first: () => (u && i ? { user_id: u.id, email: u.email, status: u.status, secret: i.secret } : null) };
    }
    if (sql.includes('SELECT at FROM login_attempts')) {
      const [since, email, ip] = args;
      return { all: () => ({ results: db.attempts.filter((a) => a.at > since && (a.email === email || a.ip === ip)) }) };
    }
    if (sql.includes('INSERT INTO login_attempts')) {
      return { run: () => db.attempts.push({ email: args[0], ip: args[1], at: args[2] }) };
    }
    if (sql.includes('DELETE FROM login_attempts')) {
      return { run: () => (db.attempts = db.attempts.filter((a) => a.email !== args[0])) };
    }
    if (sql.includes('FROM sessions s JOIN users u')) {
      const s = db.sessions.find((x) => x.token_hash === args[0]);
      const u = s && db.users.find((x) => x.id === s.user_id);
      return { first: () => (s && u ? { id: u.id, email: u.email, display_name: u.display_name, expires_at: s.expires_at } : null) };
    }
    if (sql.includes('INSERT INTO sessions')) {
      return { run: () => db.sessions.push({ token_hash: args[0], user_id: args[1], created_at: args[2], expires_at: args[3], ip: args[4] }) };
    }
    if (sql.includes('DELETE FROM sessions')) {
      return { run: () => (db.sessions = db.sessions.filter((s) => s.token_hash !== args[0])) };
    }
    throw new Error('unstubbed query: ' + sql.slice(0, 60));
  };
  return {
    _db: db,
    DB: { prepare: (sql) => ({ bind: (...args) => run(sql, args) }) },
    ASSETS: { fetch: async () => new Response('<h1>the reader</h1>', { headers: { 'Content-Type': 'text/html' } }) },
  };
}

const req = (path, init = {}) => new Request('https://example.workers.dev' + path, init);
const login = (email, password, extra = {}) =>
  req('/login', { method: 'POST', body: new URLSearchParams({ email, password }), ...extra });

async function seeded() {
  const secret = await hashPassword(PASSWORD);
  return makeEnv({
    users: [{ id: 'u1', email: 'reader@example.com', display_name: 'Reader', status: 'active' }],
    identities: [{ user_id: 'u1', provider: 'password', secret }],
  });
}

await t('an unauthenticated request never reaches the assets', async () => {
  const env = await seeded();
  let assetsTouched = false;
  env.ASSETS.fetch = async () => { assetsTouched = true; return new Response('leak'); };
  const res = await worker.fetch(req('/'), env);
  assert(res.status === 303 && res.headers.get('Location') === '/login', `expected redirect, got ${res.status}`);
  assert(!assetsTouched, 'the gate must run before the asset server, or it is decorative');
});

await t('an unknown email and a wrong password are indistinguishable', async () => {
  const env = await seeded();
  const a = await worker.fetch(login('nobody@example.com', PASSWORD), env);
  const b = await worker.fetch(login('reader@example.com', 'wrong password here'), env);
  assert(a.status === b.status && a.status === 401, `expected matching 401s, got ${a.status}/${b.status}`);
  const [ta, tb] = [await a.text(), await b.text()];
  assert(ta.includes(LOGIN_FAILED) && tb.includes(LOGIN_FAILED), 'both must show the same message');
  assert(ta === tb, 'the responses must be byte-identical, or the difference is the answer');
});

await t('a correct password issues a hardened session cookie', async () => {
  const env = await seeded();
  const res = await worker.fetch(login('reader@example.com', PASSWORD), env);
  assert(res.status === 303 && res.headers.get('Location') === '/', `expected redirect, got ${res.status}`);
  const cookie = res.headers.get('Set-Cookie') ?? '';
  assert(cookie.startsWith(SESSION_COOKIE + '='), 'the session cookie must be set');
  for (const flag of ['HttpOnly', 'Secure', 'SameSite=Strict']) assert(cookie.includes(flag), `missing ${flag}`);
  assert(env._db.sessions.length === 1, 'a session row must exist');
  const token = cookie.slice(SESSION_COOKIE.length + 1).split(';')[0];
  assert(env._db.sessions[0].token_hash !== token, 'the raw token must never be stored');
  assert(env._db.sessions[0].token_hash === await hashToken(token), 'the stored value must be its hash');
});

await t('email case and surrounding space do not prevent sign-in', async () => {
  const env = await seeded();
  const res = await worker.fetch(login('  Reader@Example.COM  ', PASSWORD), env);
  assert(res.status === 303, `expected sign-in to succeed, got ${res.status}`);
});

await t('a suspended user cannot sign in with the right password', async () => {
  const env = await seeded();
  env._db.users[0].status = 'suspended';
  const res = await worker.fetch(login('reader@example.com', PASSWORD), env);
  assert(res.status === 401, 'suspension must hold even against a valid password');
});

await t('a valid session reaches the assets; an expired one does not', async () => {
  const env = await seeded();
  const cookie = (await worker.fetch(login('reader@example.com', PASSWORD), env)).headers.get('Set-Cookie');
  const jar = cookie.split(';')[0];

  const ok = await worker.fetch(req('/', { headers: { Cookie: jar } }), env);
  assert(ok.status === 200 && (await ok.text()).includes('the reader'), 'a signed-in reader sees the page');
  assert(ok.headers.get('Cache-Control') === 'private, no-store', 'signed-in pages must not be shared-cached');
  assert(ok.headers.get('X-Frame-Options') === 'DENY', 'security headers must be applied to assets too');

  env._db.sessions[0].expires_at = Date.now() - 1;
  const stale = await worker.fetch(req('/', { headers: { Cookie: jar } }), env);
  assert(stale.status === 303, 'an expired session must not be honoured');
  assert(env._db.sessions.length === 0, 'and it must be swept from the table');
});

await t('a forged cookie is rejected', async () => {
  const env = await seeded();
  const res = await worker.fetch(req('/', { headers: { Cookie: `${SESSION_COOKIE}=${newSessionToken()}` } }), env);
  assert(res.status === 303, 'a token that was never issued must not authenticate');
});

await t('logout revokes server-side, not just in the browser', async () => {
  const env = await seeded();
  const jar = (await worker.fetch(login('reader@example.com', PASSWORD), env)).headers.get('Set-Cookie').split(';')[0];
  const out = await worker.fetch(req('/logout', { method: 'POST', headers: { Cookie: jar } }), env);
  assert(out.status === 303 && out.headers.get('Set-Cookie').includes('Max-Age=0'), 'the cookie must be cleared');
  assert(env._db.sessions.length === 0, 'the session row must be deleted — a copied cookie must die too');
  const after = await worker.fetch(req('/', { headers: { Cookie: jar } }), env);
  assert(after.status === 303, 'the old cookie must no longer work');
});

await t('repeated failures lock the account out', async () => {
  const env = await seeded();
  for (let i = 0; i < LOCKOUT.attempts; i++)
    await worker.fetch(login('reader@example.com', 'wrong password here'), env);
  const locked = await worker.fetch(login('reader@example.com', PASSWORD), env);
  assert((await locked.text()).includes('Too many attempts'), 'the correct password must not bypass the lockout');
});

await t('a successful sign-in clears that account\'s failure history', async () => {
  const env = await seeded();
  for (let i = 0; i < LOCKOUT.attempts - 1; i++)
    await worker.fetch(login('reader@example.com', 'wrong password here'), env);
  assert(env._db.attempts.length === LOCKOUT.attempts - 1, 'failures should have accumulated');
  await worker.fetch(login('reader@example.com', PASSWORD), env);
  assert(env._db.attempts.length === 0, 'one bad night must not keep a legitimate user locked out');
});

await t('the login page carries no external origin in its CSP', async () => {
  const env = await seeded();
  const res = await worker.fetch(req('/login'), env);
  const csp = res.headers.get('Content-Security-Policy') ?? '';
  assert(csp.includes("default-src 'none'"), 'CSP must default to nothing');
  assert(csp.includes("frame-ancestors 'none'"), 'clickjacking must be blocked');
  assert(!/https?:/.test(csp), 'no remote origin belongs in this policy');
});

await t('there is no self-registration route', async () => {
  const env = await seeded();
  for (const path of ['/register', '/signup', '/users/new']) {
    const res = await worker.fetch(req(path, { method: 'POST' }), env);
    assert(res.status === 303 && res.headers.get('Location') === '/login',
      `${path} must not be a way in`);
  }
});

console.log(failed ? `\n${failed} auth test(s) failed` : `\nall auth tests pass`);
process.exit(failed ? 1 : 0);
