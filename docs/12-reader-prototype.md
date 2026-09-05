# 12 — The Reader / Studio Prototype

`npm run reader` builds `web/reader.html`. Open it directly — no server, no
dependencies, corpus inlined. That is not a shortcut: it is the cost
architecture from [`08`](08-open-source-and-cost.md) made literal. The corpus is
static and immutable, so the reading surface is a file.

Five anchors: `gita:2.47`, `dhammapada:1`, `upanishad:ISH.1`, `daodejing:1`,
`quran:2:1`.

## Three things it demonstrates

### 1. The layered view

Source edition and translation stacked, with the spans of every active layer
highlighted **in the text itself**. Qur'ān translations are labelled
*interpretation of the meaning, not the Qur'ān*, from the edition's `authority`
field. Every unit carries an `unverified` tag, because every unit here is.

The machine layer is off by default, in its own colour, with its own badge —
[`02`](02-layers.md), enforced rather than remembered.

### 2. The contestation slider

The left end shows only the leading reading. Moving right admits dissenting
stances in order of distance from it, and the contestation index for the anchor
is displayed alongside.

On `gita:2.47` the slider collapses four voices to one and opens back out. On
`bible:JHN.3.16` there is nothing to open onto, and it says so — high popularity,
zero contestation, which is the point of keeping the two measures apart
([`06`](06-salience.md)).

The **diversity floor** is active at every position above zero: the majority
reading is never displayed alone. This is "go to the least popular fluidly" as a
physical control rather than a promise.

### 3. The Director Lens Hook

Each layer carries a `direction` block — register, motifs, what it positively
excludes, palette, and whether figural depiction is permitted. The studio
composes the active layers into a visual directive and **shows it before
anything is generated**.

The `avoid` list is as load-bearing as the motifs. A Gandhian reading of 2.47
that renders martial glory has not been directed; it has been ignored.

Two behaviours worth noting:

**Conflicts are shown, not resolved.** With Śaṅkara, Tilak and Gandhi all
active, the directive reports:

> Tilak *rebuts* Śaṅkara: directs "kinetic, engaged, unmistakably in the world"
> where Śaṅkara directs "interior, withdrawn".

That comes from the **fork graph**, not from string matching — if one reading
rebuts another, they are by definition not directing the same image. An image
that splits the difference represents no reading at all, so the studio surfaces
the tension and makes the reader choose.

**Hard policy is visible in the directive.** On `quran:2:1` the panel shows the
figural block *before* generation, names the rule, and points at
[`04`](04-generative.md). The constraint is legible in the studio rather than
discovered at the point of refusal.

Nothing is generated in this prototype. The directive is what a rendition would
carry, together with its lens, so the output stays attributed to a *reading* and
never to the text.

## Verified, not asserted

The prototype was driven in Chromium and checked: five anchors render, Devanāgarī
and Arabic display correctly, Arabic renders RTL, the slider collapses four
voices to one and back, the Qur'ān figural block appears, the fork-graph conflict
fires, no console errors.

## Build modes

```
npm run reader                             all data, development
node tools/build-reader.mjs --prod         production set only
npm run build:prod                         strict gate — refuses held items
node tools/build-prod.mjs --hold-excluded  ships without them, names them
```

## What it is not

Not the product. It has no annotation, no accounts, no lens sharing, no
persistence, no resonance view, and no generation. It exists to make three
claims checkable by hand rather than believable on the page — and to be the thing
you put in front of the first scholar from each tradition, which is the next real
milestone.
