# 09 — Ingestion and Text Integrity

One rule, and the machinery that enforces it.

## The rule

**Sacred source text is never hand-entered.**

Every `TextUnit` carries a `provenance` block:

```json
"provenance": {
  "source": "Westminster Leningrad Codex via tanach.us, retrieved 2026-09-05",
  "verified": true,
  "sha256": "…",
  "verified_by": "curator id",
  "verified_on": "2026-09-05"
}
```

A unit with `verified: false` may be used for development and testing. It must
never be displayed to a reader as scripture.

## Why this is in the specification rather than a runbook

Every sample text unit in this repository is currently marked `verified: false`,
including the Hebrew of Genesis 1:1, the Arabic of Qur'ān 2:1, the Sanskrit of
Gītā 2.47, and the Chinese of Analects 1.1. **I typed them from memory to
demonstrate the anchoring format.** They are good enough to prove that a span on
the Hebrew *bet* covers three codepoints and not one; they are not good enough to
show anybody as their scripture.

That distinction needs to be structural, not a matter of someone remembering
which files were seeded by hand. Hence the field, and hence the checksum: once a
unit is verified, any later change to its text invalidates the checksum and the
verification with it.

The Qur'ān is deliberately represented here by exactly one āyah — `quran:2:1`,
three letters — for the same reason. A long āyah written out from memory is a
liability, and Ayat al-Kursi appears in the salience data by reference only.

## Ingestion pipeline

```
  authoritative digital edition
        │  fetch, record URL + retrieval date
        ▼
  normalise to NFC ── (the stored form; never normalised again for search)
        │
        ▼
  split into units by the work's reference system ── CR assigned here
        │
        ▼
  checksum each unit ──▶ sha256
        │
        ▼
  curator review ──▶ verified: true, verified_by, verified_on
        │
        ▼
  readable
```

Notes that are easy to get wrong:

- **Normalisation happens once, on the way in.** A search index may be built from
  a normalised copy; the stored text is never touched, because span offsets are
  measured against it and because an immutable edition means immutable.
- **Diacritics are part of the text.** Stripping Arabic ḥarakāt or Hebrew
  pointing to make matching easier changes every offset downstream and produces a
  different text than the one the tradition uses.
- **The reference system is asserted by the edition, not inferred.** Verse
  divisions differ between traditions for the same book — the Hebrew and Christian
  numbering of the Psalms is the standard trap — and guessing produces
  annotations that land one verse off, forever.
- **Record the retrieval date.** Digital editions get corrected. When one does,
  the checksum mismatch is what tells you which annotations need their spans
  re-resolved.
