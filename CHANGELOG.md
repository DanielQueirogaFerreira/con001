# Changelog

Versions are stamped into every artefact this project builds — the reader, the
status page, the production manifest — because team evaluations attach to a
specific build. See [`docs/14-loop.md`](docs/14-loop.md).

Build ids look like `0.1.0-alpha.1+d52ed9f`. A `.dirty` suffix means the tree
had uncommitted changes and the build cannot be reproduced from git.

## 0.1.0-alpha.1 — 2026-09-06

First versioned build. Public Alpha via the `--hold-excluded` gate.

**Corpus** — seven works: Bible, Qur'ān, Analects, Dao De Jing, Bhagavad Gītā,
Principal Upaniṣads, Dhammapada. 23 text units, 17 layers, 23 interpretations,
11 positions, 4 resonances. **No source text is verified**; every passage was
hand-entered to demonstrate the format.

**Shipped**
- Two-level anchoring: mandatory Canonical Reference plus optional character
  span, with grapheme alignment for Hebrew, Arabic and Devanāgarī
- Salience: popularity and contestation as two measures that are never blended,
  with a diversity floor
- Resonance map: positions on questions, never traditions; mandatory divergence
  on every agreement; closed claim vocabulary
- Advisory gate: sign-off by reference to a reviewable RFC in `advisory/`
- Reader and Studio prototype with the contestation slider, the Director Lens
  Hook, and the prompt compiler
- Four licences committed; entity named as a fiscally sponsored project

**Held from this build** — 3 high-consequence items awaiting Hindu and Buddhist
advisory sign-off, named in `dist/manifest.json`. `rfc:001` is open with zero
sign-offs.

**Known gaps** — no annotation, no accounts, no lens sharing, no persistence,
no resonance view in the UI, no generation. `web/status.html` tracks these.
