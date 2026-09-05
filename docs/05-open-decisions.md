# 05 — Open Decisions

Decisions I made on my own, and decisions that are genuinely yours.

## Made here (reversible, but reasoned — see the linked docs)

| Decision | Chosen | Why |
|---|---|---|
| East Asian books | **Analects + Dao De Jing** | Confirmed: both. The second is the opposition, not a duplicate, and it carries the best manuscript-variant material in existence. [`03`](03-corpus.md) |
| Indian books | **Bhagavad Gītā + Principal Upaniṣads** | Confirmed: both. Īśā 1 hosts the same dispute as Gītā 2.47 between the same two positions — the clearest argument for holding pairs. [`03`](03-corpus.md) |
| Build order | **Gītā → Dao De Jing → Analects → Upaniṣads → Qur'ān → Bible** | Build against the hardest constraints while changing them is still cheap. The Dao De Jing promoted to second: 81 chapters is the cheapest way to build variant machinery every later work needs. [`03`](03-corpus.md) |
| Popularity ranking | **Two axes, never blended, plus a diversity floor** | A single relevance score turns into a majority vote on meaning within a year. [`06`](06-salience.md) |
| Engagement storage | **Outside the interpretation** | A reading must never carry its own popularity as though it were part of what it says. [`06`](06-salience.md) |
| Text integrity | **Nothing displays unless `verified`** | Every sample passage here was hand-entered and is marked unverified. [`09`](09-ingestion.md) |
| Seventh work | **Dhammapada** | Buddhism was the largest gap, and it is the ideal resonance-map test: shared ethics, contradictory metaphysics. [`03`](03-corpus.md) |
| Cross-tradition comparison | **Positions on questions, never traditions** | "How aligned is Christianity with Buddhism" has no answer; any number produced for it is fabricated. [`10`](10-resonance.md) |
| Worldview profiles | **Client-side only, never stored** | Inferred religious belief is special-category data and, in some countries, dangerous to hold. [`10`](10-resonance.md) |
| Guardrails | **Rails on assertion, rooms around expression** | Different regimes: the system speaking for a tradition is gated hard, a person speaking for themselves is not. [`11`](11-guardrails.md) |
| Anchoring | **Canonical Reference (mandatory) + Span (optional)** | The only scheme that survives translation switching and joins to the existing commentary corpus. [`01`](01-anchoring.md) |
| Default visibility | **Private** | A first reading is a vulnerable thing. [`02`](02-layers.md) |
| Anonymous public interpretation | **Not permitted** | Attribution is the substrate; without it the layer stack means nothing. [`04`](04-generative.md) |
| Machine layers | **Opt-in, separately registered, never in the tradition's register** | The value collapses to zero the moment a reader cannot tell them apart. [`02`](02-layers.md) |

## Settled by you, now implemented

- **Open source.** Taken as decided. The four-licence split and its reasoning are
  in [`LICENSING.md`](../LICENSING.md) and [`08`](08-open-source-and-cost.md).
- **Philanthropic, church-backed, not profit-seeking.** This shapes the cost
  architecture (nothing calls a model when a reader turns a page; the corpus is
  static and nearly free to serve) and the governance model (per-corpus
  stewardship, no CLA).
- **Both Chinese, both Indian.** Six works, all specified and seeded.

## Yours to decide

### 0. Settled — seven works locked

- **Work eight (Gurū Granth Sāhib): held for Version 2**, after the advisory
  framework is stable and a Sikh advisory group is seated. Recorded in
  [`03`](03-corpus.md).
- **Licences committed** — AGPL-3.0, CC BY-SA 4.0, CC0, and a public-domain
  statement for source texts, under *Copyright (c) 2026 The Open Hermeneutics
  Project Contributors*. See [`LICENSING.md`](../LICENSING.md).
- **The advisory gate is staged by target**: warns in development, refuses the
  production build. See [`11`](11-guardrails.md).

### 0b. The one thing still blocking production

**Seat the advisory groups.** `npm run build:prod` currently refuses, naming
three high-consequence items awaiting Hindu and Buddhist sign-off. That is the
gate working. Until people exist, production either ships without those items
(`--hold-excluded`, which names them in the manifest) or does not ship.

Also still open: **where copyright sits.** The notice names contributors, which
is fine for now, but it is not a legal entity — and dual-licensing, donations
and liability all need one.

### 0b. Confirm the licences

`LICENSE` files are deliberately **not** in the repository yet. AGPL-3.0 for
code, CC BY-SA 4.0 for the corpus, CC0 for anchoring data — reasoning in
[`LICENSING.md`](../LICENSING.md). An AGPL release cannot be quietly walked
back, so this needs your explicit yes. It also needs a decision about **where
copyright sits** (church body, foundation, or a fiscal host like Software
Freedom Conservancy), because dual-licensing later is impossible without one.

### 1. What is the product, actually?

Three viable shapes, and they lead to different code:

- **A reader.** The layered reading surface, done extremely well, for people who already read these texts. Smallest, sharpest, most likely to be loved.
- **A platform.** Reader plus a publishing system for institutions — seminaries, madrasas, universities — to publish their own layers. Larger, slower, needs institutional sales.
- **A corpus.** The open, CR-anchored, machine-readable interpretation dataset, with a reference reader on top. The reader is then a demonstration and the dataset is the asset.

These are not mutually exclusive in the long run, but the first eighteen months look completely different. **My recommendation: build the reader, structure the data as if it were the corpus.** That costs almost nothing now and keeps the second and third options open.

### 2. Who are the first hundred readers?

The answer changes the first release more than any technical choice. A seminary study group, a comparative-religion course, and curious general readers want three different first screens. **Pick one and disappoint the other two on purpose.**

### 3. What is the relationship to the traditions?

Options: (a) build it and see who comes; (b) recruit a scholarly advisory group per corpus before launch; (c) partner with one institution per tradition.

**Recommendation: (b), and early.** It costs months and buys the thing money cannot: the standing to publish a Qur'ān interface at all. It also produces better policy than any of us would write alone — the orthography, labelling and generation rules in [`04`](04-generative.md) are a first draft that needs review from inside each tradition, not a finished artefact.

### 4. Is there a fifth work — and is one of them not scripture?

A strong argument exists for adding a **secular** work with a deep commentary tradition — a legal constitution, or Shakespeare with its variorum apparatus. It would prove the architecture is about *layered reading* rather than about religion, and it would give sceptical readers a door in. It also dilutes focus. Not now, but worth deciding before the architecture hardens further.

### 5. Business model

Deliberately unaddressed here, but it constrains everything above. The awkward truth: the most valuable asset is the accumulated public interpretation corpus, and the most defensible position is to make that corpus open and monetise the reading experience. Deciding this late tends to corrupt the data model.

## Known risks, stated plainly

1. **Commentary translation licensing is the real bottleneck.** The 14th-century tafsīr is free; the readable English translation of it is not. Budget for commissioning fresh translations of PD commentary — that cost is easy to under-forecast by an order of magnitude.
2. **Span projection quality is the product's ceiling.** If highlights land wrongly across editions, the illusion breaks immediately. The confidence threshold and its "this span exists in the original" fallback need real user testing early, not late.
3. **Machine-layer fabrication is an existential risk, not a quality issue.** One AI layer inventing a plausible Śaṅkara quotation, screenshotted and shared, would end the project's credibility permanently. The rule in [`02`](02-layers.md) — no assertion attributed to a source that was not in context — must be enforced mechanically, not by prompt.
4. **Moderating public interpretation of scripture is harder than it looks.** The stance in [`04`](04-generative.md) (host disagreement, remove only misattribution and harassment) is defensible but will be tested by people acting in bad faith on day one.
5. **Six works across five traditions means five sets of expectations you can violate without noticing.** This is why the advisory groups are a technical dependency, not a PR exercise.
6. **A church-funded platform hosting other traditions' scripture will be questioned, publicly and early.** The answer cannot be a statement of good intentions; it has to be structural — per-corpus stewardship held by people inside each tradition, and a published neutrality commitment that is hard to change. Both are specified in [`07`](07-studio.md) and [`08`](08-open-source-and-cost.md), and neither exists until you appoint people.
7. **Popularity data is a liability as well as an asset.** Reading records on scripture are sensitive in ways that reading records on most things are not — in some jurisdictions and for some communities, dangerous. Aggregate early, retain little, and decide the retention policy before collecting rather than after.
