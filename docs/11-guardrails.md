# 11 — Guardrails: Thresholds, Tiers, and the Room for Art

> "The image, the text, the comments have to have a threshold — we cannot go over
> that ceiling, under that score — and then it has to be protected… very solid
> guide rails, so we don't create things we are not aligned with. But sometimes
> the text aligns with things that are hard to see, and art comes inside and
> opens rooms for many kinds of expression. That's the thing we try to balance."

Both halves of that are right, and they are usually treated as one problem, which
is why most systems get it wrong in one direction or the other. The resolution
here is a single distinction.

## The distinction that resolves it

**Rails go on what the system asserts. Rooms go around what a person expresses.**

| | **Assertion** | **Expression** |
|---|---|---|
| Who is speaking | The platform | A reader |
| Examples | A resonance, an alignment claim, a machine layer, a rendition presented as illustrating a passage | A personal note, a reader's image, a poem, a private layer |
| Governed by | Hard rails: evidence floors, closed vocabulary, consequence tiers, advisory sign-off | Wide latitude, tight **scope** |
| Failure if wrong | The platform has put words in a tradition's mouth | A person has said something someone else dislikes |

A reader's art is theirs. The system's claims are ours. These need completely
different regimes, and collapsing them is what produces both over-censored
platforms and reckless ones.

Concretely, expression gets its freedom from **scope**, not from lower standards:
personal layers are private by default, never presented as the tradition's voice,
never enter the resonance computation, and never acquire canonical weight (all
already enforced — see [`02`](02-layers.md) and [`06`](06-salience.md)). Because
it cannot be mistaken for the platform speaking, it does not need the platform's
rails.

## The threshold model

A single confidence number is not enough, because the same confidence means
different things depending on how much damage a mistake does. So two dimensions.

### Floor — below this, nothing is shown

```
  EVIDENCE_FLOOR = 0.5
```

Below the floor a claim is **not displayed at all** — not displayed faintly, not
displayed with a hedge, not displayed in grey. A hedged wrong claim about
somebody's scripture is still a wrong claim about somebody's scripture, and the
hedge is read as deniability.

Floors, concretely:
- A **position** needs at least one anchored interpretation. No text, no position.
- A **resonance** needs both positions above the confidence floor.
- A **machine layer** may assert nothing about a commentator who was not in its
  context ([`02`](02-layers.md)).
- A **rendition** needs its policy decision recorded before generation, not after
  ([`04`](04-generative.md)).

### Ceiling — above this, the system may not speak

The ceiling is **linguistic, not numeric**, and this is the part people miss. No
matter how high the confidence, the strongest thing the system may say is fixed
by a closed vocabulary: `answers-similarly`, `answers-oppositely`,
`shares-question-only`. There is no field in which it can say two traditions
agree, and no confidence score unlocks one.

A ceiling implemented as a number gets raised. A ceiling implemented as a missing
field cannot be.

### Tiers — how much a mistake costs

| Tier | Meaning | Gate |
|---|---|---|
| **low** | Ethics, practice, general moral reasoning | Curator publishes |
| **medium** | Doctrine within a tradition; cross-tradition comparison on non-identity questions | Curator publishes, advisory group notified, objection reverts |
| **high** | Anything touching a community's identity, exclusivity, or the truth of another tradition | **Sign-off required from the advisory group of every tradition involved, before publication** |

`q:abiding-self` is high tier: ātman and attā are the same word doing opposite
work in two traditions that argued about it for a millennium. Nothing about that
question ships without Hindu and Buddhist reviewers on it, and the audit fails if
a high-tier position carries no review.

Note what the tier gates: **publication of the system's claim.** It does not gate
a reader reading, annotating, or disagreeing.

## Renditions

Images and video get the same shape, with additions from
[`04`](04-generative.md):

- The per-corpus policy gate runs **before** generation. Hard blocks have no user
  override — no depiction of the Prophet Muḥammad, no synthetic Qur'ān
  recitation.
- Every rendition carries embedded provenance (C2PA) and a watermark, because
  devotional imagery detaches from its source and travels.
- A rendition is attributed to a **reading**, never to the text: "11.12, read
  through these layers, rendered by this model", never "Bhagavad Gītā 11.12".
- A rendition never enters a layer stack as interpretation and never becomes an
  input to the resonance map.

**Refusals name the rule that applied and are appealable to a human.** A silent
block on a religious request reads as contempt, and will be reported as such.

## The room for art, kept honest

The brief's last point deserves a direct answer, because it is the subtlest thing
in it:

> "Sometimes the text aligns with things that are hard to see, but art comes
> inside and opens rooms for many kinds of expression."

This is true, and it is why the rails above are deliberately narrow rather than
broad. What they constrain is **the system asserting things about traditions.**
What they leave completely open:

- A reader may hold any reading, however heterodox, and publish it under their own
  name. **No layer is removed for being theologically wrong, minority, or
  offensive to another tradition** — the seven corpora contradict each other by
  construction, and a system that could not hold that could not exist
  ([`04`](04-generative.md)).
- A reader may make images that a tradition's mainstream would find strange, in
  every corpus except where a hard block applies.
- A reader may reject the axis itself. Questions carry a `framing_note` naming
  whose vocabulary they are posed in precisely so that "this question is badly
  put" is a move available inside the system rather than only outside it.

The line is not between safe art and dangerous art. It is between **a person
speaking for themselves**, which is protected and roomy, and **the platform
speaking for a tradition**, which is gated hard. Art gets its room by being
correctly attributed to the person making it — not by being unregulated.

## What still needs people, not code

Every rail here is mechanical and therefore gameable, and none of them is a
substitute for the advisory groups in [`08`](08-open-source-and-cost.md). The
tiers assume those groups exist. Until they are seated, high-tier resonances stay
at `pending-review` and are not published — which is the current state of the two
in the corpus, and the correct state.
