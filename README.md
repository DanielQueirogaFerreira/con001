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

## The four books

| # | Work | Tradition | Why this one |
|---|------|-----------|--------------|
| 1 | **Bible** | Jewish / Christian | The largest continuous commentary tradition in existence, in two source languages. |
| 2 | **Qur'ān** | Islamic | A tradition where the relationship between text, recitation, and translation is itself doctrine — it will force the architecture to be honest. |
| 3 | **Analects (論語)** | East Asian | Zhu Xi's commentary *was* the civil-service curriculum of China, Korea, Japan and Vietnam for six centuries. Layered interpretation as state infrastructure. |
| 4 | **Bhagavad Gītā** | Indian | 700 verses, and Śaṅkara, Rāmānuja, Madhva, Tilak and Gandhi read them into five incompatible programs. The clearest proof of the product thesis. |

Full reasoning, alternatives considered, and source/licence notes: [`docs/03-corpus.md`](docs/03-corpus.md).

## Documents

- [`docs/00-point-of-view.md`](docs/00-point-of-view.md) — the thesis and the principles that constrain everything else
- [`docs/01-anchoring.md`](docs/01-anchoring.md) — **the core technical problem** and the answer
- [`docs/02-layers.md`](docs/02-layers.md) — what a layer is, the layer kinds, forking, visibility
- [`docs/03-corpus.md`](docs/03-corpus.md) — the four books, sources, licences
- [`docs/04-generative.md`](docs/04-generative.md) — images and video, and the boundaries per tradition
- [`docs/05-open-decisions.md`](docs/05-open-decisions.md) — what still needs a human decision

## Repository layout

```
schema/     JSON Schema for every core entity
data/       Worked samples — real passages, real commentators, all four books
tools/      validate.mjs — validates the samples against the schema
docs/       The specification
```

Validate the samples, then check that the validator actually rejects broken data:

```
npm test
```

No dependencies — the schema checker and the integrity checks are plain Node.
`tools/validate.mjs` verifies that every span's stored offsets really do select
its quoted text, that no letter span splits a consonant from its combining
marks, that no fork points at a missing parent, and that machine-authored
readings never occupy the register of the tradition.
`tools/test-validate.mjs` breaks each of those invariants in turn and asserts
that validation fails.

## Status

Specification and data model, with worked examples. No application yet — the
data model is the thing that has to be right first, because an anchoring scheme
chosen badly cannot be migrated later without losing every annotation ever made.
