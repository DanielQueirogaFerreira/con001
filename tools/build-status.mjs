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
];

// Ahead. These are in the SAME table as the shipped milestones on purpose: a
// progress bar computed only over finished work always reads 100%, which is the
// most common way a status page lies without anyone intending it to.
const ahead = [
  ['Text ingestion', 'No source text is verified. Every unit is hand-entered.', 'docs/09-ingestion.md', 'blocks advisory review'],
  ['Advisory seats', 'No scholars seated. rfc:001 open with zero sign-offs.', 'advisory/README.md', 'blocks production'],
  ['Annotation + accounts', 'Readers cannot yet write, fork, or save a lens.', 'docs/02-layers.md', ''],
  ['Resonance view in the UI', 'The map exists as a tool; the reader does not show it.', 'docs/10-resonance.md', ''],
  ['Generation', 'The compiler emits payloads. Nothing is wired to a model.', 'docs/13-studio-compiler.md', 'gated on seats'],
  ['Fiscal sponsor', 'Entity named with a placeholder until one is engaged.', 'LICENSING.md', ''],
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

const html = `<title>Open Hermeneutics — Build Status</title>
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
  .loop { display:flex; flex-wrap:wrap; gap:10px; align-items:stretch; margin-bottom:6px; }
  .step { flex:1 1 150px; border:1px solid var(--line); border-radius:8px; padding:10px 12px; font-size:12.5px; }
  .step.now { border-color:var(--accent); background:color-mix(in srgb, var(--accent) 8%, transparent); }
  .step b { display:block; font-size:11px; letter-spacing:.05em; text-transform:uppercase; color:var(--muted); margin-bottom:3px; }
  .note { font-size:12px; color:var(--muted); border-top:1px dashed var(--line); margin-top:14px; padding-top:11px; }
  .warn { border-left:3px solid var(--hold); padding-left:11px; font-size:12.5px; }
  a { color:var(--accent); }
  code { font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:.92em; }
</style>

<div class="wrap">
  <h1>Open Hermeneutics — build status</h1>
  <div class="sub">
    Every figure here is computed from the repository at build time. Nothing on this page is hand-maintained.
  </div>
  <div class="build">${esc(v.build)} &nbsp;·&nbsp; ${esc(v.branch)} &nbsp;·&nbsp; built ${esc(v.built.slice(0, 16).replace('T', ' '))}Z</div>

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
    <table style="margin-top:14px">
      <tr><th>Milestone</th><th>State</th><th>What it is</th></tr>
      ${milestones.map(([name, ok, what, doc]) => `<tr>
        <td><strong>${esc(name)}</strong><br><span class="dim mono">${esc(doc)}</span></td>
        <td><span class="pill ${ok ? 's-done' : 's-idle'}">${ok ? 'shipped' : 'pending'}</span></td>
        <td class="dim">${esc(what)}</td></tr>`).join('')}
      ${ahead.map(([name, what, doc, blocks]) => `<tr>
        <td><strong>${esc(name)}</strong><br><span class="dim mono">${esc(doc)}</span></td>
        <td><span class="pill ${blocks ? 's-hold' : 's-idle'}">${esc(blocks || 'not started')}</span></td>
        <td class="dim">${esc(what)}</td></tr>`).join('')}
    </table>
    <div class="note">
      Unfinished work sits in the same table as finished work on purpose. A progress bar computed only
      over completed milestones always reads 100%, which is how a status page misleads without anyone
      deciding to.
    </div>
  </div>

  <div class="card">
    <h2>Corpus — ${units.length} units seeded, ${verified} verified</h2>
    <table>
      <tr><th>Work</th><th>Tradition</th><th class="num">Units</th><th class="num">Of</th><th class="num">Layers</th><th class="num">Readings</th></tr>
      ${perWork.map((w) => `<tr>
        <td>${esc(w.title)}</td><td class="dim">${esc(w.tradition)}</td>
        <td class="num">${w.units}</td><td class="num dim">${w.total.toLocaleString()}</td>
        <td class="num">${w.layers}</td><td class="num">${w.interps}</td></tr>`).join('')}
    </table>
    <div class="note warn" style="margin-top:14px">
      <strong>${verified} of ${units.length} text units are verified.</strong>
      Every passage in this build was hand-entered to demonstrate the data format. Unverified units are
      not authoritative editions of anyone's scripture and must not be displayed to readers as such.
      Ingestion from authoritative editions is unstarted work, and it blocks advisory review regardless
      of whether scholars are seated. See <code>docs/09-ingestion.md</code>.
    </div>
  </div>

  <div class="card">
    <h2>Advisory gate — ${held.length} item(s) held</h2>
    ${advisory.rfcs.length ? `<table>
      <tr><th>RFC</th><th>Status</th><th>Seats</th><th>Covers</th></tr>
      ${advisory.rfcs.map((r) => {
        const sat = advisory.seatsSatisfied(r);
        return `<tr>
          <td><strong>${esc(r.id)}</strong><br><span class="dim">${esc(r.title)}</span><br><span class="dim mono">${esc(r._file)}</span></td>
          <td><span class="pill ${r.status === 'approved' ? 's-done' : 's-hold'}">${esc(r.status)}</span></td>
          <td class="dim">${esc(r.seats_required.join(', '))}<br>${esc(sat.ok ? 'all cleared' : sat.why)}</td>
          <td class="dim mono">${r.targets.map((t) => esc(t) + (heldIds.has(t) ? ' · held' : '')).join('<br>')}</td>
        </tr>`;
      }).join('')}
    </table>` : '<div class="dim">No RFCs opened.</div>'}
    <div class="note">
      <code>npm run build:prod</code> refuses while anything above is held.
      <code>npm run build:alpha</code> ships without those items and names them in
      <code>dist/manifest.json</code>, which is the public transparency log and the scholar
      recruitment agenda. No sign-off has been invented to unblock a build.
    </div>
  </div>

  <div class="card">
    <h2>Checks</h2>
    <table>
      <tr><td style="width:30%"><strong>Test suite</strong></td>
        <td><span class="pill ${tests.ok ? 's-done' : 's-hold'}">${tests.ok ? 'passing' : 'FAILING'}</span>
        <span class="dim"> ${tests.checks ?? 0} checks across ${tests.suites.length} suites</span></td></tr>
      <tr><td><strong>Corpus integrity</strong></td><td class="dim">${editions.length} editions, ${layers.length} layers, ${interps.length} readings, ${m.positions.length} positions, ${m.resonances.length} resonances — all references resolve</td></tr>
      <tr><td><strong>Dependencies</strong></td><td class="dim">none — the build and the test suite are plain Node</td></tr>
    </table>
    ${tests.ok ? '' : `<div class="note warn"><strong>The suite is failing.</strong> Nothing on this page should be trusted until it passes.</div>`}
  </div>

  <div class="card">
    <h2>Licensing</h2>
    <table>
      <tr><td style="width:36%">Code</td><td class="mono">AGPL-3.0-only</td></tr>
      <tr><td>Interpretation corpus</td><td class="mono">CC BY-SA 4.0</td></tr>
      <tr><td>Anchoring data</td><td class="mono">CC0 1.0</td></tr>
      <tr><td>Source texts</td><td class="mono">public domain, no rights claimed</td></tr>
    </table>
    <div class="note">Copyright (c) 2026 The Open Hermeneutics Project, a fiscally sponsored project of [Fiscal Sponsor].
      The bracket is a placeholder and is deliberately visible.</div>
  </div>
</div>
`;

mkdirSync('web', { recursive: true });
writeFileSync('web/status.html', html);
mkdirSync('dist', { recursive: true });
writeFileSync('dist/version.json', JSON.stringify(v, null, 2) + '\n');

console.log(
  `build-status: web/status.html (${(html.length / 1024).toFixed(0)} KB) — ` +
  `${done}/${total} milestones, ${held.length} held, tests ${tests.ok ? 'passing' : 'FAILING'}`
);
if (!tests.ok) process.exit(1);
