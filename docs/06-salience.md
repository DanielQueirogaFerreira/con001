# 06 — Popularity, the Long Tail, and Contestation

> "We have to have the most popular, and the project has to go to the least
> popular fluidly… and the entropy created by so many languages we are trying to
> map."

That is two requirements, and they pull in opposite directions. This document
says how they are reconciled, and `tools/salience.mjs` implements it.

## The danger, stated first

Ranking interpretations of scripture by popularity is not a neutral engineering
choice. Left alone it becomes **a majority vote on what a text means**.

The failure is mechanical and fast: the mainstream reading gets shown, so it gets
read, so it ranks higher, so it gets shown more. Within a year the minority
reading is functionally deleted — not by a decision anyone made, but by a sort
order. For a project whose entire premise is that a text carries many readings,
that is not a degradation. It is an inversion.

So popularity is built in deliberately, with three constraints.

## Constraint 1 — two axes, never blended

The system computes two independent measures and never merges them into one
score.

| | **Canonical weight** | **Engagement** |
|---|---|---|
| What it is | Standing within the tradition | What readers actually do |
| Where it comes from | **Declared editorially**, with a written basis | Measured |
| Where it lives | `layer.canonical` in the corpus | `data/salience/engagement.json`, never on the interpretation |
| Changes | Rarely, by argument | Continuously |

Two things follow from the table.

**Canonical weight is declared, not computed, and its `basis` is a required
field.** Śaṅkara's weight is 1.0 because every later Gītā commentator writes with
or against him — that reason is stored beside the number so it can be argued
with, rather than inherited silently from a ranking nobody can inspect. It is
ranked **within a tradition only**. There is no number that says Zhu Xi
outranks Ibn Kathīr; the question is meaningless and the schema cannot express
it.

**Engagement is stored outside the interpretation.** A reading must never carry
its own popularity around as though popularity were part of what it says. This
is a one-line architectural decision that prevents a whole class of drift.

Machine and personal layers carry canonical weight `0` by rule — enforced in
`schema/layer.schema.json` and tested.

## Constraint 2 — a diversity floor on every anchor

Whatever the ranking says, the reading surface must always carry a reading from
outside the leading stance.

`diversityFloor()` in `tools/salience.mjs` finds the anchors where ranking alone
would collapse the view into one school, and names the reading that has to be
injected. This is not a "related readings" garnish at the bottom of the page; it
is a hard floor, and it is what makes "go to the least popular fluidly" real
rather than aspirational. There is a test for it: skew the engagement data until
one stance owns the top slots, and the floor fires.

## Constraint 3 — the long tail is a path, not a basement

The corpus is a graph, not a list. Every reading carries `derived_from` and
`relation` (`rebuts`, `questions`, `extends`…), so the route from the most
popular reading to the least is a **chain of argument**, not a scroll to page 40.

From Śaṅkara you reach Tilak because Tilak rebuts him; from Tilak you reach
Gandhi the same way. The fork graph *is* the reception history, and walking it is
how a reader gets from the mainstream to the margin without ever falling off a
cliff. Popularity picks the entry point. The graph does the travelling.

## Contestation — mapping the entropy

The second half of the brief — the "entropy created by so many languages" — is
measurable, and it turns out to be the most interesting number in the system.

**Contestation index**: how much the received tradition disagrees at a given
anchor.

```
index = 0.6 · spread + 0.4 · rebuttal-density

  spread    normalised Shannon entropy over the canonically-weighted
            distribution of stances anchored here, with the ceiling set by
            the stances present across the whole work so units of one work
            are comparable to each other

  density   share of readings here that explicitly rebut or question another
            reading of the SAME anchor, from the fork graph
```

Two design decisions inside that formula matter more than the coefficients:

1. **Explicit rebuttal counts for more than mere plurality.** Four commentators
   who happen to differ is weaker evidence of a live dispute than two who are
   arguing with each other by name. The fork graph knows the difference.
2. **Personal and machine layers are excluded by construction.** Otherwise a
   model could manufacture the appearance of a live theological dispute by
   generating variety. Both exclusions are tested (`tools/test-salience.mjs`).

### What it produces

Running `node tools/salience.mjs` on the seed corpus:

```
  anchor                    work              voices  stances  spread  rebut   index
  ----------------------------------------------------------------------------
  upanishad:ISH.1           work:upanishad         2        2   95%   100%    97%
  gita:2.47                 work:gita              4        4   98%    67%    85%
  daodejing:1               work:daodejing         3        3  100%    50%    80%
  bible:GEN.1.1             work:bible             2        2   63%     0%    38%
  bible:JHN.3.16            work:bible             1        1    0%     0%     0%
```

**The two orderings are different, and that is the whole point.** John 3:16 is
the most-read verse in the corpus and scores zero contestation. Īśā 1 is read by
a fraction as many people and is the most contested anchor in the system,
because Śaṅkara and Aurobindo are in direct opposition over one phrase.

A single "relevance" score would have hidden both facts.

### What it unlocks

- **A heat map over the text.** Colour a book by contestation and you can see, at
  a glance, where the tradition is settled and where it has been arguing for a
  thousand years. Nobody has published that view of these texts.
- **A reading path**: *take me to the contested verses.* For a study group, that
  is a better table of contents than chapter order.
- **Cross-work resonance.** Īśā 1 and Gītā 2.47 host the *same argument* between
  the *same two positions* on different texts. Because stance is a first-class
  field, that link is computable rather than a thing a scholar has to notice.
- **A measurable definition of a gap in the corpus**: high engagement plus low
  voice count means readers are arriving somewhere the layers do not yet cover.
  That is the import backlog, generated rather than guessed.

## Cold start

Ranking has nothing to rank on day one. Order of use:

1. **Canonical weight alone** — from the declared table. Defensible from the
   first minute and needs no readers.
2. **Citation counts within the commentary literature** — how often later
   commentators quote this passage. Extractable from the corpus itself, and a
   far better popularity proxy than clicks because it measures what the tradition
   found worth arguing about.
3. **Reader engagement** — mixed in only once there is enough of it to mean
   something, and always as the second axis, never as the sort key on its own.

The seed engagement file is explicitly marked `"_synthetic": true`. It exists so
the tool has something to rank; it is not telemetry and must never be mistaken
for it.
