#!/usr/bin/env node
// Creates the SQL to add or update a user of the private alpha.
//
// There is no self-registration: access is an allowlist, and this is how a name
// gets onto it. The tool prints SQL rather than touching the database, so the
// grant is a reviewable act rather than a side effect of running a script.
//
//   node tools/user-admin.mjs --email a@b.org --name "A B" --generate
//   node tools/user-admin.mjs --email a@b.org --name "A B" --password '...'
//   node tools/user-admin.mjs --reset   --email a@b.org
//   node tools/user-admin.mjs --suspend --email a@b.org
//
// Apply with:
//   npx wrangler d1 execute open-hermeneutics --remote --command "<sql>"

import {
  RESET_GROUPS, RESET_TTL_SECONDS, credentialBits, generateCredential,
  hashPassword, hashToken, looksLikeEmail, normaliseEmail,
} from '../worker/auth.mjs';

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
  console.error('       node tools/user-admin.mjs --reset --email <address>');
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

if (flag('reset')) {
  // Issue a single-use code, delivered out of band and typed in by the person.
  // Deliberately not an emailed link: no email provider to hold a secret for,
  // no address enumeration through a "we sent you a mail" response, and no
  // token sitting in a URL where Referer headers and browser history find it.
  const code = generateCredential(RESET_GROUPS);
  const now = Date.now();
  console.log(`
-- Reset code for ${email}. Supersedes any code already outstanding.
DELETE FROM password_resets WHERE user_id = (SELECT id FROM users WHERE email = ${q(email)}) AND used_at IS NULL;
INSERT INTO password_resets (code_hash, user_id, created_at, expires_at, used_at)
VALUES (${q(await hashToken(code))}, (SELECT id FROM users WHERE email = ${q(email)}),
        ${now}, ${now + RESET_TTL_SECONDS * 1000}, NULL);
`);
  console.log(`-- Code (${credentialBits(RESET_GROUPS)} bits), valid ${RESET_TTL_SECONDS / 60} minutes, single use.`);
  console.log(`-- Shown once. Deliver it over a different channel than the site URL:`);
  console.log(`--\n--     ${code}\n--`);
  console.log('-- Only the hash of the code is in the SQL above.');
  console.log('-- The person enters it at /reset. Using it signs out all their sessions.');
  process.exit(0);
}

const name = arg('name');
if (!name) { console.error('--name is required'); process.exit(1); }

// A generated credential beats a chosen one for an invite: the person has not
// used it anywhere else, and it must be strong OFFLINE — the login lockout
// stops online guessing, but if the database ever leaks, only the PBKDF2 cost
// and this entropy stand between an attacker and the account. The generator
// lives in worker/auth.mjs so it is covered by the auth tests.
const GROUPS = 5;

const password = flag('generate') ? generateCredential(GROUPS) : arg('password');
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
  console.log(`-- Generated credential (${credentialBits(GROUPS)} bits). Shown once. Send it over a different channel`);
  console.log(`-- than the one carrying the URL, and have them change it after first sign-in:`);
  console.log(`--\n--     ${password}\n--`);
}
console.log('-- The password itself is not in the SQL above; only its PBKDF2 hash is.');
