# 02 — Layers

## What a layer is

A **layer** is a named, attributable, selectable set of interpretations over one
work. It is the unit the reader switches on and off.

A layer is not a category or a tag. It has an author, a licence, a coverage
figure, and an editorial stance it is expected to declare.

## The eight layer kinds

Kind is a closed vocabulary. It drives typography, default stacking order, and
policy — a reader must be able to tell at a glance what *sort* of speech they are
looking at.

| Kind | Answers | Example |
|---|---|---|
| `philological` | What do the words say? | Lexicon entries, grammatical parsing, root morphology |
| `variant` | What do the manuscripts say? | Masoretic vs LXX; Mawangdui vs received; qirāʾāt |
| `traditional` | What has the tradition said? | Rashi, Ibn Kathīr, Śaṅkara, Zhu Xi |
| `historical` | What was the world it came from? | Composition context, reception history |
| `devotional` | How is this read in practice? | Liturgical use, meditation, homiletic |
| `critical` | What do scholars argue? | Academic, comparative, source-critical |
| `personal` | What does one reader see? | A user's own notes |
| `machine` | What did a model produce? | AI-generated readings — always distinct |

`variant` is separated from `philological` on purpose: in three of the four
corpora, textual variance is a live confessional issue, and collapsing "the
manuscripts differ here" into "here is a note about the grammar" would misstate
what is happening.

## Stacking

The reader composes a stack. Default order, bottom to top:
`variant` → `philological` → `traditional` → `historical` → `critical` →
`devotional` → `personal` → `machine`.

Rules:

- Layers never occlude the base text (principle 1).
- Two layers on the same anchor are shown side by side, both attributed, in a
  stable order. Never merged, never summarised into one.
- Contradiction between layers is displayed as contradiction. The system has no
  reconciliation step and no ranking of readings by truth.

## The machine layer, and why it is fenced

This project intends to produce AI-authored readings — that was in the original
brief, and it is worth doing. It is also the single easiest way to destroy the
product's credibility.

Requirements, all mandatory:

1. **Kind is `machine`.** It cannot be filed as `traditional` or `critical` no
   matter how good it is.
2. **Distinct visual register**, permanently — not a badge that a theme can drop.
3. **Full generation provenance**: model identifier, date, and the exact inputs
   the model was given, including *which layers were in its context*. A machine
   reading produced after reading Śaṅkara is a different object from one produced
   cold, and the reader is entitled to know which one they have.
4. **Never in the default stack.** Opt-in, every time.
5. **Never cites a tradition it was not given.** If the model asserts "the
   classical commentators hold X", that assertion must be traceable to a layer
   that was actually in its context, or it does not ship. Fabricated attribution
   to a named historical commentator is the failure mode that would end this
   project, and it is a hard blocker, not a quality issue.

The honest framing for a machine layer is *"a reading produced by a model on this
date from these inputs"* — not *"an interpretation"*. It is evidence of what a
model does with the text. That is genuinely interesting and it is not the same
kind of thing as Rāmānuja.

## Authorship

```json
"author": {
  "type": "historical" | "institution" | "user" | "model",
  "id": "...",
  "display": "Ādi Śaṅkarācārya",
  "school": "advaita",          // optional, declared stance
  "century": 8
}
```

For `type: "model"` the `model` and `generated` fields become mandatory, and the
`inputs` block records the context. The schema enforces this conditionally.

## Forking

"Add other interpretation" and "answer this one" are the same operation:
`derived_from`.

```
interp:gita.2-47.shankara            (traditional, 8th c.)
        │
        ├── interp:gita.2-47.tilak    derived_from: [shankara]  relation: "rebuts"
        │        │
        │        └── interp:...user   derived_from: [tilak]     relation: "extends"
        │
        └── interp:...user2           derived_from: [shankara]  relation: "questions"
```

`relation` is a closed vocabulary: `extends`, `rebuts`, `questions`,
`translates`, `applies`, `illustrates`.

Two properties fall out of this that matter:

- A fork **cannot detach from its parent**. Unpublishing a parent leaves a
  tombstone, so a chain of responses never silently becomes a chain of orphans
  arguing with nobody.
- The fork graph *is* the reception history. This is the same shape as the actual
  commentary tradition, where Rāmānuja is explicitly writing against Śaṅkara. The
  data model was chosen to match how these traditions already work, rather than
  imposing a flat-comments model on them.

## Visibility

| Level | Meaning |
|---|---|
| `private` | Author only. **The default.** |
| `group` | A named circle — a study group, a class, a congregation |
| `unlisted` | Anyone with the link; not indexed, not searchable |
| `public` | Listed, searchable, forkable, attributed |

Going public is an explicit act and requires a display attribution. There are no
anonymous public interpretations of scripture in this system — that is a
deliberate choice about what kind of place this is, and it is worth the cost in
participation.

## Lenses

A **lens** is a saved, shareable reading configuration:

```json
{
  "id": "lens:gita.karma-debate",
  "work": "work:gita",
  "editions": ["ed:gita.sa.wikisource", "ed:gita.en.telang"],
  "layers": ["layer:gita.shankara", "layer:gita.tilak", "layer:gita.gandhi"],
  "filters": { "kinds": ["traditional"], "min_confidence": 0.5 }
}
```

The lens is the unit of sharing. Handing someone a lens is handing them *a way of
reading*, which is a far more interesting object to pass between people than a
highlighted verse — and it is what makes the layer system social rather than
merely configurable.
