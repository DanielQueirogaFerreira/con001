# 04 — Generative Renditions, and Their Boundaries

The brief asks that the text be available "to create images, videos and be
directed by the person reading". This is the most interesting feature and the
most dangerous one, so it gets its own boundaries rather than a footnote.

## What a Rendition is

A **Rendition** is an image, video, or audio piece generated from an anchor as
read through a lens.

```json
{
  "id": "rend:...",
  "anchor": { "cr": "gita:11.12", "span": {...} },
  "lens": "lens:gita.karma-debate",
  "layers_in_context": ["layer:gita.shankara"],
  "prompt": "...",
  "model": "...",
  "generated": "2026-09-05",
  "policy": { "corpus_policy": "gita.v1", "decision": "allowed" }
}
```

The crucial design decision: **a rendition is attributed to a reading, not to the
text.** It carries the lens that produced it. It is never captioned "Bhagavad
Gītā 11.12" — it is captioned "11.12, read through *these layers*, rendered by
*this model* on *this date*". That framing is the difference between a devotional
tool and a machine that manufactures apocrypha.

A rendition is a `machine`-kind object and inherits every rule in
[`02-layers.md`](02-layers.md): labelled, provenance-complete, opt-in, never in
the default view.

## Policy is per-corpus, not global

A single global content policy would be wrong in all four directions at once.
Each corpus declares its own, and the policy is data, reviewed with community
representatives — not a constant in the codebase.

### Qur'ān

- **No depiction of the Prophet Muḥammad. No exceptions, no user override, no
  "artistic interpretation" carve-out.** This is a hard block at the policy
  layer, evaluated before generation, not a moderation pass after it.
- No depiction of God. No anthropomorphic rendering of the divine.
- No depiction of other prophets (Jesus, Moses, Abraham) as figures — the
  mainstream position extends the prohibition, and where traditions differ the
  system takes the more restrictive reading.
- Audio: recitation is a trained discipline with its own rules of *tajwīd*.
  **Synthetic recitation of the Arabic is not generated.** Where recitation is
  offered it is licensed from human reciters, attributed by name and *riwāyah*.

### Bible

- No depiction of God the Father; no rendering of the Tetragrammaton as an
  image.
- Depiction of Jesus is permitted for the Christian reading tradition — there is
  a two-thousand-year iconographic tradition — and blocked for the Hebrew Bible
  corpus, which is a different work with different readers.
- Second-commandment sensitivity is declared at the *edition* level, because the
  same verse is read under different image norms by Jewish and Christian readers.

### Bhagavad Gītā

- Depiction of Kṛṣṇa and the *viśvarūpa* is within a living, enormous
  iconographic tradition and is permitted.
- Iconographic conventions matter: attributes, *mudrās*, *vāhanas* and colour are
  meaningful, not decorative. A generated image that garbles them is not
  neutral — it is wrong in a way practitioners will immediately see. Renditions
  are labelled as generated, always.

### Analects

- Confucius has a portrait tradition; depiction is permitted.
- The relevant sensitivity is different in kind: the Analects is politically live
  in a way the other three are not, and renditions that press it into
  contemporary political service should be handled as a moderation concern rather
  than an image-content one.

## Cross-cutting rules

1. **A rendition never enters a layer stack as interpretation.** It is an
   artefact produced *from* a reading, and it never becomes an input to another
   reader's understanding without its full provenance attached.
2. **Renditions inherit the visibility of their source annotation.** Generating
   from a private note does not publish it.
3. **Every rendition is watermarked and carries embedded provenance (C2PA or
   equivalent).** Devotional imagery detaches from its source and travels. It
   must remain identifiable as generated after it has been screenshotted, and
   that is a build requirement, not a nice-to-have.
4. **No generated text is ever presented as source text.** The base text is
   immutable and machine-authored content cannot occupy its register — this is
   principle 1 of [`00-point-of-view.md`](00-point-of-view.md) and it applies to
   generation with full force.
5. **Policy refusals are explained, and are appealable to a human.** A silent
   block on a religious request reads as contempt. Say which policy applied and
   why.

## The moderation stance

Public interpretation of scripture attracts sincere disagreement and also
attracts abuse, and the two must not be confused.

- **Attribution is required for all public layers.** No anonymous public
  interpretation.
- **The system hosts disagreement and does not adjudicate truth.** No layer is
  removed for being theologically wrong, minority, heterodox, or offensive to
  another tradition. The four corpora contradict each other by construction; a
  system that could not hold that could not exist.
- **What is removed:** targeted harassment, incitement, and content that
  fraudulently claims to be source text or falsely attributes a reading to a
  named historical or living person. **Misattribution is the cardinal offence
  here**, because attribution is the whole substrate.
- Each corpus has an advisory group from within its tradition. They do not
  approve interpretations — that would violate the stance above. They review
  *policy*: orthography, generation limits, labelling, handling norms.
