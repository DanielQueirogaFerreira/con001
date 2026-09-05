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

## The six books

Held in pairs. The second work on each side is not a duplicate — it is the
*opposition* to the first, and the corpus holds the argument rather than one
side of it.

| # | Work | Tradition | Why this one |
|---|------|-----------|--------------|
| 1 | **Bible** | Jewish / Christian | The largest continuous commentary tradition in existence, in two source languages. |
| 2 | **Qur'ān** | Islamic | A tradition where the relationship between text, recitation and translation is itself doctrine — it forces the architecture to be honest. |
| 3 | **Analects (論語)** | Confucian | Zhu Xi's commentary *was* the civil-service curriculum of China, Korea, Japan and Vietnam for six centuries. Layered interpretation as state infrastructure. |
| 4 | **Dao De Jing (道德經)** | Daoist | The Confucian–Daoist argument, and the best manuscript-variant material in existence: 常 for 恆 in the received text, changed by an emperor's naming taboo and inherited silently by every translation since. |
| 5 | **Bhagavad Gītā** | Hindu | 700 verses, and Śaṅkara, Rāmānuja, Madhva, Tilak and Gandhi read them into five incompatible programs. The clearest proof of the product thesis. |
| 6 | **Principal Upaniṣads** | Hindu | The source the Gītā argues from. Īśā 1 hosts the *same* dispute as Gītā 2.47, between the same two positions — computable, because stance is a first-class field. |

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
- [`LICENSING.md`](LICENSING.md) — the four-licence split, awaiting confirmation

## Repository layout

```
schema/     JSON Schema for every core entity
data/       Worked samples — real passages, real commentators, all six books
tools/      validate.mjs, salience.mjs, and their tests
docs/       The specification
```

Validate the samples, then check that the validator actually rejects broken data:

```
npm test
```

See where the tradition argues and where the readers are:

```
npm run salience
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

## Status

Specification, data model, and a worked corpus across all six books. No
application yet — the data model has to be right first, because an anchoring
scheme chosen badly cannot be migrated later without losing every annotation
ever made.

**No source text here is verified.** Every sample passage was hand-entered to
demonstrate the format and is marked `verified: false`. Good enough to prove a
span on the Hebrew *bet* covers three codepoints and not one; not good enough to
show anybody as their scripture. See [`docs/09-ingestion.md`](docs/09-ingestion.md).
