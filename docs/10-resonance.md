# 10 — The Resonance Map

> "Measure what kind of vision that person has for the world… where they align
> with more than one structure, where they diverge. Just don't go one against
> another, neither in the same way — it's just neutral."

That instinct is exactly right, and it names the two ways this feature fails.
This document turns it into architecture. `tools/resonance.mjs` implements it and
`tools/test-resonance.mjs` proves the constraints hold.

## The two failure modes

**Syncretism.** The system says two texts mean the same thing. Every tradition
here has fought hard over distinctions that claim erases. "All religions
basically say the same thing" is not neutrality — it is a specific and contested
theological position, usually a modern Western liberal one, and asserting it
while claiming to be neutral is the worse offence.

**Manufactured conflict.** The mirror error. The system says these traditions
oppose each other, hardening difference into antagonism and handing sectarians a
citable machine.

Both are easy to build by accident, because the naive implementation — embed the
texts, compute cosine similarity, show what is close — produces the first one on
Tuesday and the second one on Wednesday. So the whole design is built around
avoiding them structurally rather than editorially.

## The mechanism: compare positions on questions, never traditions

**"How aligned is Christianity with Buddhism" is not a computation anyone can
defend.** It has no answer, and any number produced for it is fabricated.

**"Where do these two readings land on the question of whether the rightness of
an act is independent of what it yields" has an answer**, it is checkable against
text, and both readings can be shown next to the passage they come from.

So the unit of comparison is a **Question** with an axis, and the things placed
on it are **Positions** — each one a specific reading, by a named commentator,
anchored to a real passage.

```
q:act-and-outcome — Is the rightness of an act independent of what it yields?

  0 = measured by the outcome it produces      1 = right independently of outcome

    ··············●······  0.72  hindu      Tilak
    ················●····  0.78  confucian  Zhu Xi
    ················●····  0.80  buddhist   Buddhaghosa
    ·················●···  0.85  hindu      Śaṅkara
    ··················●··  0.92  hindu      Gandhi

    internal spread, hindu: 0.72–0.92 across 3 readings
```

**Look at what that picture does.** The three Hindu readings are spread across
0.20 of the axis. The gap between the Confucian and the Buddhist reading is 0.02.
Zhu Xi is closer to Buddhaghosa than Tilak is to Gandhi.

That is not a rhetorical point — it is what the data says, and it makes "one
tradition against another" a sentence this system cannot produce. There is a test
asserting this property holds.

## Four rules, enforced in code

### 1. A resonance is never displayed without the internal spread of its traditions

`withContext()` is the only way to get a resonance out of the module, and it
always attaches the range of positions **inside** each tradition involved.
Disagreement within a tradition is always as visible as disagreement between
them.

This is the whole neutrality mechanism. It is structural, not editorial: there is
no code path that returns a bare pair.

### 2. Every resonance must record what the agreement hides

`divergence` is required, `minItems: 1`, **including on resonances that record
agreement**. A recorded agreement that does not also record what it conceals is
syncretism, and this project does not ship it.

The worked example is the sharpest one in the corpus. Wang Bi on Dao De Jing 1
and Ibn Kathīr on the disconnected letters of Qur'ān 2:1 both land low on "can
the ultimate be named" — a naive similarity engine would file them as agreeing
and stop. The required divergence field says why that is wrong:

> For Wang Bi the limit is ontological: the Dao is not the sort of thing language
> reaches, ever. For Ibn Kathīr the limit is local and deliberate — God speaks,
> extensively and namably, and has withheld the meaning of these particular
> letters. One is a claim about language; the other is a claim about a specific
> act of revelation. The Qur'ānic position sits inside a tradition with
> ninety-nine named divine attributes; reading it as apophatic in the Daoist
> sense inverts it.

That paragraph is the product. The similarity score is just what makes it
findable.

### 3. The claim vocabulary is closed

A resonance's `claim` is one of `answers-similarly`, `answers-oppositely`,
`shares-question-only`. **There is no free-text field in which the system can
assert that two traditions agree.** The strongest thing it may ever say is that
two readings answer one question similarly — which is a far weaker and
defensible claim than saying two texts mean the same thing.

The claim must also match the geometry: filing far-apart positions as
"answers-similarly" is rejected, and so is filing near-identical positions as
"answers-oppositely". **Manufactured opposition is rejected as firmly as
manufactured agreement** — both have tests.

### 4. No position without a text anchor, and the placement is attributed to us

`evidence` is required and must point at real anchored interpretations. And
`asserted_by` records **who placed the reading on the axis** — because Śaṅkara
never put himself at 0.85 on a scale we invented. A position is *our reading of
their reading*, and the schema says so rather than letting the number pass as the
commentator's own word.

Questions also carry a required `framing_note` naming whose vocabulary the
question is posed in and which traditions it fits badly. Every comparative
question is asked from somewhere. Recording where is the difference between
comparison and imposition.

## The worldview profile — and where it lives

> "The person can add on his account his layer of perception and construct a view
> of this person's cosmo-perception."

A reader's profile is their position across the questions, derived from readings
they **saved, forked or annotated** — never from what they merely opened.

### It is never stored on a server

An inferred profile of a person's religious and philosophical belief is
special-category data under GDPR Article 9, and in a significant number of
countries it is the sort of record that gets people imprisoned or killed. A
church-backed platform holding that dataset for millions of readers would be
building a liability that no security posture makes safe.

So: **computed on the reader's device, encrypted at rest there, exportable and
erasable by them alone, and never transmitted.** The fixture in
`data/profiles/` is marked `.local.json` and carries that warning in the file
itself.

This is also the cheaper architecture, which is convenient — see
[`08`](08-open-source-and-cost.md).

### It reports positions, never affiliations

The system never tells anyone what they are. No "you are 78% aligned with X",
no tradition-match percentage. There is a test asserting the output contains no
such field.

What it does say:

```
  Can the ultimate be named or spoken?
    you: 0.20
    near  (0.05)  Heshang Gong on Dao De Jing 1
    near  (0.10)  Ibn Kathīr on Qur'ān 2:1
    far   (0.75)  Matthew Henry on John 1:1
    read against you: Matthew Henry (christian)
```

Three deliberate properties:

- **Nearest and farthest, always together.** A map that only shows agreement is a
  flattery machine.
- **A steelman button** — "the strongest reading against where you stand",
  weighted by evidence strength, and tested never to be a reading the reader
  already holds. This is the concrete form of the "points of neutrality" the
  brief asks for: the structure relaxes because the reader is routinely handed
  the best case against themselves, from inside a tradition that holds it
  seriously.
- **Proximity to a named commentator on a named passage**, so every result is one
  click from the text it came from. Nothing is asserted that cannot be read.

## The moment this is for

> "The moment where people look across many kinds and see where they are
> aligned."

Concretely, it is a reader discovering that on one specific question they stand
nearer to a twelfth-century Chinese Confucian than to a commentator from their
own tradition — and being able to click straight through to both passages and
check.

That is true, it is checkable, and it says nothing whatsoever about what religion
they should be. Which is exactly the neutrality the brief asked for: **not one
against another, and not all the same.**
