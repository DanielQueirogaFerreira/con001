```json record
{
  "id": "rfc:001",
  "title": "Anattā and ātman: recording a contradiction on the abiding self",
  "question": "q:abiding-self",
  "consequence_tier": "high",
  "targets": [
    "res:self.upanishad-dhammapada",
    "pos:upanishad.ish1.shankara",
    "pos:dhp.279.buddhaghosa"
  ],
  "seats_required": ["hindu", "buddhist"],
  "status": "open",
  "opened": "2026-09-06",
  "signoffs": []
}
```

# RFC 001 — Anattā and ātman: recording a contradiction on the abiding self

**Status: open. No seats filled. No sign-off has been invented to stand in for
one.** This RFC is why `npm run build:prod` refuses, and why the claim it covers
is excluded from the Alpha bundle and named in `dist/manifest.json`.

## The claim under review

On the question `q:abiding-self` — *is there an abiding self?* — the system would
record:

> `res:self.upanishad-dhammapada` · **answers-oppositely**

between `pos:upanishad.ish1.shankara` (value 1.00, tradition `hindu`) and
`pos:dhp.279.buddhaghosa` (value 0.00, tradition `buddhist`).

The axis: `0 = there is no abiding self in anything whatsoever`,
`1 = there is an abiding self, identical with the ultimate`.

## The text it rests on

**`upanishad:ISH.1`** — *ईशा वास्यमिदं सर्वं… तेन त्यक्तेन भुञ्जीथा*
Evidence: `interp:upanishad.ish1.shankara`, summarising Śaṅkara's
*Īśāvāsyopaniṣadbhāṣya* ad 1.

**`dhammapada:279`** — *Sabbe dhammā anattā ti, yadā paññāya passati…*
Evidence: `interp:dhp.279.buddhaghosa`, summarising the
*Dhammapada-aṭṭhakathā* on 277–279, including its care over the scope of *sabbe
dhammā* — that unlike the two preceding verses it reaches the unconditioned.

Both text units are currently `verified: false`. **This RFC cannot be approved
while that is true.** Ingesting both passages from authoritative editions with
checksums is a precondition of review, not a follow-up to it. See
`docs/09-ingestion.md`.

## The recorded divergence

Two entries stand on the resonance. The first:

> Not a difference of emphasis. *ātman* and *attā* are the same word, and these
> two traditions argued about precisely this for a thousand years, in writing, on
> purpose. Any presentation that softens this misrepresents both.

The second records what is nonetheless shared: both treat the question as the
hinge on which liberation turns, and both describe the goal as the end of
suffering through seeing what is actually the case.

## What each seat is asked to decide

**Hindu seat**

1. Is `pos:upanishad.ish1.shankara` at 1.00 a fair placement of Śaṅkara, or does
   the axis's phrase "identical with the ultimate" import a formulation Advaita
   would not use of *ātman* in this verse?
2. Does the axis itself pose the question in usable terms, or does asking whether
   there "is" an abiding self already presuppose a category Advaita would refuse?
   The `framing_note` may be rewritten on your instruction.
3. Is the second divergence entry — the shared soteriological frame — a fair
   statement, or does it overstate common ground?

**Buddhist seat**

1. Is `pos:dhp.279.buddhaghosa` at 0.00 a fair placement, and is the
   commentary's treatment of *sabbe dhammā* as reaching the unconditioned
   correctly represented?
2. Does recording this as `answers-oppositely` on a shared axis imply the two
   traditions are answering one question — and is that itself a position the
   Theravāda seat can accept, or does it concede too much?
3. Same question as the Hindu seat's third.

**Both seats**

4. Should this claim be publishable at all, or is a contradiction of this depth
   better presented only as two readings side by side, with no relation object
   between them? `shares-question-only` is available, and so is withdrawing the
   resonance entirely.

## Note on question 4

It is a real option and not a formality. The system is designed so that
recording *no relation* is always available, and the seats may take it. Nothing
in the architecture requires this resonance to exist.

## Preconditions before any seat is asked to sign

1. `upanishad:ISH.1` and `dhammapada:279` ingested from authoritative editions
   and marked `verified: true` by a named curator.
2. Full commentary passages available in translation, not only the summaries —
   a reviewer should not have to take our précis on trust.
3. Both seats filled, with credentials verified and recorded.
