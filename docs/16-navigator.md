# 16 — The Codebase Navigator

The repository's structure and history as a scene you fly through, at `/evolution`.

Built to `CODEBASE-VIEWER-SPEC.md` v1.1, extracted from ScreenRegister — a complete build
spec rather than a summary, so this file records only what is **specific to this project**:
the decisions the spec left to the implementer, and what is not built yet.

## What is here

| Part | Where |
|---|---|
| Producer | `tools/build-evolution.mjs` — git history → `web/evolution.json`, tree → `web/source/` |
| Contract | `web/evolution.json`, `web/source/manifest.json` (spec §3 — unchanged) |
| Camera | `tools/nav/camera.mjs` — quaternion trackball, projection, framing, clamps |
| Scene | `tools/nav/evolution.mjs` — tree, 3D force layout, heat, timeline, palette |
| Renderer | `tools/build-navigator.mjs` → `web/evolution.html` |
| Tests | `tools/test-nav.mjs` — 22 checks, most of them one of the spec's §8 traps |

The camera and scene modules are pure and tested in Node. They are inlined into the page at
build time, the same way the reader inlines the prompt compiler: one implementation, tested
where testing is cheap, executed in the browser.

## Decisions this project made

**The area id is `501`.** The spec's original is `401`; the number is arbitrary but must be
*ours*, so an id read off a screenshot says which deployment it came from.

**The route is `/evolution`, and the page is called the Codebase Navigator.** That
disagreement is deliberate and is the spec's own rule: a route is an address that sits in
links and bookmarks, and should not churn because a word improved.

**No 3D library, which suited this repository anyway.** The spec argues for writing the
maths rather than importing 600 KB to draw a few hundred dots. Here there was a second
reason: the Content-Security-Policy names no remote origin at all, and the project has no
dependencies. A CDN import would have been the first exception to both.

**The source bundle ships behind the gate — and that is not the spec's default.** §4.6 is
explicit: publishing the tracked tree at the application's origin is safe only if the
repository is already public. **This repository is private.** So the inversion in §9 applies:
the navigator sits *inside* the session gate rather than outside it, which the Worker
enforces for every path (`run_worker_first`), `tools/preflight.mjs` asserts in the config,
and `tools/verify-live.mjs` re-checks against the running site by asking it for
`/source/worker/index.mjs` with no credentials and requiring a refusal.

Two further protections, both running on every build rather than once:

- `.env`, `.dev.vars` and lockfiles are never copied, and the bundle is **scanned for
  credential shapes** — a hit deletes the bundle and fails the build rather than warning.
- `data/editions/bible-kjv/` is skipped from the bundle only: those 4.2 MB already ship at
  `/corpus/bible`, and copying them twice would double the deploy for nothing. They stay in
  the *log*, because the commit that ingested them touched 66 real files.

**The status card is built, not fetched.** The spec has the card fetch the same log the full
view animates, so the two cannot disagree. This status page is generated at build time from
that same file in the same pass, which gives the same guarantee with no runtime failure mode
to handle. It still degrades silently if the log is missing.

## Not built yet

Named plainly, because a spec this detailed makes it obvious what is missing:

- **The folder explorer** (§6.12) and the **source viewer** (§6.13). The bundle and manifest
  they need are already served; only the UI is absent.
- **Orbit lock** on a picked node (§6.9) — picking and the selection panel work, following a
  node with the camera does not.
- **Fullscreen** (§6.15), and the collapsible shared-state HUD (§6.14) — the HUD is there and
  inside the scene, but it does not collapse.
- The selection panel (§6.11) shows path, kind, commit count, liveness at HEAD and the last
  touch; the spec asks for more.

## The window

30 days by default (`--days`), which for this repository is a log of about 11 KB. The
interning in §4.3 keeps that linear in distinct paths rather than in edits, so a longer
window costs much less than it looks like it should — but measure before assuming.
