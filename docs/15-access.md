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

## Deploying

Nothing here needs a credential in the repository, and none should ever be
pasted into a chat.

```bash
npm run reader && npm run status                 # build the assets
npx wrangler login                               # browser OAuth, no token to store
npx wrangler d1 create open-hermeneutics         # once — put the id in wrangler.toml
npx wrangler d1 execute open-hermeneutics --remote --file worker/schema.sql
npx wrangler deploy --config worker/wrangler.toml
```

Then add the first person:

```bash
npm run user -- --email you@example.org --name "Your Name" --generate
npx wrangler d1 execute open-hermeneutics --remote --command "<the SQL it printed>"
```

Send the credential over a **different channel** than the URL, and have them
change it after first sign-in.

For CI deploys, `CLOUDFLARE_API_TOKEN` goes in a GitHub Actions secret, scoped
to *Edit Cloudflare Workers* and nothing else. `publish.yml` refuses to run
without it, refuses without a typed `DEPLOY`, and refuses while
`wrangler.toml` still holds a placeholder database id.

## Still to do

- **A session *list*.** `/account` shows a count and can revoke all; it cannot
  show you which devices, when, or from where. The data is in the table.
- **Audit trail for grants and resets.** `npm run user` prints SQL so the act is
  reviewable, but nothing records who ran it or when.
- **Expired-row cleanup.** Nothing sweeps spent reset codes, dead sessions or old
  `login_attempts`. Harmless at this scale, and a cron trigger later.
- **SSO.** The schema is ready; the routes are not.
