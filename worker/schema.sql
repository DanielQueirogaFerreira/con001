-- D1 schema for the private alpha gate. See docs/15-access.md.
--
-- The shape is chosen so SSO can be added without reshaping anything: a `users`
-- row is the PERSON, an `identities` row is ONE WAY of proving you are them.
-- Today the only provider is 'password'. Adding Google, GitHub or OIDC later is
-- an extra identities row per user, not a migration of users.

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,          -- stored already normalised (trimmed, lowercased)
  display_name  TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  created_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS identities (
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider      TEXT NOT NULL CHECK (provider IN ('password', 'google', 'github', 'oidc')),
  subject       TEXT,                          -- the provider's own id for this person; NULL for passwords
  secret        TEXT,                          -- pbkdf2$sha256$... for passwords; NULL for SSO
  created_at    INTEGER NOT NULL,
  PRIMARY KEY (user_id, provider)
);

-- Only the SHA-256 of a session token is stored, so a database leak yields no
-- usable sessions — the same reason passwords are not stored either.
CREATE TABLE IF NOT EXISTS sessions (
  token_hash    TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at    INTEGER NOT NULL,
  expires_at    INTEGER NOT NULL,
  ip            TEXT
);
CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions (expires_at);

-- Failures only. Successful logins are not logged here; a table of who read
-- scripture and when is a record this project should not be accumulating.
CREATE TABLE IF NOT EXISTS login_attempts (
  email         TEXT NOT NULL,
  ip            TEXT NOT NULL,
  at            INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS login_attempts_at ON login_attempts (at);

-- Reset codes are issued by an administrator and delivered out of band, then
-- typed in by the person. There is deliberately no emailed link: no email
-- provider to hold a secret for, no address enumeration through a "we sent you
-- a mail" response, and no token sitting in a URL where Referer headers,
-- browser history and proxy logs can find it.
--
-- Only the hash of a code is stored, as with sessions and passwords.
CREATE TABLE IF NOT EXISTS password_resets (
  code_hash     TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at    INTEGER NOT NULL,
  expires_at    INTEGER NOT NULL,
  used_at       INTEGER                        -- non-NULL means spent; codes are single-use
);
CREATE INDEX IF NOT EXISTS password_resets_user ON password_resets (user_id);

-- A Worker that throws returns Cloudflare's error 1101 page: no message, no
-- route, and nothing anywhere in the account unless log collection happens to
-- be enabled. This project has no observability of its own, so it keeps the
-- minimum: what broke and where. Never a request body, an address, or a
-- credential — a table of failures must not become a table of who was doing
-- what when they failed.
CREATE TABLE IF NOT EXISTS worker_errors (
  id            TEXT PRIMARY KEY,
  at            INTEGER NOT NULL,
  route         TEXT NOT NULL,
  method        TEXT NOT NULL,
  message       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS worker_errors_at ON worker_errors (at);
