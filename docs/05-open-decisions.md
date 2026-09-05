# 05 — Open Decisions

Decisions I made on my own, and decisions that are genuinely yours.

## Made here (reversible, but reasoned — see the linked docs)

| Decision | Chosen | Why |
|---|---|---|
| East Asian book | **Analects** | Zhu Xi's commentary was the examination curriculum of four countries for six centuries — layered interpretation as civilisational infrastructure. Dao De Jing is the alternative and belongs in slot five. [`03`](03-corpus.md) |
| Indian book | **Bhagavad Gītā** | Śaṅkara / Tilak / Gandhi on the same twelve words is the product thesis in one screen. [`03`](03-corpus.md) |
| Build order | **Gītā → Analects → Qur'ān → Bible** | Build against the hardest constraints while changing them is still cheap. The Bible last, precisely because it is the most familiar. [`03`](03-corpus.md) |
| Anchoring | **Canonical Reference (mandatory) + Span (optional)** | The only scheme that survives translation switching and joins to the existing commentary corpus. [`01`](01-anchoring.md) |
| Default visibility | **Private** | A first reading is a vulnerable thing. [`02`](02-layers.md) |
| Anonymous public interpretation | **Not permitted** | Attribution is the substrate; without it the layer stack means nothing. [`04`](04-generative.md) |
| Machine layers | **Opt-in, separately registered, never in the tradition's register** | The value collapses to zero the moment a reader cannot tell them apart. [`02`](02-layers.md) |

## Yours to decide

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
5. **Four traditions means four sets of expectations you can violate without noticing.** This is why the advisory groups are a technical dependency, not a PR exercise.
