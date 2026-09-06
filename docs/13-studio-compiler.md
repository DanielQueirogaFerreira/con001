# 13 — The Studio Prompt Compiler

`tools/prompt-compiler.mjs` is the output side of the Director Lens Hook. It
takes an anchor, the active lenses, and corpus policy, and emits structured
generation payloads.

It is written **dependency-free and import-free** because
`tools/build-reader.mjs` inlines this exact source into `web/reader.html`. One
implementation, tested in Node, executed in the browser — the alternative is two
implementations that drift, and the one in the browser is the one that reaches
readers.

## The rule that shapes everything

**It will not merge contending readings.**

If two active lenses are in recorded opposition — one `rebuts` or `questions`
the other in the fork graph — the compiler emits **one payload per faction** and
refuses to produce a blend.

This is the characteristic failure of prompt-merging. Average Śaṅkara's
"interior, withdrawn" with Tilak's "kinetic, engaged, unmistakably in the world"
and you get a competent image of nothing — the blurry compromise, which
represents no reading and misrepresents both. So the compiler hands the choice
back:

```
These readings are in recorded opposition, so they were not merged.
One payload per reading, and the choice is yours.

  Bāl Gangādhar Tilak rebuts Ādi Śaṅkarācārya — these direct different images.
  Mohandas K. Gandhi rebuts Bāl Gangādhar Tilak — these direct different images.
```

The split is driven by **data, not by wording**. There is a test asserting that
the same three lenses merge into one payload when the oppositions list is empty:
the compiler knows nothing about what Śaṅkara and Tilak *mean*, only what the
fork graph records. Grouping is by non-contradiction, so Śaṅkara and Gandhi
compile together — they are not in direct recorded opposition, and their
positions on `q:act-and-outcome` do sit closer (0.85 and 0.92) than either sits
to Tilak (0.72).

## Order of operations

```
  policy gate  ─▶  faction split  ─▶  negatives win  ─▶  camera  ─▶  payload
  before any        by fork-graph      exclusions       derived      carries
  prompt text       opposition         beat motifs      from the     its lens
  is composed                                           register
```

**1. Policy first.** A prompt you will not run should not be composed. With
`policy.generation === 'blocked'` the compiler returns a refusal that names its
rule and produces no prompt strings at all.

**2. Locked negatives.** A `figural: blocked` corpus does not block generation
outright — it blocks *figural depiction*. So the payload compiles, with four
negatives injected that the caller cannot remove: `any figural depiction`,
`human or divine figures`, `representation of prophets`, `anthropomorphic
imagery`. They surface in the drawer with a lock. Qur'ān 2:1 compiles to a
calligraphic register, flat-on, 1:1, even lighting — which is what the reading
actually directs.

**3. The negative list wins.** A motif one active lens calls for that another
positively excludes is **dropped from the positive prompt**, not argued with, and
reported in `dropped_from_positive`. Exclusions are the sharper statement of a
reading: what a commentator refuses to see in a passage says more than what they
list.

**4. Camera from register.** Keyword tables, not inference, so a curator can read
and correct them. A layer may state `camera`, `aspect` or `lighting` explicitly
and override the derivation.

**5. Determinism.** Identical inputs compile to an identical payload with a
stable `pl:` id, which is what makes rendition caching by `(anchor, lens,
prompt)` work — the same passage under the same lens renders once for everyone,
which is the cost argument in [`08`](08-open-source-and-cost.md).

## Payload shape

```json
{
  "id": "pl:ee1c5789",
  "anchor": "gita:2.47",
  "lenses": ["layer:gita.shankara", "layer:gita.gandhi"],
  "positive": "gita:2.47, as read through Ādi Śaṅkarācārya and Mohandas K. Gandhi, …",
  "negative": ["triumph", "the battle rendered as spectacle", "…"],
  "locked_negative": [],
  "lighting": "diffuse, sourceless, low contrast",
  "camera": "static, long lens, shallow depth",
  "aspect": "4:5",
  "dropped_from_positive": []
}
```

The positive prompt opens with *"as read through …"* rather than the passage
alone. That is not decoration: it is the attribution rule from
[`04`](04-generative.md) carried into the payload itself, so an output cannot be
captioned as the text even if the lens metadata is lost.

## The Studio drawer

In `web/reader.html`, **Open Studio** compiles the current active stack. Clicking
a lens name in the layer stack compiles that lens **alone**, which is the fastest
way to see how much of the image a single reading is deciding.

Each payload card shows positive, negative (locked entries marked), anything
dropped and why, the camera chips, the payload id, and a copy button.

Verified in Chromium: Gītā 2.47 produces two payload cards with the contending
banner; soloing Gandhi produces one; Qur'ān 2:1 shows four locked negatives and
the policy banner; no console errors.

## What it does not do

It does not generate. It emits the payload a generator would receive, together
with its lens and its policy record. Wiring an actual model behind it is a
separate decision that needs the advisory groups seated first — the same gate
that governs claims should govern images made from them.
