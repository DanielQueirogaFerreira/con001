#!/usr/bin/env node
// Creates the SQL to add or update a user of the private alpha.
//
// There is no self-registration: access is an allowlist, and this is how a name
// gets onto it. The tool prints SQL rather than touching the database, so the
// grant is a reviewable act rather than a side effect of running a script.
//
//   node tools/user-admin.mjs --email a@b.org --name "A B" --generate
//   node tools/user-admin.mjs --email a@b.org --name "A B" --password '...'
//   node tools/user-admin.mjs --suspend --email a@b.org
//
// Apply with:
//   npx wrangler d1 execute open-hermeneutics --remote --command "<sql>"

import { hashPassword } from '../worker/auth.mjs';
import { normaliseEmail, looksLikeEmail } from '../worker/auth.mjs';

const arg = (name, fallback = null) => {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')
    ? process.argv[i + 1] : fallback;
};
const flag = (name) => process.argv.includes('--' + name);
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;

const email = normaliseEmail(arg('email'));
if (!looksLikeEmail(email)) {
  console.error('Usage: node tools/user-admin.mjs --email <address> --name "<display name>" [--generate | --password <pw>]');
  console.error('       node tools/user-admin.mjs --suspend --email <address>');
  process.exit(1);
}

if (flag('suspend')) {
  console.log(`\nUPDATE users SET status = 'suspended' WHERE email = ${q(email)};`);
  console.log(`DELETE FROM sessions WHERE user_id = (SELECT id FROM users WHERE email = ${q(email)});\n`);
  console.log('  The second statement matters: suspending an account without revoking its');
  console.log('  live sessions leaves the person signed in until the session expires.\n');
  process.exit(0);
}

const name = arg('name');
if (!name) { console.error('--name is required'); process.exit(1); }

// A generated credential beats a chosen one for an invite: the person has not
// used it anywhere else. It must also be strong OFFLINE — the login lockout
// stops online guessing, but if the database ever leaks, only the PBKDF2 cost
// and this entropy stand between an attacker and the account.
//
// Crockford-style base32, minus the characters people mistranscribe (I, L, O,
// U). 32 symbols is exactly 5 bits each with no modulo bias from a byte, and
// grouping keeps it readable enough to type once.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const GROUPS = 5;
const PER_GROUP = 5;
const CREDENTIAL_BITS = GROUPS * PER_GROUP * Math.log2(ALPHABET.length);

function generateCredential() {
  const bytes = crypto.getRandomValues(new Uint8Array(GROUPS * PER_GROUP));
  const chars = [...bytes].map((b) => ALPHABET[b % ALPHABET.length]);
  return Array.from({ length: GROUPS }, (_, i) =>
    chars.slice(i * PER_GROUP, (i + 1) * PER_GROUP).join('')).join('-');
}

const password = flag('generate') ? generateCredential() : arg('password');
if (!password) { console.error('Pass --generate or --password <pw>'); process.exit(1); }
if (password.length < 12) { console.error('Password must be at least 12 characters.'); process.exit(1); }

const secret = await hashPassword(password);
const id = crypto.randomUUID();
const now = Date.now();

console.log(`
-- ${email} · ${name}
INSERT INTO users (id, email, display_name, status, created_at)
VALUES (${q(id)}, ${q(email)}, ${q(name)}, 'active', ${now})
ON CONFLICT(email) DO UPDATE SET display_name = excluded.display_name, status = 'active';

INSERT INTO identities (user_id, provider, subject, secret, created_at)
VALUES ((SELECT id FROM users WHERE email = ${q(email)}), 'password', NULL, ${q(secret)}, ${now})
ON CONFLICT(user_id, provider) DO UPDATE SET secret = excluded.secret;
`);

if (flag('generate')) {
  console.log(`-- Generated credential (${CREDENTIAL_BITS} bits). Shown once. Send it over a different channel`);
  console.log(`-- than the one carrying the URL, and have them change it after first sign-in:`);
  console.log(`--\n--     ${password}\n--`);
}
console.log('-- The password itself is not in the SQL above; only its PBKDF2 hash is.');
