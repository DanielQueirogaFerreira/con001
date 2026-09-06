// Auth primitives. Pure, dependency-free, and written against WebCrypto only —
// which means the exact code the Worker runs is the code Node tests.
// See docs/15-access.md.
//
// Nothing here touches storage or HTTP. That separation is deliberate: crypto
// you cannot test in isolation is crypto nobody tests.

const enc = new TextEncoder();

/* ------------------------------------------------------------- passwords */

// PBKDF2-HMAC-SHA256 is the strongest password KDF available in the Workers
// runtime — Argon2id and scrypt are not. 210,000 iterations is the OWASP
// figure for this construction. The iteration count is stored IN the hash, so
// it can be raised later and old records still verify.
export const PBKDF2_ITERATIONS = 210_000;

const b64 = {
  encode: (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))),
  decode: (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0)),
};

async function derive(password, salt, iterations) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, key, 256);
  return new Uint8Array(bits);
}

/** `pbkdf2$sha256$<iterations>$<salt>$<hash>` — self-describing, so the cost can be raised later. */
export async function hashPassword(password, iterations = PBKDF2_ITERATIONS) {
  if (typeof password !== 'string' || password.length < 12)
    throw new Error('password must be at least 12 characters');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt, iterations);
  return `pbkdf2$sha256$${iterations}$${b64.encode(salt)}$${b64.encode(hash)}`;
}

/** Constant-time byte comparison. A `===` here leaks the hash one byte at a time. */
export function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function verifyPassword(password, stored) {
  const parts = String(stored ?? '').split('$');
  if (parts.length !== 5 || parts[0] !== 'pbkdf2' || parts[1] !== 'sha256') return false;
  const iterations = Number(parts[2]);
  if (!Number.isInteger(iterations) || iterations < 1000) return false;
  try {
    const salt = b64.decode(parts[3]);
    const expected = b64.decode(parts[4]);
    const actual = await derive(password, salt, iterations);
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

// A record shaped like a real one, used when the email is unknown so that the
// login path costs the same either way. Without this, response time answers
// "does this address have an account?" — which is the whole of user
// enumeration.
export const DUMMY_RECORD =
  `pbkdf2$sha256$${PBKDF2_ITERATIONS}$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=`;

/* -------------------------------------------------------------- sessions */

const b64url = (buf) => b64.encode(buf).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** 256 bits from the CSPRNG. Never derived from anything about the user. */
export function newSessionToken() {
  return b64url(crypto.getRandomValues(new Uint8Array(32)));
}

// Only the HASH of a session token is stored. A database leak then yields no
// usable sessions — the same reason passwords are not stored either.
export async function hashToken(token) {
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(token));
  return b64url(digest);
}

/* --------------------------------------------------------------- cookies */

export const SESSION_COOKIE = '__Host-oh_session';

export function serializeCookie(name, value, { maxAge, expire = false } = {}) {
  // __Host- prefix requires Secure, Path=/ and no Domain. The browser then
  // refuses the cookie from any other host, which kills subdomain injection.
  const parts = [
    `${name}=${value}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Strict',   // the CSRF defence for the login POST
  ];
  parts.push(`Max-Age=${expire ? 0 : maxAge}`);
  if (expire) parts.push('Expires=Thu, 01 Jan 1970 00:00:00 GMT');
  return parts.join('; ');
}

export function readCookie(header, name) {
  for (const part of String(header ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    if (part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return null;
}

/* ------------------------------------------------------------ throttling */

export const LOCKOUT = { attempts: 10, windowMs: 15 * 60 * 1000 };

/** Lock on failures within the window. Counted per email AND per IP by the caller. */
export function isLockedOut(failures, now = Date.now()) {
  return failures.filter((t) => now - t < LOCKOUT.windowMs).length >= LOCKOUT.attempts;
}

/* ---------------------------------------------------------------- policy */

export const SESSION_TTL_SECONDS = 12 * 60 * 60;

export function normaliseEmail(email) {
  return String(email ?? '').trim().toLowerCase();
}

// Deliberately not a full RFC 5322 validator — this gate is an allowlist, and
// an address only matters if it is already in the users table.
export function looksLikeEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

/** One message for every failure. Distinguishing them tells an attacker which half was right. */
export const LOGIN_FAILED = 'Email or password is incorrect.';
