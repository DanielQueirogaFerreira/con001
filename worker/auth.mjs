// Auth primitives. Pure, dependency-free, and written against WebCrypto only —
// which means the exact code the Worker runs is the code Node tests.
// See docs/15-access.md.
//
// Nothing here touches storage or HTTP. That separation is deliberate: crypto
// you cannot test in isolation is crypto nobody tests.

const enc = new TextEncoder();

/* ------------------------------------------------------------- passwords */

// PBKDF2-HMAC-SHA256 is the strongest password KDF available in the Workers
// runtime — Argon2id and scrypt are not.
//
// THE ITERATION COUNT IS CAPPED BY THE RUNTIME, NOT CHOSEN FREELY. Workers
// refuses anything above 100,000:
//
//   NotSupportedError: Pbkdf2 failed: iteration counts above 100000 are not
//   supported (requested 210000).
//
// This was set to the OWASP figure of 210,000 and passed every test, because
// Node's WebCrypto has no such cap — so the tests hashed and verified happily
// while the deployed Worker could do neither. Nothing about the failure named
// the cause: verifyPassword caught the error and returned false, which the
// login route reports as "Email or password is incorrect", so every correct
// password looked wrong. Setting a password threw outright.
//
// The count is stored IN each hash, so raising it later re-hashes nobody.
export const RUNTIME_MAX_PBKDF2_ITERATIONS = 100_000;
export const PBKDF2_ITERATIONS = RUNTIME_MAX_PBKDF2_ITERATIONS;

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
  // A record this runtime cannot even attempt is NOT a wrong password, and
  // must not be reported as one. Returning false here is how a whole account
  // became unopenable while every message said the password was incorrect.
  if (iterations > RUNTIME_MAX_PBKDF2_ITERATIONS)
    throw new Error(
      `stored hash uses ${iterations} PBKDF2 iterations; this runtime supports at ` +
      `most ${RUNTIME_MAX_PBKDF2_ITERATIONS}. The record must be re-hashed.`);
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

/* ------------------------------------------------------------ credentials */

// Crockford-style base32 minus the characters people mistranscribe (I, L, O,
// U). 32 symbols is exactly 5 bits each, so a byte modulo 32 carries no bias.
export const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const PER_GROUP = 5;

/** Grouped, readable, and strong enough to survive a database leak. */
export function generateCredential(groups = 5) {
  const bytes = crypto.getRandomValues(new Uint8Array(groups * PER_GROUP));
  const chars = [...bytes].map((b) => ALPHABET[b % ALPHABET.length]);
  return Array.from({ length: groups }, (_, i) =>
    chars.slice(i * PER_GROUP, (i + 1) * PER_GROUP).join('')).join('-');
}

export const credentialBits = (groups = 5) => groups * PER_GROUP * Math.log2(ALPHABET.length);

// Reset codes are single-use and short-lived, so they need less entropy than a
// standing password — but they are still a full credential while they live.
export const RESET_GROUPS = 4;
export const RESET_TTL_SECONDS = 60 * 60;

/** Codes are typed by a person, so accept any case and any grouping. */
export function normaliseCode(code) {
  return String(code ?? '').toUpperCase().replace(/[^0-9A-Z]/g, '');
}

/**
 * The ONE way a reset code becomes a database key — used both when issuing a
 * code and when redeeming one.
 *
 * These were once two expressions in two files, and they disagreed: the issuer
 * hashed the grouped code it had just printed, the Worker hashed what the
 * person typed after normalisation. The dashes are the whole difference, and
 * the symptom is silent and total — every code issued is refused as invalid,
 * with no way to tell that from a mistyped one, because the failure message is
 * deliberately the same for both.
 */
export const resetCodeHash = (code) => hashToken(normaliseCode(code));

/* ---------------------------------------------------------------- policy */

export const SESSION_TTL_SECONDS = 12 * 60 * 60;
export const PASSWORD_MIN = 12;

/** Returns a reason string, or null when the password is acceptable. */
export function passwordProblem(password, { current = null } = {}) {
  const pw = String(password ?? '');
  if (pw.length < PASSWORD_MIN) return `Password must be at least ${PASSWORD_MIN} characters.`;
  if (pw.length > 512) return 'Password is too long.';
  // Re-hashing a very long string is a cheap way to make the server work hard;
  // the cap above is the defence. This one is about the user, not the server:
  if (current !== null && pw === current) return 'New password must be different from the current one.';
  return null;
}

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
