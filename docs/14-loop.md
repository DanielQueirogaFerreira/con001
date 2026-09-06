# 14 — Versioning, Status, and the Loop

> "prompt to LLM → UI → UI evaluation for team member → prompt to LLM. cycle back."

That cycle only works if two things are true: every build can be named, and
every piece of feedback can be attached to the build it was seen on. Everything
here follows from those two.

## The build id

```
0.1.0-alpha.1+d52ed9f
0.1.0-alpha.1+d52ed9f.dirty
```

`npm run version` prints it, and it is stamped into every artefact — the reader
header, the status page, `dist/version.json`, `dist/manifest.json`.

`web/` and `dist/` are generated and **not tracked in git**. They embed the
commit they were built from, so committing them would mean embedding a sha that
does not yet exist, and every rebuild would dirty the tree — which would leave
the `.dirty` warning permanently on and therefore meaningless. Build them with
`npm run reader` and `npm run status`, or take them from a CI run.

The `.dirty` suffix is not decoration. It means the working tree had
uncommitted changes, so the build **cannot be reproduced from git** — and an
evaluation written against something nobody can rebuild is not actionable. The
status page says so in a banner rather than letting it pass quietly.

## The loop

```
   1 prompt ──▶ 2 build ──▶ 3 evaluation ──▶ 4 compiled prompt ──┐
      ▲                                                           │
      └───────────────────────────────────────────────────────────┘
```

**1 · prompt** — an instruction to the model, carrying the constraints that must
survive the change.

**2 · build** — `npm run reader`, `npm run status`. Versioned. Circulated.

**3 · evaluation** — a team member writes `evaluations/NNN-slug.md`: same format
as an advisory RFC, one markdown file with a fenced ` ```json record ` block,
reviewed by pull request. A team already learning one review format should not
have to learn two.

**4 · compiled prompt** — `npm run next-prompt` turns every open finding into a
single prompt for the next iteration.

## What makes step 4 worth automating

Not restating what people wrote. Three things the tooling adds that a human
re-typing feedback would drop:

**It locates the finding.** Every `area` maps to the files that own it. A
finding about the contestation slider compiles with `tools/build-reader.mjs →
visible()`, `tools/salience.mjs` and `docs/06-salience.md` attached, plus the
warning that changing that code can silence a minority reading. The next
iteration starts from a located problem instead of an impression.

**It flags stale findings.** A finding written against an older build is marked,
with the reason stated: *a fix for a problem that no longer exists is a new bug.*
Reproduce first.

**It carries the constraints.** Every compiled prompt ends with the guardrails
that hold regardless of what the finding asks for — the base text is never
occluded, machine content is never on by default, the diversity floor stands,
director conflicts come from the fork graph, the compiler does not merge
contending readings, hard blocks have no override, unverified units are never
shown as scripture — and the instruction that breaking any of them is *a
decision for the project lead, not an implementation detail.*

That last item is the one that matters over time. **This is how a guardrail gets
removed by accident three cycles later**: a reasonable finding, a reasonable
change, and nobody in the room remembering why the rule existed. Shipping the
rules with every prompt is cheap insurance against it.

## What a finding must contain

`observed` and `expected`, separately, both required. "The slider feels wrong"
is rejected by the loader as a complaint rather than a finding. The
loader-enforced version reads:

> **observed:** At slider 0 on `gita:2.47`, only Śaṅkara is shown.
> **expected:** The diversity floor should keep one dissenting reading visible.

Which, incidentally, would be a *correct* rejection — the floor is specified to
hold only above zero — and the compiled prompt would surface that from
`docs/06-salience.md` rather than the next iteration quietly "fixing" it.

## The status page

`npm run status` builds `web/status.html`. **Every figure on it is computed from
the repository at build time**: corpus counts from the data, gate state from the
advisory records, test results from actually running the suite. Nothing is
hand-maintained, because a hand-maintained status page lies within a fortnight.

Two deliberate choices:

- **Unfinished work sits in the same table as finished work.** A progress bar
  computed only over completed milestones always reads 100%. Merging them is why
  the page says *12 of 18* rather than *12 of 12*.
- **The banner says 0 of 23 text units are verified.** That is the least
  flattering number in the project and it is on the page in a warning box,
  because it is also the one that blocks advisory review regardless of whether
  scholars are ever seated.

## Evaluations are not the advisory gate

| | Advisory RFC | Evaluation |
|---|---|---|
| Governs | Claims the system makes about traditions | How the UI works |
| Reviewers | Seated scholars, credentials verified | Team members |
| Effect | **Blocks the production build** | Queues the next iteration |

Keeping them apart matters in both directions: a usability complaint must never
be able to clear a doctrinal gate, and a scholar's objection must never be
triaged as a UI nit.

## CI and publishing

`.github/workflows/ci.yml` runs on every push and pull request: tests, the alpha
build, the status page. **It publishes nothing.**

`.github/workflows/publish.yml` deploys to GitHub Pages and is
**`workflow_dispatch` only, with a typed `PUBLISH` confirmation.** There is no
`on: push` trigger. This project publishes readings of other people's scripture;
nothing should go public because someone merged a branch.

CI also asserts the project is still dependency-free, and fails if a dependency
appears. That property was argued for; it should not erode silently.
