# 00 — Point of View

## The observation this is built on

For most of their history, these texts were never read alone.

A medieval Hebrew Bible page is a small block of Torah in the centre, surrounded
by Rashi in one script, Ibn Ezra in another, the Masorah in the margin, and
Targum alongside. A page of the *Sishu Zhangju Jizhu* is Confucius in large
characters with Zhu Xi's gloss in half-size double columns underneath. A
manuscript of the Gītā carries Śaṅkara's *bhāṣya* wrapped around each verse. A
*mushaf* with *tafsīr* puts the āyah at the top and Ibn Kathīr below.

The physical page *was* the layer interface. It showed you the text, showed you
who was speaking about it, kept them typographically distinct, and let your eye
move between them at will.

Print flattened this. The paperback gives you one translation, no apparatus,
occasionally a footnote from an editor you cannot argue with. The digital Bible
app made it worse, not better: it gave you search, and took away the margin.

**We are rebuilding the margin, and making it writable.**

## The thesis

> Interpretation is not metadata about a text. It is a parallel text with its own
> authorship, its own history, its own commitments, and its own right to be
> cited, disagreed with, and forked.

Everything in this system follows from treating interpretation as a first-class
object rather than as a note attached to something more important.

## Seven principles

### 1. The base text is never rewritten by a layer

No layer may alter, replace, or visually merge with the source text. A gloss
lives beside the text, never inside it. This is not a design preference — it is a
doctrinal red line in all four traditions simultaneously, and it is the one rule
that, if broken, makes the product unusable by the people who care most about
these books.

### 2. Every interpretation carries its author, always

Historical commentator, institution, living reader, or model — the attribution is
part of the object, not part of the UI chrome. There is no anonymous voice in
this system, and specifically **no house voice**: the product never speaks about
the text in its own name. Where the software has an opinion, that opinion is a
layer, signed, and switchable off.

### 3. Machine-authored layers are labelled as machine-authored, permanently

An AI reading of a passage may be interesting, and this project intends to
produce them. It records the model, the date, the inputs it was given, and it
never sits in the same visual register as an eighth-century commentator. The
value of an AI layer collapses to zero the moment a reader cannot tell it apart
from the tradition. See [`02-layers.md`](02-layers.md).

### 4. Disagreement is the feature

The system's job is to **host** conflict of interpretation, legibly, not to
resolve it, rank it, or average it. There is no "correct reading" field. When two
layers contradict each other on the same anchor, that is displayed as what it is:
a live disagreement, with both parties named.

This is why the corpus was chosen for maximum internal contestation. A text
everyone agrees about needs no layer switcher.

### 5. An interpretation must never be orphaned

A reader's annotation, once made, has to survive the reader switching
translation, the edition being corrected, the display language changing, and the
app being rewritten. This constraint alone determines the anchoring architecture,
and it is why [`01-anchoring.md`](01-anchoring.md) is the most important document
here.

### 6. Private by default, public by deliberate act

A first reading is a vulnerable thing. Annotation defaults to private. Publishing
is an explicit action, is attributed, and is revocable — but the system records
that a public interpretation existed, so that forks of it do not silently lose
their parent.

### 7. Reverence is a technical requirement, not a disclaimer

Correct orthography for pointed Hebrew and Arabic, correct handling of the divine
name, correct labelling of what a translation is and is not, and per-tradition
limits on generated imagery are engineering work with acceptance criteria. They
are specified in [`03-corpus.md`](03-corpus.md) and [`04-generative.md`](04-generative.md),
not left to a terms-of-service page.

## What this is not

- **Not an answer engine.** No "what does this verse mean?" with one reply.
- **Not a translation.** We ship editions; we do not author them.
- **Not a social network with scripture attached.** The unit of sharing is a
  *lens* — a configured reading — not a post.
- **Not neutral about provenance.** Anything the system cannot attribute, it does
  not display.

## The test that decides whether this works

Put a rabbi, an imam, a Confucian scholar and a Vedāntin in front of it and have
each say: *this shows my tradition the way my tradition shows itself.*

If the architecture only fits one of them, it is wrong — and it will be wrong in
the direction of whichever tradition was implemented first. That is why all four
corpora are specified before any application code is written.
