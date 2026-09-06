# Licensing

This project is open source, and the different parts of it need different
licences. Reasoning: [`docs/08-open-source-and-cost.md`](docs/08-open-source-and-cost.md).

**Copyright (c) 2026 The Open Hermeneutics Project, a fiscally sponsored project of [Fiscal Sponsor].** See [`COPYRIGHT`](COPYRIGHT).

| Part | Licence | File |
|---|---|---|
| Application code (`tools/`, `web/`) | **AGPL-3.0-only** | [`LICENSE`](LICENSE) |
| Interpretation corpus (`data/interpretations/`, `data/layers/`, `data/questions/`, `data/positions/`, `data/resonances/`, `data/lenses/`) | **CC BY-SA 4.0** | [`data/LICENSE-CORPUS`](data/LICENSE-CORPUS) |
| Anchoring data (`data/works/`, `schema/`, reference and alignment tables) | **CC0 1.0** | [`data/LICENSE-ANCHORS`](data/LICENSE-ANCHORS) |
| Source texts (`data/editions/text-units.json`) | Public domain, no rights claimed | [`data/editions/LICENSE-SOURCE-TEXTS`](data/editions/LICENSE-SOURCE-TEXTS) |
| Third-party commentary | Per `license` field on each Layer | Tracked per layer, never per work |

All four are committed and in force. The AGPL, CC BY-SA and CC0 texts are the
verbatim canonical versions from the SPDX license list.

## Why the split

**Be maximally generous with the data; be deliberately protective of the
platform.**

- **AGPL for code** is the one licence that stops a company running this as a
  closed hosted service. Permissive licences do not prevent enclosure — they
  invite it. For a philanthropic project funded by a church, the failure mode to
  guard against is someone taking the platform closed and charging a congregation
  for access.
- **CC BY-SA for the corpus** keeps the commons a commons: use it freely, and
  what you build on it stays open.
- **CC0 for anchoring data** because it is close to bare fact, weakly
  copyrightable, and worth far more unencumbered. Releasing it CC0 is how the
  Canonical Reference scheme here becomes a standard other projects adopt rather
  than a format only this project uses.
- **Nothing claimed over source texts.** They are already public domain, and
  saying so explicitly matters to the traditions this serves.

## Contributions

Sign-off under the **Developer Certificate of Origin** — a `Signed-off-by:` line
on each commit. Deliberately *not* a copyright-assignment CLA: on a philanthropic
religious project a CLA reads as a land grab and costs more in trust than it
returns.

## The holding entity

**Decided: a 501(c)(3) fiscal sponsor**, on the Open Source Collective /
Software Freedom Conservancy model. The notice reads *The Open Hermeneutics
Project, a fiscally sponsored project of [Fiscal Sponsor]* — the bracket is a
placeholder until one is engaged, and it is deliberately visible rather than
quietly omitted.

Why this rather than custom incorporation: liability protection, donation
compliance and non-partisan standing across faith communities, available in
weeks rather than a year. The last of those is not a side benefit. A platform
hosting seven traditions' scripture will be asked who owns it, early and in
public, and "a fiscally sponsored project of a neutral 501(c)(3)" is a far
better answer than the name of any one faith community's legal entity.

Two things to settle with the sponsor when engaging:

1. **Whether the sponsor holds copyright or merely sponsors.** Under most
   models contributors retain copyright and licence in under the DCO, which is
   what the notice above assumes. If a future dual-licence is wanted, that needs
   an assignment path agreed at the outset — retrofitting one across many
   contributors is close to impossible.
2. **Who can accept or refuse a corpus.** Advisory seats govern claims
   ([`advisory/`](advisory/README.md)); the sponsor governs the entity. Where
   those two could collide — a community formally objecting to their scripture
   being hosted at all — should be written down before it happens, not during.

One consequence already accepted: AGPL will deter some commercial contributors
and some hosting partners. For this project that is closer to a feature than a
cost. See the governance section of
[`docs/08-open-source-and-cost.md`](docs/08-open-source-and-cost.md).
