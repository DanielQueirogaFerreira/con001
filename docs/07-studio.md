# 07 — The Studio

> "Create a kind of studio to host books, those text correlations with
> interpretations, and the connexion of the interpretation with the popularity
> and the logic behind all that."

The **Studio** is the authoring and curation surface. The Reader is where a text
is read; the Studio is where the corpus is built, connected, and rendered. Same
data model, different privileges.

## Four rooms

### 1. The Ingest room — getting books in

Where a work becomes readable: source text, translations, reference system,
licence.

The hard rule that shapes this room: **sacred source text is never hand-entered.**
It is ingested from an authoritative digital edition, checksummed, and marked
`verified` by a named person. Every `TextUnit` carries a `provenance` block with
a `sha256`, and an unverified unit never reaches a reader.

This is not bureaucracy. Every sample unit currently in this repository is marked
`verified: false`, because I typed them from memory to demonstrate the format.
They are fit for testing the anchoring machinery and unfit to show anybody as
scripture. The field makes that distinction structural instead of a matter of
someone remembering.

### 2. The Layer room — getting interpretations in

Import a commentary corpus, align it to the Canonical Reference, declare its
licence, stance, and canonical weight with a written basis.

Most public-domain commentary is already verse-anchored, so import is a join
rather than an alignment problem — that is the whole reason the CR is mandatory
(see [`01-anchoring.md`](01-anchoring.md)). The work in this room is licensing
and translation, not engineering: the 14th-century Arabic is free, the readable
English of it usually is not.

### 3. The Correlation room — the connections

This is the room that does not exist in any other product, and it is where the
project's real intellectual asset accumulates.

- **Anchor-to-anchor**: a commentator citing another verse creates an edge.
  Enough of them and the corpus draws its own cross-reference apparatus.
- **Stance-to-stance across works**: Śaṅkara reads Gītā 2.47 and Īśā 1 the same
  way; Aurobindo opposes him on both. Because `stance` is a first-class field,
  that pattern is computable rather than something a scholar has to spot.
- **Contestation mapping**: the heat map from [`06-salience.md`](06-salience.md),
  and the gap report — high engagement plus low voice count is an import backlog
  the system generates for itself.
- **Fork lineage**: the reception history, drawn from data already collected.

### 4. The Rendition room — images and video

Where a passage, read through a chosen lens, becomes an image or a video.

The pipeline, and the order matters:

```
  anchor ──▶ lens ──▶ prompt ──▶ POLICY GATE ──▶ model ──▶ provenance ──▶ rendition
   what      whose      how       per-corpus,     render    C2PA +          carries
   text      reading   framed     pre-generation            watermark       its lens
```

Two rules from [`04-generative.md`](04-generative.md) are enforced here rather
than remembered:

- **The policy gate runs before generation, not after.** Per-corpus, no user
  override on hard blocks, and a refusal names the rule that applied.
- **A rendition is attributed to a reading, not to the text.** It carries the
  lens that produced it, so its caption is "11.12, read through *these layers*,
  rendered by *this model*" — never "Bhagavad Gītā 11.12". That framing is the
  difference between a devotional tool and a machine that manufactures apocrypha.

Video is image plus time, and the same gate governs it. The sequencing input is
the reader's own layer selection, which is what "directed by the person reading"
means concretely: **the lens is the storyboard.**

## Roles

| Role | Can |
|---|---|
| Reader | Read, annotate privately, publish own layers, save and share lenses |
| Contributor | Author a public layer over a work |
| Curator | Ingest editions, import layers, declare canonical weight, verify text |
| Steward | Set corpus policy, act on moderation, seat the advisory group |

Curator and Steward are **per corpus**, not global. Nobody administers all six
traditions. That is a governance decision expressed in the permission model, and
it is the single most important structural safeguard in the whole design.

## Build order

The Studio does not need to be built before the Reader. Rooms 1 and 2 can be a
command line and a pull request against this repository for a long time — the
corpus is already plain JSON in git, which gives review, history, and rollback
for free. Room 3 is where the differentiated value sits, and Room 4 is the one
everybody will ask for first.

Recommendation: **Reader → Room 3 → Room 4 → Rooms 1 and 2 as real interfaces.**
Ship the thing that shows the argument before the thing that generates pictures
of it.
