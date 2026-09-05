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
- [`docs/11-guardrails.md`](docs/11-guardrails.md) — thresholds, consequence tiers, and the line between the platform asserting and a person expressing
- [`LICENSING.md`](LICENSING.md) — the four-licence split, awaiting confirmation

## Repository layout

```
schema/     JSON Schema for every core entity
data/       Worked samples — real passages, real commentators, all seven books
tools/      validate.mjs, salience.mjs, resonance.mjs, and their tests
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

See where traditions answer the same question, and where a reader stands:

```
npm run resonance
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

## Status

Specification, data model, and a worked corpus across all seven books. No
application yet — the data model has to be right first, because an anchoring
scheme chosen badly cannot be migrated later without losing every annotation
ever made.

**No source text here is verified.** Every sample passage was hand-entered to
demonstrate the format and is marked `verified: false`. Good enough to prove a
span on the Hebrew *bet* covers three codepoints and not one; not good enough to
show anybody as their scripture. See [`docs/09-ingestion.md`](docs/09-ingestion.md).
