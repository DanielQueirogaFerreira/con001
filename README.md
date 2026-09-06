# con001 — A Layered Reader for Contested Texts

**The idea in one sentence:** take the books that have been read and re-read for
two thousand years, put the received commentary tradition back *beside* the text
where it used to live, and let a reader turn layers on and off — including their
own.

Not a Bible app. Not a study tool with fixed notes. A **reading surface** where
interpretation is a first-class, addressable, forkable, shareable object, and
where the reader controls which readings are in front of them.

## What a reader can do

1. Read a text in one or several editions side by side (original language, one or
   more translations).
2. Choose **layers** of interpretation — traditional commentary, philology,
   history, devotional, critical, other readers, their own.
3. Anchor a new interpretation at **any granularity**: a whole chapter, a
   paragraph, a verse, a phrase, a single word, a single letter.
4. Keep it private, share it with a group, or publish it.
5. Fork someone else's interpretation and answer it.
6. Save the whole configuration as a **lens** and hand that lens to someone else.
7. Generate images or video from a passage *as read through a chosen lens* —
   and have the result carry the lens with it, so the rendering is attributable
   to a reading rather than floating free.

## The seven books

Chinese and Indian thought are each held as a pair, so the corpus contains their
internal argument rather than one side of it.

| # | Work | Tradition | Why this one |
|---|------|-----------|--------------|
| 1 | **Bible** | Jewish / Christian | The largest continuous commentary tradition in existence, in two source languages. |
| 2 | **Qur'ān** | Islamic | A tradition where the relationship between text, recitation and translation is itself doctrine — it forces the architecture to be honest. |
| 3 | **Analects (論語)** | Confucian | Zhu Xi's commentary *was* the civil-service curriculum of China, Korea, Japan and Vietnam for six centuries. Layered interpretation as state infrastructure. |
| 4 | **Dao De Jing (道德經)** | Daoist | The Confucian–Daoist argument, and the best manuscript-variant material in existence: 常 for 恆 in the received text, changed by an emperor's naming taboo and inherited silently by every translation since. |
| 5 | **Bhagavad Gītā** | Hindu | 700 verses, and Śaṅkara, Rāmānuja, Madhva, Tilak and Gandhi read them into five incompatible programs. The clearest proof of the product thesis. |
| 6 | **Principal Upaniṣads** | Hindu | The source the Gītā argues from. Īśā 1 hosts the *same* dispute as Gītā 2.47, between the same two positions — computable, because stance is a first-class field. |
| 7 | **Dhammapada** | Buddhist | Closes the largest gap in the corpus. Shares surface ethics with the Analects and the Gītā while contradicting both metaphysically — the ideal test of whether the resonance map can show agreement and contradiction at once. |

Full reasoning, alternatives considered, and source/licence notes: [`docs/03-corpus.md`](docs/03-corpus.md).

## Documents

- [`docs/00-point-of-view.md`](docs/00-point-of-view.md) — the thesis and the principles that constrain everything else
- [`docs/01-anchoring.md`](docs/01-anchoring.md) — **the core technical problem** and the answer
- [`docs/02-layers.md`](docs/02-layers.md) — what a layer is, the layer kinds, forking, visibility
- [`docs/03-corpus.md`](docs/03-corpus.md) — the six books, sources, licences
- [`docs/04-generative.md`](docs/04-generative.md) — images and video, and the boundaries per tradition
- [`docs/05-open-decisions.md`](docs/05-open-decisions.md) — what still needs a human decision
- [`docs/06-salience.md`](docs/06-salience.md) — **popularity without a majority vote on meaning**, the long tail, and mapping contestation
- [`docs/07-studio.md`](docs/07-studio.md) — the authoring and curation surface
- [`docs/08-open-source-and-cost.md`](docs/08-open-source-and-cost.md) — licensing, running cost, governance
- [`docs/09-ingestion.md`](docs/09-ingestion.md) — text integrity: why no sample text here is marked verified
- [`docs/10-resonance.md`](docs/10-resonance.md) — **the alignment map**: comparing positions on questions, never traditions, and where a reader's worldview profile lives
- [`docs/11-guardrails.md`](docs/11-guardrails.md) — thresholds, consequence tiers, the staging rule, and the line between the platform asserting and a person expressing
- [`docs/12-reader-prototype.md`](docs/12-reader-prototype.md) — the Reader / Studio prototype and what it demonstrates
- [`docs/13-studio-compiler.md`](docs/13-studio-compiler.md) — the prompt compiler, and why it refuses to merge contending readings
- [`docs/14-loop.md`](docs/14-loop.md) — versioning, the status page, and the evaluate → prompt cycle
- [`docs/15-access.md`](docs/15-access.md) — the private alpha: email/password on a Cloudflare Worker, and the path to SSO
- [`advisory/README.md`](advisory/README.md) — scholar sign-off, managed in git
- [`evaluations/README.md`](evaluations/README.md) — how a team member files a UI finding
- [`CHANGELOG.md`](CHANGELOG.md) — what shipped in each build
- [`LICENSING.md`](LICENSING.md) — the four-licence split, awaiting confirmation

## Repository layout

```
schema/     JSON Schema for every core entity
data/       Worked samples — real passages, real commentators, all seven books
tools/      validate, salience, resonance, the builds, and their tests
web/        built artefacts — reader.html and status.html (generated, not tracked)
worker/     the Cloudflare Worker that serves the site behind a login
docs/       The specification
```

`web/` and `dist/` are **generated and untracked**. Run `npm run reader` and
`npm run status` to produce them, or take them from a CI run. They embed the
commit they were built from, so committing them would mean embedding a sha that
does not exist yet — and every rebuild would dirty the tree, making the `.dirty`
warning on the build id meaningless.

Licensed in four parts — AGPL-3.0 for code, CC BY-SA 4.0 for the interpretation
corpus, CC0 for anchoring data, nothing claimed over source texts. See
[`LICENSING.md`](LICENSING.md) and [`COPYRIGHT`](COPYRIGHT).

Validate the samples, then check that the validator actually rejects broken data:

```
npm test
```

See where the tradition argues and where the readers are:

```
npm run salience
```

See where traditions answer the same question, and where a reader stands:

```
npm run resonance
```

Build the Reader / Studio prototype, then open `web/reader.html`:

```
npm run reader
```

See where the construction actually stands — every figure computed from the
repo, nothing hand-maintained:

```
npm run status        # builds web/status.html
npm run version       # the build id everything is stamped with
npm run next-prompt   # compiles open team findings into the next prompt
```

Build for production — this **refuses** while any high-consequence claim is
still awaiting advisory sign-off:

```
npm run build:prod
```

No dependencies — the schema checker and the integrity checks are plain Node.
`tools/validate.mjs` verifies that every span's stored offsets really do select
its quoted text, that no letter span splits a consonant from its combining
marks, that no fork points at a missing parent, and that machine-authored
readings never occupy the register of the tradition.
`tools/test-validate.mjs` breaks each of those invariants in turn and asserts
that validation fails.

## Two measures, never merged

Popularity ranking on scripture, left alone, becomes a majority vote on meaning:
the mainstream reading gets shown, so it gets read, so it ranks higher. Within a
year the minority reading is functionally deleted — not by anyone's decision, but
by a sort order.

So the system computes two independent numbers and never blends them:

- **Popularity** — what readers actually read. Normalised within a work, never
  across traditions.
- **Contestation** — how much the received tradition disagrees at this anchor.
  Entropy over the canonically-weighted spread of stances, plus explicit
  rebuttals from the fork graph.

They rank differently, and that is the point. John 3:16 is the most-read verse in
the seed corpus and scores **zero** contestation. Īśā 1 is read by a fraction as
many people and is the most contested anchor in the system. A single "relevance"
score would have hidden both facts.

Plus a hard **diversity floor**: whatever the ranking says, every anchor must
also carry a reading from outside the leading stance. Details and the failure
modes it guards against: [`docs/06-salience.md`](docs/06-salience.md).

## Aligned where? Comparing positions, not religions

The platform's most delicate feature is showing a reader where their view sits
across traditions. It has two failure modes, and the naive implementation —
embed the texts, show what is close — produces both:

- **Syncretism**: claiming two texts mean the same thing, erasing distinctions
  every tradition here fought over.
- **Manufactured conflict**: claiming traditions oppose each other, handing
  sectarians a citable machine.

So the unit of comparison is never a tradition. It is a **question** with an
axis, and the things placed on it are specific readings by named commentators,
each anchored to a passage you can open.

```
q:act-and-outcome — Is the rightness of an act independent of what it yields?

    ··············●······  0.72  hindu      Tilak
    ················●····  0.78  confucian  Zhu Xi
    ················●····  0.80  buddhist   Buddhaghosa
    ·················●···  0.85  hindu      Śaṅkara
    ··················●··  0.92  hindu      Gandhi

    internal spread, hindu: 0.72–0.92 across 3 readings
```

Zhu Xi is closer to Buddhaghosa than Tilak is to Gandhi. That is what the data
says, and it makes "one tradition against another" a sentence this system cannot
produce.

Four rules, all with tests:

1. **A resonance never displays without the internal spread of its traditions** —
   disagreement *within* is always as visible as disagreement *between*.
2. **Every agreement must record what it hides.** `divergence` is required even on
   resonances that record agreement. An agreement concealing nothing is
   syncretism, and it does not ship.
3. **The claim vocabulary is closed** — `answers-similarly`,
   `answers-oppositely`, `shares-question-only`. There is no field in which the
   system can say two traditions agree, and no confidence score unlocks one.
   Manufactured opposition is rejected as firmly as manufactured agreement.
4. **The reader's worldview profile never leaves their device.** Inferred
   religious belief is special-category data, and in many countries the kind of
   record that gets people hurt. It reports proximity to *positions*, never
   affiliation to a tradition — the system never tells anyone what they are — and
   always offers the strongest reading *against* where they stand.

## The prototype

`npm run reader` builds a self-contained `web/reader.html` — corpus inlined, no
server, no dependencies. Three things are demonstrable by hand:

- **The layered view.** Source and translation stacked, every active layer's span
  highlighted in the text. Qur'ān translations labelled *interpretation of the
  meaning*. Machine layer off by default and visually distinct.
- **The contestation slider.** Left end: the leading reading alone. Moving right
  admits dissenting stances in order of distance from it. On Gītā 2.47 that is
  four voices collapsing to one and back; on John 3:16 there is nothing to open
  onto, and it says so. The diversity floor keeps the majority reading from ever
  standing alone.
- **The Director Lens Hook.** Active layers compose a visual directive — register,
  motifs, and what each reading positively *excludes*. Conflicts are surfaced from
  the fork graph, not resolved: *"Tilak rebuts Śaṅkara: directs 'kinetic, engaged,
  unmistakably in the world' where Śaṅkara directs 'interior, withdrawn'."* An
  image that splits the difference represents no reading at all. On `quran:2:1`
  the figural block appears in the directive itself, before generation.

Driven in Chromium and checked: five anchors render, Devanāgarī and Arabic
display correctly, Arabic is RTL, the slider works, the block fires, no console
errors.

## The advisory gate

A claim never carries its own approval. It carries a **reference to an RFC**
anyone can open and read — `advisory/rfc/NNN-slug.md`, one markdown file whose
human argument is the document and whose machine-readable record is a fenced
` ```json record ` block, so the two cannot drift.

| Target | High-tier claim awaiting sign-off |
|---|---|
| `npm test`, `npm run resonance` | Structured warning table; schema and integrity pass |
| `npm run build:prod` | **Build refused** — cannot reach the production CDN |
| `npm run build:alpha` | Ships without it, named in `dist/manifest.json` |

Six things do not count as a sign-off, all tested: a placeholder containing
"pending"; a reference to an RFC that does not exist; one that is not
`approved`; one that does not cover this claim; one missing a seat the question
requires; and one with a standing objection.

**`advisory/rfc/001-anatta-vs-atman.md` is open with zero sign-offs**, which is
the honest state — no advisory groups are seated, and no scholar approval has
been invented to unblock a build. The approved path is proven by fixtures inside
`tools/test-advisory.mjs`, where they are obviously fixtures.

## Alpha release

`npm run build:alpha` ships the production bundle without the held items and
names them in `dist/manifest.json`, which doubles as the public transparency log
and the **scholar recruitment agenda** — each held claim carries the RFC that
would clear it, the seats it needs, and the document a prospective reviewer can
read.

> Note: `npm run build:prod --hold-excluded` does **not** work — npm swallows the
> flag as its own config. Use `npm run build:alpha`, or
> `npm run build:prod -- --hold-excluded`.

## Access — the alpha is private

GitHub holds the source and runs CI; a **Cloudflare Worker** serves the built
site and will not serve a byte of it without a session.

Not GitHub Pages: **private Pages requires GitHub Enterprise Cloud**, so on a
personal account Pages can only ever be public. The Worker is better anyway —
the gate is per-person, revocable, and extends to SSO.

The Worker runs *before* static assets (`run_worker_first`), so an
unauthenticated request never touches the asset binding — there is a test
asserting exactly that. Other decisions worth knowing:

- **PBKDF2-HMAC-SHA256, 210k iterations** — the strongest KDF the Workers
  runtime has. The cost is stored inside each hash so it can be raised later.
- **Only the hash of a session token is stored**, so a database leak yields no
  usable sessions.
- **An unknown email and a wrong password return byte-identical responses** — a
  real verification runs against a dummy record when no account exists. For a
  platform whose account list is a list of people interested in particular
  scripture, "does this address have an account here?" is not a harmless
  question.
- **Failures are logged, successes are not.** There is deliberately no table of
  who read which passage and when.
- No self-registration, `__Host-` cookie, `SameSite=Strict`, no `?next=`
  redirect across the login boundary, CSP with no remote origin.

**SSO later, structure now**: `users` is the person, `identities` is one way of
proving you are them (`password | google | github | oidc`). Adding SSO is an
extra identities row per person, not a migration — and someone can hold both, so
nobody gets cut off. Sessions, lockout and revocation are already
provider-agnostic.

**Rotation and recovery.** `/account` changes a password: it re-authenticates
with the current one (which is also the CSRF defence for that route), then
deletes *every* session including the acting one and issues the acting browser a
fresh token — so you stay signed in, every other browser does not, and the
credential in play afterwards is not the one that leaked.

`/reset` redeems an administrator-issued code. **No emailed link**: no email
provider secret, no *"if that address exists we've sent a mail"* enumeration
oracle, and no token in a URL for `Referer` headers, history and proxy logs to
copy. Codes are 100 bits, single-use, one hour, stored only as a hash; redeeming
one revokes every session and deliberately does *not* sign you in — you then
sign in with the password you just set.

```
npm run user -- --email a@b.org --name "A B" --generate   # invite
npm run user -- --reset --email a@b.org                   # reset code
npm run preflight                                          # is it safe to deploy?
```

The first two print SQL for review rather than writing to the database.

**Deploys are automatic via Cloudflare Workers Builds** — Cloudflare pulls the
repository, runs `npm run reader && npm run status`, and ships on every push.
**No API token exists anywhere**: not in this repository, not in a GitHub secret,
not handed to anyone. `npm run status` runs the full suite plus `preflight` and
exits non-zero on failure, so a red suite or a broken deploy config fails the
deploy rather than shipping.

Preflight guards the failure that is otherwise silent: `run_worker_first` is one
line in `wrangler.toml`, and dropping it makes the asset server answer before the
login gate — every page goes public and nothing reports an error.

## The loop

```
   1 prompt ──▶ 2 build ──▶ 3 evaluation ──▶ 4 compiled prompt ──┐
      ▲                                                           │
      └───────────────────────────────────────────────────────────┘
```

Every build has an id — `0.1.0-alpha.1+d52ed9f`, with `.dirty` when the tree had
uncommitted changes and the build therefore cannot be reproduced. Team
evaluations attach to that id, never to "the UI".

`npm run next-prompt` compiles open findings into one prompt, and adds three
things a human re-typing feedback would drop: **the files that own each area**,
a **stale** flag on findings written against an older build, and **the
constraints that must survive the change** — because a guardrail usually
disappears three cycles later via a reasonable finding, a reasonable change, and
nobody remembering why the rule existed.

A finding needs `observed` and `expected` separately. "The slider feels wrong"
is rejected by the loader as a complaint rather than a finding.

Evaluations are **not** the advisory gate: they queue the next iteration, they
block nothing. Advisory RFCs block the production build. A usability complaint
must never clear a doctrinal gate.

## Status

Specification, data model, and a worked corpus across all seven books. No
application yet — the data model has to be right first, because an anchoring
scheme chosen badly cannot be migrated later without losing every annotation
ever made.

**No source text here is verified.** Every sample passage was hand-entered to
demonstrate the format and is marked `verified: false`. Good enough to prove a
span on the Hebrew *bet* covers three codepoints and not one; not good enough to
show anybody as their scripture. See [`docs/09-ingestion.md`](docs/09-ingestion.md).
