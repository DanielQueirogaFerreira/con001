# Advisory Review

Scholar review of high-consequence claims, managed in git.

Every claim the system makes at `consequence_tier: high` must be cleared by the
advisory seat of **every tradition it speaks about**, before it can reach
production. This directory is where that clearance lives, and
`tools/advisory.mjs` is what reads it.

## How it works

1. A high-tier position or resonance is written. The audit holds it
   (`awaiting-advisory`) and `npm run build:prod` refuses to publish it.
2. An RFC is opened here — `advisory/rfc/NNN-slug.md` — stating the claim, the
   text it rests on, and what each seat is being asked to decide.
3. Reviewers sign off by pull request, adding an entry to the RFC's record
   block. The commit that adds a sign-off should be **signed**, and its SHA is
   recorded in the entry.
4. When every required seat has approved and no objection stands, the RFC's
   `status` becomes `approved`, and the claim references it in `reviewed_by` or
   `review.signed_off_by`.

The claim never carries the approval; it carries a **reference to a reviewable
record**. That is the whole point: an approval you cannot open and read is not an
approval.

## File format

One markdown file per RFC. The human argument is the document; the
machine-readable record is a fenced block marked ` ```json record `. One file, so
the two cannot drift.

```
advisory/rfc/001-anatta-vs-atman.md
advisory/rfc/TEMPLATE.md
```

## Credentials

A sign-off names a person and how their standing was established:

| type | value |
|---|---|
| `orcid` | ORCID iD |
| `institution` | Academic post and institution |
| `monastic` | Monastic ordination and lineage |
| `clerical` | Clerical office and body |
| `community` | Recognised standing in a practising community |

`verified_by` records **who checked the credential**, and `verified_on` when.
A credential nobody checked is not a credential — it is a claim in a text field.

## What does not count as a sign-off

- A placeholder containing `pending`, `tbd` or `todo`.
- A reference to an RFC that does not exist.
- A reference to an RFC that is not `approved`.
- A reference to an RFC that does not cover this claim.
- An RFC missing a seat the claim's question requires.
- An RFC with a standing `object` decision.

All six are enforced in `tools/advisory.mjs` and tested. The first was a real
loophole found in this repository: `reviewed_by: ["advisory:hindu (pending)"]`
was a non-empty array and cleared the gate.

## On signatures

Each sign-off records the `commit` that added it and the reviewer's signing key
`fingerprint`. `node tools/advisory.mjs --verify-signatures` shells out to
`git verify-commit`, which requires the reviewer's public key in the local
keyring. Where it cannot verify, it says so and **does not treat the sign-off as
cryptographically confirmed** — it never silently passes.

## Current state

No advisory groups are seated. RFC 001 is open with no sign-offs, which is the
correct and honest state: there are no reviewers yet, and no sign-off has been
invented to represent one. The held items in `dist/manifest.json` are the
recruitment agenda.
