# 08 — Open Source, Cost, and Governance

> "Let's go to the open source model. Save more money, because this is
> philanthropic work for a church, not looking only for our profit. We just want
> the profit to spread the goods."

Taken as settled. This document works out what it actually implies, because
"open source" is four separate decisions that people usually make by accident.

## The four licences

Different parts of this project need different licences. Using one licence for
all of it would be a mistake in one direction or the other.

| What | Recommended | Why |
|---|---|---|
| **Application code** | **AGPL-3.0** | The one licence that stops a company running your platform as a closed hosted service. Permissive licences do not prevent enclosure; they invite it. For a philanthropic project this is the difference between the good spreading and the good being taken. |
| **Interpretation corpus** (authored layers, translations you commission) | **CC BY-SA 4.0** | Anyone may use it, and anything built on it stays open. Share-alike is what keeps the commons a commons. |
| **Anchoring data** (reference tables, CR indices, alignment maps) | **CC0** | These are close to bare facts, weakly copyrightable, and worth far more to the world unencumbered. Making them CC0 is how this project's standard becomes *the* standard. |
| **Source texts** | Untouched | They are already public domain, and no new rights are claimed over them. Saying so explicitly matters to the traditions. |

The reasoning behind the split: **be maximally generous with the data and
deliberately protective of the platform.** The data spreading everywhere is the
mission. The platform being taken closed-source by someone who then charges a
congregation for access is the failure mode.

One consequence to accept with open eyes: AGPL will deter some commercial
contributors and some corporate hosting partners. For a church-backed
philanthropic project that is a feature, not a cost. If it later turns out to be
a real obstacle, a dual-licence arrangement is available — but only if copyright
is held somewhere that can grant it, which is the governance point below.

Contributor licensing: a **Developer Certificate of Origin** (a sign-off line),
not a copyright-assignment CLA. A CLA on a philanthropic religious project reads
as a land grab and will cost more in trust than it returns.

## Cost architecture

"Save more money" is a design constraint, and it happens to align with good
engineering. The expensive parts of a project like this are usually accidental.

**The corpus is static, and static is nearly free.** Text units, layers and
interpretations are immutable, content-addressed, and highly cacheable. Ship them
as pre-built JSON on a CDN. A six-work corpus with full commentary is on the
order of a few hundred megabytes — bandwidth costs, not database costs. Most
"reading apps" pay for a database query on every page view for data that has not
changed in eight hundred years.

**No model in the hot path.** Span projection between editions is precomputed and
cached; contestation and salience are batch jobs; machine layers are generated
once and stored like any other layer. Nothing calls a model when a reader turns a
page. This is the single largest cost decision in the project.

**Generation is the only real variable cost**, and it is bounded by three things
already in the design: renditions are opt-in, they are cached and shared by
`(anchor, lens, prompt)` — the same passage under the same lens renders once for
everyone — and the policy gate rejects before spending, not after.

**Self-hostable by default.** A parish, a seminary or a diocese should be able to
run the whole thing on one modest machine. That is both a cost strategy and a
resilience strategy: a project that can be hosted by the communities it serves
cannot be switched off centrally.

Rough shape of the running cost at small scale: CDN and object storage in the
tens of dollars a month, one small application server, and generation billed per
image at whatever the chosen model costs. The corpus work — commissioning
translations of public-domain commentary — will dominate the budget by an order
of magnitude, and it is the part most often forgotten.

## Governance

Open source without governance is a project waiting for its first crisis. Three
things are worth settling early.

1. **Where copyright sits — decided: a 501(c)(3) fiscal sponsor.** On the Open
   Source Collective / Software Freedom Conservancy model. The notice reads
   *The Open Hermeneutics Project, a fiscally sponsored project of [Fiscal
   Sponsor]*, with the bracket visible until one is engaged. This buys liability
   protection, donation compliance and non-partisan standing across faith
   communities in weeks rather than a year. See [`LICENSING.md`](../LICENSING.md)
   for the two questions to settle when engaging one.

2. **Per-corpus stewardship, structurally.** From
   [`07-studio.md`](07-studio.md): nobody administers all six traditions. Each
   corpus has its own steward and advisory group from inside that tradition. A
   Christian organisation hosting a Qur'ān interface is a legitimate and generous
   thing to do — and it only stays legitimate if Muslims hold the policy over the
   Qur'ān corpus. Write that into the governance document, not just the code.

3. **A neutrality commitment, published.** The stance from
   [`00-point-of-view.md`](00-point-of-view.md) — the system hosts disagreement
   and does not adjudicate truth — has to be a public, hard-to-change promise if
   people from five other traditions are going to trust a church-funded platform
   with their scripture. It will be tested early and in public. Better to have
   written it down before then.

## What "profit spread" can mean concretely

Since the intent is philanthropic rather than extractive, the sustainable
patterns worth considering — none of which requires closing anything:

- **Hosting for institutions.** The software is free; running it reliably for a
  seminary or a diocese is a service worth paying for.
- **Corpus commissioning.** Fund fresh translations of public-domain commentary
  and release them CC BY-SA. This is the highest-leverage philanthropic spend in
  the entire project: a good English Ibn Kathīr or a modern Zhu Xi under an open
  licence outlives any application.
- **Grants.** Digital humanities and religious-studies funding exists for exactly
  this, and an open, CC0-anchored interpretation corpus is a fundable object in a
  way that an app is not.

The order matters: **the corpus is the endowment; the platform is the building.**
Buildings need maintenance and eventually get replaced. Fund accordingly.
