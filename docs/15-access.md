# 15 — Access: Private Alpha Behind a Worker

The alpha is private. GitHub holds the source and runs CI; a Cloudflare Worker
serves the built site and will not serve a single byte of it without a session.

## Why not private GitHub Pages

**Private Pages requires GitHub Enterprise Cloud.** On a personal or free
account, Pages is public-only — there is no setting to make it private, so
"deploy to Pages but keep it private" is not a configuration, it is a plan
change. The Pages deploy job has been removed rather than left in place to fail.

The Worker is the better answer regardless: Pages could only ever be all-or-
nothing, whereas the gate here is per-person, revocable, and will extend to SSO.

```
  GitHub                          Cloudflare
  ──────                          ──────────
  source of truth                 Worker  ── session? ──▶ ASSETS (web/)
  CI on every push                  │  no
  manual deploy ────────────────▶   └──────▶ /login
                                    D1: users · identities · sessions
```

## The gate

`worker/index.mjs` runs **before** static assets — `run_worker_first = true` in
`wrangler.toml`. Without that line the asset server answers first and the gate
is decorative. There is a test asserting that an unauthenticated request never
touches the asset binding at all.

| Route | Behaviour |
|---|---|
| `/login` | The sign-in form; `POST` authenticates |
| `/logout` | `POST` only; revokes the session **server-side** |
| `/account` | Change password, sign out everywhere else. Session required |
| `/reset` | Redeem an administrator-issued reset code |
| `/healthz` | Liveness, unauthenticated, returns nothing about the site |
| everything else | Session required, or 303 to `/login` |

**There is no self-registration route.** Access is an allowlist; a name gets on
it through `npm run user`, which prints SQL for review rather than writing to
the database itself. A test walks `/register`, `/signup` and `/users/new` to
confirm none of them is a way in.

## Decisions worth knowing

**PBKDF2-HMAC-SHA256, 210,000 iterations.** Argon2id would be the better choice
and is not available in the Workers runtime; PBKDF2 is the strongest option
there. The iteration count is stored inside each hash
(`pbkdf2$sha256$210000$salt$hash`), so the cost can be raised later and old
records still verify — tested.

**Only the hash of a session token is stored.** A database leak then yields no
usable sessions, for the same reason passwords are not stored either.

**An unknown email and a wrong password are byte-identical responses.** The
handler runs a real verification against a dummy record when no account exists,
so the reply costs the same either way. Anything cheaper answers *"does this
address have an account here?"* — and for a platform where the account list is
a list of people interested in particular scripture, that question is not
harmless. The test asserts the two responses match byte for byte.

**Failures are logged; successes are not.** `login_attempts` exists for
lockout. There is deliberately no table recording who read which passage and
when — see the reasoning about worldview data in
[`10-resonance.md`](10-resonance.md). The same principle applies to reading
logs.

**Lockout after 10 failures in 15 minutes**, counted per email *and* per IP, and
cleared on a successful sign-in so one bad night does not strand a legitimate
user. The lockout message is deliberately distinct from the failure message: the
lockout is not a secret, and a third identical "wrong password" would be
misleading.

**`__Host-` cookie prefix**, with `HttpOnly`, `Secure`, `SameSite=Strict` and no
`Domain`. The browser then refuses the cookie from any other host, which closes
subdomain injection; `SameSite=Strict` is the CSRF defence for the login POST.

**No `?next=` redirect across the login boundary.** Carrying an
attacker-supplied destination through sign-in is how open redirects get built.

**CSP with no remote origin at all.** The built pages are self-contained —
`default-src 'none'`, no external script, style, font or image host in the
policy.

## Changing a password

`/account` asks for the current password, the new one, and a confirmation.

**Requiring the current password is also the CSRF defence** for this route: an
attacker who could forge the request still cannot supply it. `SameSite=Strict`
sits underneath as a second layer.

On success:

- every session for that account is deleted, **including the acting one**;
- the acting browser is immediately issued a **new** token.

So the person changing their password stays signed in, every other browser is
signed out, and the credential in play afterwards is not the one that existed
before. If the change is happening because the old password leaked, leaving the
other sessions alive would defeat the entire exercise.

Any outstanding reset code is also destroyed — a code issued before the change
must not still be able to take the account over afterwards.

`/account/revoke-all` does the session half alone, for "I left myself signed in
somewhere".

## Resetting a forgotten password

**There is no emailed reset link.** An administrator issues a code, delivers it
out of band, and the person types it at `/reset`.

That is not a shortcut around building email. For an invite-only allowlist it is
the better design:

- no email provider, and therefore no third-party secret to hold;
- no *"if that address exists we've sent a mail"* response, which is an
  enumeration oracle however carefully it is worded;
- **no token in a URL**, where `Referer` headers, browser history, bookmarks and
  proxy logs all get a copy. A code that is typed leaves none of those traces.

```bash
npm run user -- --reset --email person@example.org
```

prints the SQL and shows the code once: 100 bits, single use, one hour.
Only its hash is stored, as with sessions and passwords.

Redeeming it sets the password, marks the code spent, and **revokes every
session for the account**. It deliberately does **not** sign the person in — they
must then sign in with the password they just set, which proves they hold it
rather than merely holding a code somebody handed them.

Four properties, each tested:

- **Single use.** A spent code is refused, and the row records *when* it was
  spent rather than vanishing.
- **Bound to one account.** A code for one person cannot be redeemed against
  another's address.
- **A typo does not burn it.** The new password and its confirmation are checked
  *before* the code is spent, so a mistyped confirmation does not cost a second
  trip to the administrator.
- **Same throttling as login.** Bad codes count towards the same lockout, and
  an unknown address and a wrong code produce the same response.

## Structure first, SSO after

The schema separates *who someone is* from *how they prove it*:

```
users        ── the person: id, email, display name, status
identities   ── one way of proving you are them:
                (user_id, provider, subject, secret)
                provider ∈ password | google | github | oidc
```

Today the only provider is `password`. Adding Google or an OIDC provider later
is **an extra `identities` row per person**, not a migration of `users` — and a
person can hold both, so SSO can be introduced without cutting anyone off. That
is the whole reason for the join table; a `password_hash` column on `users`
would have been simpler today and a rewrite later.

When SSO arrives, the parts that change are the login route and a new callback
route. Sessions, cookies, lockout, revocation and the gate itself are already
provider-agnostic.

## Deploying automatically

**The chosen path is Cloudflare Workers Builds**, the Git integration:
Cloudflare pulls the repository itself, runs the build, and deploys on every
push. **No API token exists anywhere** — not in this repository, not in a GitHub
Actions secret, not handed to anyone. That is why it is preferred over the
workflow described below, which cannot work without a token existing.

`wrangler.toml` is at the repository root because Workers Builds looks there by
default.

**The build command must be set in the dashboard, not in `wrangler.toml`.**
Cloudflare's documentation is explicit: *"Workers Builds does not honor the
configurations set in Custom Builds within your Wrangler configuration file."*
A `[build]` section in the config is honoured by a local `wrangler deploy` and
**ignored** by Workers Builds, so relying on it means `web/` is never built —
and because `web/` is generated and untracked, that is a deploy with no assets
at all. There is deliberately no `[build]` section in this repository, so
nothing there can be mistaken for a working build step.

Set **one** of these in Settings → Build:

| Field | Value |
|---|---|
| Build command | `npm run reader && npm run status` |

or, equivalently, point the deploy commands at scripts that build first:

| Field | Value |
|---|---|
| Deploy command | `npm run deploy` |
| Version command | `npm run deploy:preview` |

Either way the build runs `npm run status`, which runs the whole test suite and
the deploy preflight and exits non-zero on failure — so **a red suite or a
broken deploy config fails the deploy** rather than shipping.

### Already provisioned

| | |
|---|---|
| Worker | `con001` |
| D1 database | `con001-access` (`781433b9-…`), schema applied |
| First account | seeded, active, password identity |

### Connected already

The repository is connected: `DanielQueirogaFerreira/con001`, root directory
`/`, deploy `npx wrangler deploy`, version `npx wrangler versions upload`,
non-production branch builds enabled, and Cloudflare holds its own build token
(`con001 build token`) — which is why no API token needs to exist in this
repository or in GitHub.

Two settings still need attention:

1. **Build command is empty.** See above; without it nothing builds.
2. **Production branch is `main`, which does not exist in this repository.** The
   default branch is `claude/layered-text-interpretation-7kn6jd`. Production
   builds therefore never fire. Pushes to the working branch do produce
   *preview versions* via `wrangler versions upload`, and a preview version is
   **not** promoted to production — so the live Worker keeps serving whatever
   was deployed last until a production branch exists or a version is promoted.

### Certifying a deployment

`npm run verify -- https://<the deployed url>` asks the running site, without
credentials, for the things that must not be there:

- the root redirects to `/login`
- `reader.html`, `status.html` and `index.html` are **not** served directly —
  this is the check that fails if the Worker is not running first
- the login page exists, asks for a password, and offers no registration link
- the security headers are present and the CSP names no remote origin
- a bad sign-in returns 401, sets no cookie, and does not reveal whether the
  account exists
- `/healthz` returns exactly `ok` and nothing else

Preflight checks the configuration before a deploy; this checks the running
thing after one. Both exist because the failure they guard against is silent:
a deploy with the gate disabled succeeds, looks healthy, and serves every page
to anyone.

### Preflight

`npm run preflight` checks what a deploy needs and, importantly, what fails
*silently*: `run_worker_first` is one line, and dropping it makes the asset
server answer before the login gate — every page becomes public and nothing
reports an error. Preflight fails the build instead.

### Fallback: GitHub Actions

`.github/workflows/publish.yml` deploys from CI instead. It needs a
`CLOUDFLARE_API_TOKEN` repository secret scoped to *Edit Cloudflare Workers*
and nothing else, refuses without it, refuses without a typed `DEPLOY`, and
refuses while `wrangler.toml` holds a placeholder id. Use it only if deploys
must be driven from GitHub; the Git integration is safer because there is no
token to leak.

### Adding people

```bash
npm run user -- --email you@example.org --name "Your Name" --generate
npm run user -- --reset --email you@example.org
```

Both print SQL. Apply it with `npx wrangler d1 execute con001-access --remote
--command "<sql>"`. Send credentials over a **different channel** than the URL.

## Still to do

- **A session *list*.** `/account` shows a count and can revoke all; it cannot
  show you which devices, when, or from where. The data is in the table.
- **Audit trail for grants and resets.** `npm run user` prints SQL so the act is
  reviewable, but nothing records who ran it or when.
- **Expired-row cleanup.** Nothing sweeps spent reset codes, dead sessions or old
  `login_attempts`. Harmless at this scale, and a cron trigger later.
- **SSO.** The schema is ready; the routes are not.
