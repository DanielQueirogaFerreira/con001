# Licensing

This project is open source, and the different parts of it need different
licences. Reasoning: [`docs/08-open-source-and-cost.md`](docs/08-open-source-and-cost.md).

| Part | Licence | Status |
|---|---|---|
| Application code (`tools/`, and any application built here) | **AGPL-3.0** | Recommended — awaiting confirmation |
| Interpretation corpus (`data/interpretations/`, `data/layers/`) | **CC BY-SA 4.0** | Recommended — awaiting confirmation |
| Anchoring data (`data/works/`, reference tables, alignment maps) | **CC0 1.0** | Recommended — awaiting confirmation |
| Source texts (`data/editions/text-units.json`) | Public domain | No new rights claimed |
| Third-party commentary | Per `license` field on each Layer | Tracked per layer, never per work |

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

## Not yet decided

The `LICENSE` files are not in the repository yet, because the choice is the
project's to make and it is hard to reverse — an AGPL release cannot be quietly
walked back. Once confirmed, three files get added: `LICENSE` (AGPL-3.0),
`data/LICENSE-CORPUS` (CC BY-SA 4.0), and `data/LICENSE-ANCHORS` (CC0 1.0).

One consequence to accept knowingly: AGPL will deter some commercial
contributors and some hosting partners. For this project that is closer to a
feature than a cost — but it is a real trade, and a dual-licence arrangement
later requires copyright to sit somewhere that can grant it. See the governance
section of [`docs/08-open-source-and-cost.md`](docs/08-open-source-and-cost.md).
