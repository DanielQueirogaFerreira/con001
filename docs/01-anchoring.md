# 01 — Anchoring

> This is the document that matters. Every other decision here can be revised
> later. This one cannot: an anchoring scheme chosen badly cannot be migrated
> without losing every annotation ever made in it.

## The problem, stated precisely

A reader highlights three words in John 1:1 in the King James Version and writes
a note. Then they switch to the Greek. Then to a Portuguese translation. Then we
correct a typo in the KJV edition text.

**Where is their note?**

The naive answer — store character offsets — fails immediately and completely.
Offsets into the KJV mean nothing in the Greek. They mean nothing in Portuguese.
They shift by one when the typo is fixed. Every annotation in the system silently
lands in the wrong place, and nobody notices until a reader sees a note about
*logos* attached to the word "the".

The second naive answer — store the quoted string and search for it — fails for a
different reason: "and" appears 51,000 times in the KJV.

Meanwhile the entire public-domain commentary corpus we want to import — Matthew
Henry, Ibn Kathīr, Śaṅkara, Zhu Xi — is anchored at **verse** granularity and has
been for centuries. It has no character offsets and never will.

So the anchoring scheme has to do two incompatible things at once: carry
character-level precision, and be portable across editions and languages.

## The answer: two-level addressing

Every anchor has **two parts**. One is mandatory and portable. The other is
optional and precise.

```
                     ┌─────────────────────────────────────┐
   MANDATORY  ──────▶│ Canonical Reference   "gita:2.47"   │  edition-independent
                     │                                     │  centuries old
                     │  ┌───────────────────────────────┐  │  the join key
   OPTIONAL   ──────▶│  │ Span  (within one edition)    │  │
                     │  │  origin, offsets, exact text, │  │  character-precise
                     │  │  prefix/suffix context        │  │  edition-bound
                     │  └───────────────────────────────┘  │
                     └─────────────────────────────────────┘
```

### Part 1 — the Canonical Reference (CR)

The address the tradition already invented and has maintained for centuries.

| Work | CR grammar | Example | Units |
|------|-----------|---------|-------|
| Bible | `bible:BOOK.chapter.verse` (USFM book codes) | `bible:JHN.1.1` | 31,102 |
| Qur'ān | `quran:sura:ayah` | `quran:2:255` | 6,236 |
| Gītā | `gita:chapter.verse` | `gita:2.47` | 700 |
| Analects | `analects:book.chapter` | `analects:1.1` | 512 |

The CR is:

- **stable across every edition and translation of that work**, because these
  reference systems were designed precisely to survive translation;
- **already the anchor of the received commentary corpus**, so importing Ibn
  Kathīr is a join, not an alignment problem;
- **older than the project and outliving it** — CR-anchored data is portable to
  any other system, which is the honest test of a good identifier.

**An anchor without a CR is invalid.** The schema enforces this. This single rule
is what guarantees principle 5 in [`00-point-of-view.md`](00-point-of-view.md):
no interpretation can ever be orphaned, because the worst case is that it
degrades to "attached to this verse", which is exactly where the tradition's own
commentary sits.

Ranges use `cr` + `cr_end` (`gita:2.47` → `gita:2.53`). Sub-verse structure that
some traditions need (Qur'ānic *waqf* stops, Hebrew *atnach* clause division) is
handled as an optional third CR level, not by abandoning the CR.

### Part 2 — the Span

Character precision *within* one unit of one named edition.

```json
"span": {
  "origin": "ed:gita.sa.wikisource",
  "start": 22,
  "end": 42,
  "exact": "मा फलेषु कदाचन",
  "prefix": "कर्मण्येवाधिकारस्ते ",
  "suffix": "। मा कर्मफलहेतुर्भू",
  "grapheme_aligned": true
}
```

- Offsets are **Unicode codepoint offsets into the NFC-normalised stored text of
  that unit in that edition**. Not bytes, not UTF-16 code units, not "characters"
  left undefined. Every edition declares its normalisation form; the loader
  enforces it.
- `exact` / `prefix` / `suffix` are a redundant quote selector (the W3C Web
  Annotation `TextQuoteSelector` pattern). If the edition text is ever corrected
  and the offsets shift, the span is re-found by quote match. If the quote match
  also fails, the anchor degrades to the CR and the reader is told it moved.
- `grapheme_aligned: true` snaps the span to extended grapheme cluster
  boundaries. **This is not a detail.** In pointed Hebrew, the *bet* of
  בְּרֵאשִׁית is `U+05D1` followed by combining `U+05B0` and dagesh; in Arabic,
  a letter and its ḥarakāt are separate codepoints. A "letter-level" annotation
  that splits a consonant from its vowel point produces mojibake on screen and is
  an act of textual vandalism in both traditions. Letter spans include their
  combining marks by default.

### Part 3 — Projection between editions

When a reader with a span made on the Sanskrit switches to Telang's English, we
must place the highlight. Because the CR has already pinned us to **one verse**,
this is a bounded alignment over ~20 words, not a document-scale problem.

```
  ed:gita.sa          gita:2.47          ed:gita.en.telang
  ──────────────  ◀── same CR ──▶  ──────────────────────
  मा फलेषु कदाचन                    nor let thy attachment be to inaction
       │                                          │
       └────────── token alignment ───────────────┘
                    confidence: 0.62
```

Rules that make this safe:

1. **Projections are cache, never truth.** They are recomputable, they are
   versioned by the alignment model that produced them, and deleting the whole
   projection cache loses nothing.
2. **Every projection carries a confidence.** Below the display threshold the
   span is not drawn at all — the annotation shows against the whole verse
   instead, with a marker saying the precise span exists in the origin edition.
   **Silently drawing a low-confidence projection is the single worst thing this
   system could do**, because it puts words in a commentator's mouth.
3. **Projection never rewrites the stored anchor.** The origin span is immutable;
   projections live in a separate cache keyed by target edition.
4. Original-language editions are the preferred projection hub. A span made on
   one English translation projects to another *through* the Greek or Sanskrit,
   not directly, because the source language is the only shared ground.

## Why letter-level is not a gimmick

The requirement for letter-granular annotation did not come from wanting a
feature. It came from the texts. All four traditions already annotate at that
level and have for over a millennium:

- **Qur'ān 2:1** — the *muqaṭṭaʿāt*, the disconnected letters `الم`. Ibn Kathīr
  records a spread of positions on these three letters alone, including that
  their meaning is known only to God. The commentary is *about the letters*,
  individually.
- **Genesis 1:1** — the enlarged *bet* of בְּרֵאשִׁית, one of the *litterae
  majusculae* of the Masoretic scribal tradition. *Bereshit Rabbah* 1:10 reads
  the shape of the single letter — closed on three sides, open forward.
- **Gītā 2:47** — the whole Śaṅkara / Tilak / Gandhi fight turns on the scope of
  two words, `mā phaleṣu`.
- **Analects 1.1** — Zhu Xi glosses the single character 習 as 鳥數飛也, "a bird
  beating its wings repeatedly", and that one-character gloss shaped how six
  centuries of examination candidates understood learning.

A system that can only annotate whole verses cannot represent what these
traditions actually say. Letter granularity is a **requirement inherited from the
sources**, and the span architecture exists to serve it.

## Worked example: the same anchor at five granularities

All five are valid; all five carry the same CR; all five survive translation
switching.

| Granularity | CR | Span |
|---|---|---|
| Chapter | `gita:2.1` → `gita:2.72` | none |
| Verse | `gita:2.47` | none |
| Phrase | `gita:2.47` | `मा फलेषु कदाचन` |
| Word | `analects:1.1` | `習` |
| Letter | `quran:2:1` | `ل` (with its ḥarakāt) |

Real instances of each are in [`data/interpretations/`](../data/interpretations/)
and are checked by `node tools/validate.mjs`.

## What we deliberately did not do

- **CFI / XPointer into a rendered document.** Binds annotations to a rendering,
  which is the thing most likely to change.
- **Embedding-similarity anchoring.** Non-deterministic, unauditable, and a
  reader must be able to know exactly what their note is attached to.
- **A new universal verse identifier of our own design.** The traditions already
  solved this. Inventing a ninth standard would strand us from every existing
  commentary corpus, which is the entire asset.
