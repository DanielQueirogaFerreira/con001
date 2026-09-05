# Licensing

This project is open source, and the different parts of it need different
licences. Reasoning: [`docs/08-open-source-and-cost.md`](docs/08-open-source-and-cost.md).

**Copyright (c) 2026 The Open Hermeneutics Project Contributors.** See
[`COPYRIGHT`](COPYRIGHT).

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

## Still open

**Where copyright sits.** "The Open Hermeneutics Project Contributors" is the
notice, which is correct and sufficient for now — but it is not a legal entity.
A dual-licence arrangement later is impossible without copyright held somewhere
that can grant one, and the same body is what accepts donations and holds
liability when someone objects to a layer. A church body, a foundation, or a
fiscal host such as Software Freedom Conservancy. This needs counsel, not an
engineering decision.

One consequence already accepted: AGPL will deter some commercial contributors
and some hosting partners. For this project that is closer to a feature than a
cost. See the governance section of
[`docs/08-open-source-and-cost.md`](docs/08-open-source-and-cost.md).
