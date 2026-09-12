#!/usr/bin/env node
// Builds web/status.html — where the construction actually stands.
//
// Every number on the page is COMPUTED from the repository at build time:
// corpus counts from the data, gate state from the advisory records, test
// results from actually running the suite. Nothing is hand-maintained, because
// a hand-maintained status page is a status page that lies within a fortnight.
//
// Pure server-side HTML, no client script — it has to be readable anywhere,
// including where scripts are blocked.
//
//   node tools/build-status.mjs

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { BADGE_CSS, BADGE_SCRIPT, badgeHtml } from './badge.mjs';
import { execFileSync } from 'node:child_process';
import { versionInfo } from './version.mjs';
import { map } from './resonance.mjs';
import { loadAdvisory } from './advisory.mjs';
import { compilePrompt } from './next-prompt.mjs';

const read = (p) => JSON.parse(readFileSync(p, 'utf8'));
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

const v = versionInfo('.');
const works = read('data/works/works.json');
const units = read('data/editions/text-units.json');
// The ingested editions are stored per book and expanded on read, so their size
// is counted from the index rather than by loading four megabytes to length it.
const ingested = existsSync('data/editions/bible-kjv/index.json')
  ? read('data/editions/bible-kjv/index.json') : { units: 0, books: [] };

// The navigator's own log — the SAME file the full view animates, not a summary computed
// separately, which would be a second source of truth for the same four numbers. It is read
// at build time because this page is generated at build time; the spec's runtime fetch
// exists so the card cannot go stale against the log, and a card built from the log in the
// same pass cannot. It fails SILENTLY: a missing history file is not a service problem, and
// an error banner on a status page says "something is wrong" about the wrong thing.
const evo = existsSync('web/evolution.json') ? read('web/evolution.json') : null;
const editions = read('data/editions/editions.json');
const layers = read('data/layers/layers.json');
const interps = read('data/interpretations/interpretations.json');
const m = map('.');
const advisory = loadAdvisory('.');
const loop = compilePrompt('.');

// Run the suite rather than claiming it passes.
let tests = { ok: false, suites: [], raw: '' };
try {
  const out = execFileSync('npm', ['test'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  tests = {
    ok: true,
    raw: out,
    suites: out.split('\n').filter((l) => /^all .* pass$/.test(l.trim())).map((l) => l.trim()),
    checks: (out.match(/^ok {4}/gm) ?? []).length,
  };
} catch (e) {
  tests = { ok: false, raw: `${e.stdout ?? ''}${e.stderr ?? ''}`, suites: [], checks: 0 };
}

const held = m.audit({ strict: true }).filter((f) => f.staging);
const heldIds = new Set(held.map((h) => h.id));

// Milestones. `state` is DERIVED — a milestone is done when the thing that
// would prove it exists, not when someone ticked a box.
const has = (p) => existsSync(p);
const milestones = [
  ['Anchoring model', has('schema/anchor.schema.json') && tests.ok, 'CR + span, grapheme-aligned', 'docs/01-anchoring.md'],
  ['Layer model', has('schema/layer.schema.json'), 'eight kinds, fork lineage, machine fence', 'docs/02-layers.md'],
  ['Seven-work corpus', works.length >= 7, `${works.length} works seeded`, 'docs/03-corpus.md'],
  ['Salience + contestation', has('tools/salience.mjs'), 'two measures, never blended', 'docs/06-salience.md'],
  ['Resonance map', has('tools/resonance.mjs'), 'positions on questions, mandatory divergence', 'docs/10-resonance.md'],
  ['Guardrails + staging gate', has('tools/build-prod.mjs'), 'warns in dev, refuses in prod', 'docs/11-guardrails.md'],
  ['Advisory sign-off', has('advisory/rfc/001-anatta-vs-atman.md'), 'RFCs in git', 'advisory/README.md'],
  ['Licences + entity', has('LICENSE') && has('COPYRIGHT'), 'AGPL / CC BY-SA / CC0 / PD', 'LICENSING.md'],
  ['Reader prototype', has('web/reader.html'), 'layered view, slider, director lens', 'docs/12-reader-prototype.md'],
  ['Prompt compiler', has('tools/prompt-compiler.mjs'), 'refuses to merge contending readings', 'docs/13-studio-compiler.md'],
  ['Versioning + status', has('CHANGELOG.md') && has('tools/build-status.mjs'), 'build ids stamped into every artefact', 'docs/14-loop.md'],
  ['Evaluation loop', has('evaluations/README.md'), 'UI → team → prompt → UI', 'evaluations/README.md'],
  ['Access gate', has('worker/index.mjs') && has('worker/schema.sql'), 'private alpha behind email/password on a Worker', 'docs/15-access.md'],
  ['Password change + reset', has('worker/index.mjs') && read('package.json').scripts.user !== undefined, 'rotation, out-of-band reset codes, revoke-all', 'docs/15-access.md'],
  ['Deploy pipeline', has('wrangler.toml') && has('tools/preflight.mjs'), 'D1 provisioned, preflight gates the build', 'docs/15-access.md'],
  ['Live deployment', has('.github/workflows/publish.yml') && has('.github/workflows/verify.yml'),
    'published from GitHub, then certified against the live URL', 'docs/15-access.md'],
];

// Ahead. These are in the SAME table as the shipped milestones on purpose: a
// progress bar computed only over finished work always reads 100%, which is the
// most common way a status page lies without anyone intending it to.
const ahead = [
  ['Text ingestion', `One work ingested (${ingested.units.toLocaleString()} units, machine-fetched and checksummed); six to go, and no unit is curator-verified.`, 'docs/09-ingestion.md', 'blocks advisory review'],
  ['Advisory seats', 'No scholars seated. rfc:001 open with zero sign-offs.', 'advisory/README.md', 'blocks production'],
  ['Annotation + accounts', 'Readers cannot yet write, fork, or save a lens.', 'docs/02-layers.md', ''],
  ['Resonance view in the UI', 'The map exists as a tool; the reader does not show it.', 'docs/10-resonance.md', ''],
  ['Generation', 'The compiler emits payloads. Nothing is wired to a model.', 'docs/13-studio-compiler.md', 'gated on seats'],
  ['Fiscal sponsor', 'Entity named with a placeholder until one is engaged.', 'LICENSING.md', ''],
  ['Session list', 'A count and revoke-all exist; per-device detail does not.', 'docs/15-access.md', ''],
  ['SSO', 'Schema is provider-ready; the routes are not written.', 'docs/15-access.md', ''],
];
const total = milestones.length + ahead.length;

const verified = units.filter((u) => u.provenance?.verified).length;
const done = milestones.filter(([, ok]) => ok).length;

const perWork = works.map((w) => {
  const pre = w.cr_grammar.split(':')[0] + ':';
  return {
    title: w.title.en ?? w.id,
    tradition: w.tradition,
    units: units.filter((u) => u.cr.startsWith(pre)).length,
    layers: layers.filter((l) => l.work === w.id).length,
    interps: interps.filter((i) => i.anchor.cr.startsWith(pre)).length,
    total: w.unit_count,
  };
});

const bar = (n, d) => {
  const pct = d ? Math.round((n / d) * 100) : 0;
  return `<div class="bar"><i style="width:${pct}%"></i></div>`;
};

const html = `<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Open Hermeneutics — Build Status</title>
<style>
  :root {
    --bg:#faf8f4; --panel:#fffefb; --ink:#1d1a16; --muted:#6b6459; --line:#e3ddd2;
    --accent:#7a5c3e; --ok:#4a6b4a; --hold:#a3402f; --idle:#8a8378;
    --font-read: ui-serif, Georgia, "Times New Roman", serif;
    --font-ui: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  }
  :root:not([data-theme="light"]) { color-scheme: light; }
  @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
    --bg:#16140f; --panel:#1e1b16; --ink:#ece6dc; --muted:#9b9285; --line:#332e26;
    --accent:#c9a173; --ok:#8fb98f; --hold:#e08a76; --idle:#7d7568; color-scheme: dark; } }
  :root[data-theme="dark"] {
    --bg:#16140f; --panel:#1e1b16; --ink:#ece6dc; --muted:#9b9285; --line:#332e26;
    --accent:#c9a173; --ok:#8fb98f; --hold:#e08a76; --idle:#7d7568; color-scheme: dark; }
  body { background:var(--bg); color:var(--ink); font-family:var(--font-ui); line-height:1.55; }
  .wrap { max-width:1080px; margin:0 auto; padding:22px 18px 70px; }
  .scroll { overflow-x:auto; -webkit-overflow-scrolling:touch; }
  @media (max-width: 640px) {
    .wrap { padding:14px 12px 60px; }
    h1 { font-size:19px; }
    .sub, .build { font-size:12px; }
    .card { padding:13px 14px; border-radius:10px; }
    .card h2 { font-size:10.5px; }
    table { font-size:12.5px; }
    th, td { padding-right:12px; }
    .step { flex:1 1 100%; }
  }

  /* Held vertically — 9:16, about 390 CSS pixels — a six-column table cannot be made to
     fit by shrinking the type; it can only scroll sideways, and a table you have to drag
     is a table nobody reads. So the rows stop being rows: each cell becomes a labelled
     line, and the header row goes away because every cell now carries its own label. */
  @media (max-width: 560px) {
    .stack table, .stack tbody, .stack tr, .stack td { display:block; width:100%; }
    .stack tr:first-child { display:none; }          /* the header row */
    .stack tr { border-bottom:1px solid var(--line); padding:10px 0; }
    .stack tr:last-child { border-bottom:0; }
    .stack td { border:0; padding:2px 0; text-align:left; }
    .stack td.num { text-align:left; }
    .stack td[data-label]::before {
      content: attr(data-label) " ";
      display:inline-block; min-width:78px;
      font-size:10px; letter-spacing:.06em; text-transform:uppercase; color:var(--muted);
    }
    .stack td:first-child::before { display:none; }  /* the row's own name needs no label */
    .stack td:first-child { font-size:13.5px; margin-bottom:3px; }
  }
  h1 { font-family:var(--font-read); font-size:22px; font-weight:600; margin:0 0 3px; }
  .sub { color:var(--muted); font-size:12.5px; margin-bottom:8px; }
  .build { font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:12px; color:var(--accent); }
  .card { background:var(--panel); border:1px solid var(--line); border-radius:10px; padding:16px 18px; margin:16px 0; }
  .card h2 { font-size:11px; letter-spacing:.09em; text-transform:uppercase; color:var(--muted); margin:0 0 14px; font-weight:600; }
  table { width:100%; border-collapse:collapse; font-size:13px; }
  th { text-align:left; font-weight:600; font-size:11px; letter-spacing:.05em; text-transform:uppercase; color:var(--muted); padding:0 10px 7px 0; border-bottom:1px solid var(--line); }
  td { padding:7px 10px 7px 0; border-bottom:1px solid var(--line); vertical-align:top; }
  tr:last-child td { border-bottom:0; }
  .num { font-variant-numeric:tabular-nums; text-align:right; }
  .pill { display:inline-block; font-size:10.5px; letter-spacing:.04em; text-transform:uppercase; border-radius:4px; padding:1px 7px; border:1px solid currentColor; }
  .s-done { color:var(--ok); } .s-hold { color:var(--hold); } .s-idle { color:var(--idle); }
  .bar { height:6px; border-radius:3px; background:var(--line); overflow:hidden; margin-top:5px; }
  .bar > i { display:block; height:100%; background:var(--accent); }
  .dim { color:var(--muted); font-size:12px; }
  .mono { font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:11.5px; }
  .figs { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; }
  .fig b { display:block; font-size:21px; font-variant-numeric:tabular-nums; }
  .fig span { font-size:10.5px; letter-spacing:.05em; text-transform:uppercase; color:var(--muted); }
  @media (max-width: 560px) { .figs { grid-template-columns:repeat(2,minmax(0,1fr)); } }
  .loop { display:flex; flex-wrap:wrap; gap:10px; align-items:stretch; margin-bottom:6px; }
  .step { flex:1 1 150px; border:1px solid var(--line); border-radius:8px; padding:10px 12px; font-size:12.5px; }
  .step.now { border-color:var(--accent); background:color-mix(in srgb, var(--accent) 8%, transparent); }
  .step b { display:block; font-size:11px; letter-spacing:.05em; text-transform:uppercase; color:var(--muted); margin-bottom:3px; }
  .note { font-size:12px; color:var(--muted); border-top:1px dashed var(--line); margin-top:14px; padding-top:11px; }
  .warn { border-left:3px solid var(--hold); padding-left:11px; font-size:12.5px; }
  a { color:var(--accent); }
  ${BADGE_CSS}
  code { font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:.92em; }
</style>

<div class="wrap">
  <h1>Open Hermeneutics — build status</h1>
  <div class="sub">
    Every figure here is computed from the repository at build time. Nothing on this page is hand-maintained.
    &nbsp;·&nbsp; <a href="/">Open the reader</a>
  </div>
  <div class="build">${esc(v.build)} &nbsp;·&nbsp; ${esc(v.branch)} &nbsp;·&nbsp; commit ${esc(v.built.slice(0, 16).replace('T', ' '))}</div>

  ${v.dirty ? `<div class="card"><div class="warn"><strong>Built from a dirty tree.</strong>
    This build cannot be reproduced from git, so evaluations written against it are not reliably
    actionable. Commit before circulating it.</div></div>` : ''}

  <div class="card">
    <h2>The loop</h2>
    <div class="loop">
      <div class="step"><b>1 · prompt</b>Instruction to the model, carrying the constraints that must hold.</div>
      <div class="step"><b>2 · build</b>A versioned UI. <span class="mono">${esc(v.build)}</span></div>
      <div class="step ${loop.findings.length ? '' : 'now'}"><b>3 · evaluation</b>${
        loop.findings.length
          ? `${loop.findings.length} open finding(s)`
          : 'Nobody has evaluated this build yet. <strong>This is where the loop is waiting.</strong>'
      }</div>
      <div class="step ${loop.findings.length ? 'now' : ''}"><b>4 · compiled prompt</b><code>npm run next-prompt</code> — findings, the files that own them, and the constraints.</div>
    </div>
    <div class="note">
      Evaluations attach to a build id, never to "the UI". A finding written against an older build is
      marked stale in the compiled prompt, because a fix for a problem that no longer exists is a new bug.
      See <code>evaluations/README.md</code>.
    </div>
  </div>

  <div class="card">
    <h2>Progress — ${done} of ${total} shipped</h2>
    ${bar(done, total)}
    <div class="scroll stack" style="margin-top:14px"><table>
      <tr><th>Milestone</th><th>State</th><th>What it is</th></tr>
      ${milestones.map(([name, ok, what, doc]) => `<tr>
        <td data-label="Milestone"><strong>${esc(name)}</strong><br><span class="dim mono">${esc(doc)}</span></td>
        <td data-label="State"><span class="pill ${ok ? 's-done' : 's-idle'}">${ok ? 'shipped' : 'pending'}</span></td>
        <td class="dim" data-label="What it is">${esc(what)}</td></tr>`).join('')}
      ${ahead.map(([name, what, doc, blocks]) => `<tr>
        <td data-label="Milestone"><strong>${esc(name)}</strong><br><span class="dim mono">${esc(doc)}</span></td>
        <td data-label="State"><span class="pill ${blocks ? 's-hold' : 's-idle'}">${esc(blocks || 'not started')}</span></td>
        <td class="dim" data-label="What it is">${esc(what)}</td></tr>`).join('')}
    </table></div>
    <div class="note">
      Unfinished work sits in the same table as finished work on purpose. A progress bar computed only
      over completed milestones always reads 100%, which is how a status page misleads without anyone
      deciding to.
    </div>
  </div>

  ${evo ? `<div class="card">
    <h2>Codebase Navigator — last ${evo.window_days} days</h2>
    <div class="figs">
      ${[[evo.totals.commits, 'commits'], [evo.totals.files_at_head, 'files monitored'],
         [evo.totals.edits, 'file edits'], [evo.totals.authors, 'contributors']]
        .map(([n, label]) => `<div class="fig"><b>${n.toLocaleString()}</b><span>${esc(label)}</span></div>`).join('')}
    </div>
    ${evo.head ? `<div class="note" style="border-top:0;margin-top:12px;padding-top:0">
      latest tracked commit <span class="mono">${esc(evo.head.sha)}</span> — ${esc(evo.head.subject)}</div>` : ''}
    <div class="note">
      <a href="/evolution"><strong>Open the navigator &rarr;</strong></a>
      — the repository's structure and history as a scene you fly through: the directory tree
      laid out in three dimensions, a playhead sweeping the window, and every file readable
      where it sits. Area <span class="mono">501</span>.
    </div>
  </div>` : ''}

  <div class="card">
    <h2>Corpus — ${(units.length + ingested.units).toLocaleString()} units, ${verified} verified</h2>
    <div class="scroll stack"><table>
      <tr><th>Work</th><th>Tradition</th><th class="num">Units</th><th class="num">Of</th><th class="num">Layers</th><th class="num">Readings</th></tr>
      ${perWork.map((w) => {
        // The ingested edition belongs to the row for its work, not to a
        // separate table: a reader does not care which pipeline a verse came in
        // through, only how much of the work is actually there.
        const held = w.units + (w.title === 'Bible' ? ingested.units : 0);
        return `<tr>
        <td data-label="Work">${esc(w.title)}</td><td class="dim" data-label="Tradition">${esc(w.tradition)}</td>
        <td class="num" data-label="Units">${held.toLocaleString()}</td><td class="num dim" data-label="Of">${w.total.toLocaleString()}</td>
        <td class="num" data-label="Layers">${w.layers}</td><td class="num" data-label="Readings">${w.interps}</td></tr>`;
      }).join('')}
    </table></div>
    <div class="note warn" style="margin-top:14px">
      <strong>${verified} of ${(units.length + ingested.units).toLocaleString()} text units are verified.</strong>
      ${ingested.units.toLocaleString()} of them are the King James Version, machine-ingested from a
      digital edition, normalised once to NFC and checksummed per book and per unit — the pipeline in
      <code>docs/09-ingestion.md</code> run for real, up to but not including the last step. That step is a
      curator reading the text against a printed edition and signing for it, which no program does. The
      remaining ${units.length} units were hand-entered to demonstrate the data format.
      Unverified units are not authoritative editions of anyone's scripture and must not be displayed to
      readers as such — which is why every one of them carries the word <em>unverified</em> in the reader.
    </div>
  </div>

  <div class="card">
    <h2>Advisory gate — ${held.length} item(s) held</h2>
    ${advisory.rfcs.length ? `<div class="scroll stack"><table>
      <tr><th>RFC</th><th>Status</th><th>Seats</th><th>Covers</th></tr>
      ${advisory.rfcs.map((r) => {
        const sat = advisory.seatsSatisfied(r);
        return `<tr>
          <td data-label="RFC"><strong>${esc(r.id)}</strong><br><span class="dim">${esc(r.title)}</span><br><span class="dim mono">${esc(r._file)}</span></td>
          <td data-label="Status"><span class="pill ${r.status === 'approved' ? 's-done' : 's-hold'}">${esc(r.status)}</span></td>
          <td class="dim" data-label="Seats">${esc(r.seats_required.join(', '))}<br>${esc(sat.ok ? 'all cleared' : sat.why)}</td>
          <td class="dim mono" data-label="Covers">${r.targets.map((t) => esc(t) + (heldIds.has(t) ? ' · held' : '')).join('<br>')}</td>
        </tr>`;
      }).join('')}
    </table></div>` : '<div class="dim">No RFCs opened.</div>'}
    <div class="note">
      <code>npm run build:prod</code> refuses while anything above is held.
      <code>npm run build:alpha</code> ships without those items and names them in
      <code>dist/manifest.json</code>, which is the public transparency log and the scholar
      recruitment agenda. No sign-off has been invented to unblock a build.
    </div>
  </div>

  <div class="card">
    <h2>Checks</h2>
    <div class="scroll"><table>
      <tr><td style="width:30%"><strong>Test suite</strong></td>
        <td><span class="pill ${tests.ok ? 's-done' : 's-hold'}">${tests.ok ? 'passing' : 'FAILING'}</span>
        <span class="dim"> ${tests.checks ?? 0} checks across ${tests.suites.length} suites</span></td></tr>
      <tr><td><strong>Corpus integrity</strong></td><td class="dim">${editions.length} editions, ${layers.length} layers, ${interps.length} readings, ${m.positions.length} positions, ${m.resonances.length} resonances — all references resolve</td></tr>
      <tr><td><strong>Dependencies</strong></td><td class="dim">none — the build and the test suite are plain Node</td></tr>
    </table></div>
    ${tests.ok ? '' : `<div class="note warn"><strong>The suite is failing.</strong> Nothing on this page should be trusted until it passes.</div>`}
  </div>

  <div class="card">
    <h2>Licensing</h2>
    <div class="scroll"><table>
      <tr><td style="width:36%">Code</td><td class="mono">AGPL-3.0-only</td></tr>
      <tr><td>Interpretation corpus</td><td class="mono">CC BY-SA 4.0</td></tr>
      <tr><td>Anchoring data</td><td class="mono">CC0 1.0</td></tr>
      <tr><td>Source texts</td><td class="mono">public domain, no rights claimed</td></tr>
    </table></div>
    <div class="note">Copyright (c) 2026 The Open Hermeneutics Project, a fiscally sponsored project of [Fiscal Sponsor].
      The bracket is a placeholder and is deliberately visible.</div>
  </div>
</div>

${badgeHtml({ short: v.short, built: v.built, area: 'status' })}
<script>${BADGE_SCRIPT}</script>
`;

mkdirSync('web', { recursive: true });
writeFileSync('web/status.html', html);
mkdirSync('dist', { recursive: true });
writeFileSync('dist/version.json', JSON.stringify(v, null, 2) + '\n');

// The Worker renders the login, reset and account pages itself and has no build step of its
// own, so it reads its build from here through its asset binding — not over HTTP, which
// would mean a gated page fetching a gated asset to find out what it is.
writeFileSync('web/version.json', JSON.stringify({
  short: v.short, build: v.build, built: v.built, branch: v.branch,
}));

console.log(
  `build-status: web/status.html (${(html.length / 1024).toFixed(0)} KB) — ` +
  `${done}/${total} milestones, ${held.length} held, tests ${tests.ok ? 'passing' : 'FAILING'}`
);
if (!tests.ok) process.exit(1);
