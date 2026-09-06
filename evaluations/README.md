# UI Evaluations

The loop:

```
   prompt to LLM  ──▶  UI build  ──▶  team evaluation  ──▶  compiled prompt  ──┐
        ▲                                                                      │
        └──────────────────────────────────────────────────────────────────────┘
```

Same mechanism as [`advisory/`](../advisory/README.md), deliberately: one
markdown file whose human argument is the document and whose machine-readable
record is a fenced ` ```json record ` block, reviewed by pull request. A team
already learning one review format should not have to learn two.

## What makes a finding actionable

An evaluation attaches to a **build id**, not to "the UI". `0.1.0-alpha.1+d52ed9f`
is reproducible; "the current version" is not. `npm run version` prints the id
of what you are looking at, and every built page shows it in its header.

Each finding carries **observed** and **expected** separately. "The slider feels
wrong" cannot be acted on. "At slider 0 on gita:2.47 only Śaṅkara shows, and I
expected the diversity floor to keep one dissenting reading visible" can be —
and in that example it would be a genuine bug, because the floor is supposed to
hold above zero only.

## Writing one

Copy `TEMPLATE.md` to `evaluations/NNN-slug.md`, fill it in, open a pull
request. Then:

```
npm run next-prompt
```

compiles every open finding into a single prompt for the next iteration —
grouped by severity, with the files that own each area, and a warning where the
build under evaluation is no longer current.

## Fields

| field | notes |
|---|---|
| `ui` | `reader` or `status` |
| `build` | from `npm run version`, or the page header |
| `reviewer` | a person, not a role |
| `verdict` | `ship`, `iterate`, or `block` |
| `findings[].severity` | `blocker`, `major`, `minor`, `note` |
| `findings[].area` | `text-pane`, `layer-stack`, `contestation-slider`, `director-lens`, `studio`, `status-page`, `general` |
| `findings[].observed` | what happened |
| `findings[].expected` | what you expected instead |
| `findings[].anchor` | optional Canonical Reference, if the finding is passage-specific |
| `status` | `open`, `addressed`, `wontfix` |

`area` is a closed list because it maps to the files that own each part of the
UI — that mapping is what turns an evaluation into a prompt someone can act on
rather than a note someone has to interpret.

## What this is not

It is not the advisory gate. Advisory review governs **claims the system makes
about traditions** and blocks the production build ([`advisory/`](../advisory/README.md)).
Evaluations govern **how the UI works** and block nothing — they queue the next
iteration. Keeping them separate matters: a UI complaint must never be able to
clear a doctrinal gate, and a scholar's objection must never be triaged as a
usability nit.

## Current state

No evaluations recorded. Nothing has been invented to stand in for team
feedback that has not happened yet.
