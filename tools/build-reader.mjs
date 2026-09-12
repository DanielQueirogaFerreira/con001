#!/usr/bin/env node
// Builds web/reader.html — a self-contained Reader + Studio prototype with the
// corpus inlined, so it opens from the filesystem with no server and no
// dependencies. That is not a shortcut: it is the cost architecture from
// docs/08-open-source-and-cost.md made literal. The corpus is static and
// immutable, so the reading surface is a file.
//
//   node tools/build-reader.mjs            all data
//   node tools/build-reader.mjs --prod     production set only (held items excluded)

import { readFileSync, writeFileSync, mkdirSync, cpSync } from 'node:fs';
import { BADGE_CSS, BADGE_SCRIPT, badgeHtml } from './badge.mjs';
import { AREAS_CSS, areasNav } from './areas.mjs';
import { map } from './resonance.mjs';
import { versionInfo } from './version.mjs';

// The prompt compiler is inlined verbatim rather than reimplemented, so the
// browser runs exactly the module Node tests. It is written import-free for
// this reason; `export` is the only thing stripped.
const COMPILER = readFileSync('tools/prompt-compiler.mjs', 'utf8')
  .replace(/^export (const|function) /gm, '$1 ');

const read = (p) => JSON.parse(readFileSync(p, 'utf8'));
// Build-time escaping. The browser code below defines its own; this one is for
// the values baked into the markup here.
const attr = (v) => String(v).replace(/[&<>"]/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const prod = process.argv.includes('--prod');

const works = read('data/works/works.json');
const editions = read('data/editions/editions.json');
const units = read('data/editions/text-units.json');
const layers = read('data/layers/layers.json');
const interps = read('data/interpretations/interpretations.json');
const questions = read('data/questions/questions.json');

const m = map('.');
const set = prod ? m.productionSet() : { positions: m.positions, resonances: m.resonances, held: [] };

// The anchors the prototype opens on. Everything for these is inlined; the
// Bible's 31,102 verses are not — they are fetched a book at a time from
// /corpus/bible, which is why the whole edition can be here without the page
// weighing four megabytes.
const ANCHORS = ['bible:GEN.1.1', 'bible:JHN.1.1', 'bible:JHN.3.16',
                 'gita:2.47', 'dhammapada:1', 'upanishad:ISH.1', 'daodejing:1', 'quran:2:1'];

const bibleIndex = read('data/editions/bible-kjv/index.json');

const version = versionInfo('.');
const corpus = {
  build: version.build,
  built: version.built.slice(0, 10),
  mode: prod ? 'production' : 'development',
  held: set.held,
  anchors: ANCHORS,
  works,
  editions,
  units: units.filter((u) => ANCHORS.includes(u.cr)),
  layers,
  interps: interps.filter((i) => ANCHORS.includes(i.anchor.cr)),
  questions,
  positions: set.positions,
  resonances: set.resonances,
  bible: { books: bibleIndex.books, units: bibleIndex.units, source: bibleIndex.source },
};

const html = `<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Open Hermeneutics Reader</title>
<style>
  :root {
    --bg: #faf8f4; --panel: #fffefb; --ink: #1d1a16; --muted: #6b6459;
    --line: #e3ddd2; --accent: #7a5c3e; --hot: #a3402f; --cool: #3c5a6b;
    --machine: #5b4b7a; --blocked: #8c2f22;
    --font-read: ui-serif, Georgia, "Times New Roman", serif;
    --font-ui: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  }
  :root:not([data-theme="light"]) { color-scheme: light; }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --bg: #16140f; --panel: #1e1b16; --ink: #ece6dc; --muted: #9b9285;
      --line: #332e26; --accent: #c9a173; --hot: #e08a76; --cool: #86b3c9;
      --machine: #a992d6; --blocked: #e08a76; color-scheme: dark;
    }
  }
  :root[data-theme="dark"] {
    --bg: #16140f; --panel: #1e1b16; --ink: #ece6dc; --muted: #9b9285;
    --line: #332e26; --accent: #c9a173; --hot: #e08a76; --cool: #86b3c9;
    --machine: #a992d6; --blocked: #e08a76; color-scheme: dark;
  }
  body { background: var(--bg); color: var(--ink); font-family: var(--font-ui); line-height: 1.5; }
  .wrap { max-width: 1400px; margin: 0 auto; padding: 20px 18px 60px; }
  h1 { font-family: var(--font-read); font-size: 20px; font-weight: 600; margin: 0 0 2px; }
  .sub { color: var(--muted); font-size: 12.5px; margin-bottom: 18px; }
  .bar { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
  button.anchor {
    font: inherit; font-size: 12.5px; padding: 6px 11px; border-radius: 999px; cursor: pointer;
    border: 1px solid var(--line); background: var(--panel); color: var(--muted);
  }
  button.anchor[aria-pressed="true"] { border-color: var(--accent); color: var(--ink); font-weight: 600; }
  .cols { display: grid; grid-template-columns: minmax(0,1.15fr) minmax(0,1fr); gap: 18px; }
  @media (max-width: 900px) { .cols { grid-template-columns: minmax(0,1fr); } }

  /* Held vertically, this is a reading surface first: one column, the text at a
     size you can actually read, and every control big enough to hit with a
     thumb. The anchor bar scrolls sideways rather than wrapping into four rows
     that push the text off the screen. */
  @media (max-width: 640px) {
    .wrap { padding: 14px 12px 72px; }
    h1 { font-size: 17px; }
    .sub { font-size: 12px; }
    .cols { gap: 12px; }
    .card { padding: 14px; border-radius: 10px; }
    .bar { display: flex; flex-wrap: nowrap; gap: 6px; overflow-x: auto; padding-bottom: 6px;
           scrollbar-width: none; -webkit-overflow-scrolling: touch; }
    .bar::-webkit-scrollbar { display: none; }
    .anchor { flex: 0 0 auto; padding: 9px 13px; font-size: 12.5px; }
    .src, .tr { font-size: 16px; line-height: 1.75; }
    .verses { max-height: 52vh; }
    .verse { padding: 9px 8px; font-size: 15.5px; }
    .verse b { min-width: 40px; }
    select { padding: 9px 10px; font-size: 14px; flex: 1 1 auto; min-width: 0; }
    input[type="range"] { height: 30px; }
  }
  .card { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 16px; margin-bottom: 16px; }
  .card h2 { font-size: 11px; letter-spacing: .09em; text-transform: uppercase; color: var(--muted); margin: 0 0 12px; font-weight: 600; }
  .src { font-family: var(--font-read); font-size: 21px; line-height: 1.75; margin: 0 0 12px; }
  .src[dir="rtl"] { text-align: right; }
  .tr { font-family: var(--font-read); font-size: 15.5px; color: var(--muted); line-height: 1.7; border-top: 1px dashed var(--line); padding-top: 12px; margin: 0; }
  mark { background: color-mix(in srgb, var(--accent) 24%, transparent); color: inherit; border-radius: 3px; padding: 1px 0; }
  .meter { height: 7px; border-radius: 4px; background: var(--line); overflow: hidden; margin: 6px 0 4px; }
  .meter > i { display: block; height: 100%; background: linear-gradient(90deg, var(--cool), var(--hot)); }
  .row { display: flex; justify-content: space-between; gap: 10px; font-size: 12px; color: var(--muted); }
  input[type=range] { width: 100%; accent-color: var(--accent); }
  .gloss { border-left: 3px solid var(--line); padding: 2px 0 2px 12px; margin-bottom: 14px; }
  .gloss.on { border-left-color: var(--accent); }
  .gloss.machine { border-left-color: var(--machine); background: color-mix(in srgb, var(--machine) 7%, transparent); border-radius: 0 6px 6px 0; padding-right: 10px; }
  .who { font-size: 12.5px; font-weight: 600; }
  .meta { font-size: 11px; color: var(--muted); margin: 1px 0 6px; }
  .body { font-size: 13.5px; }
  .body p { margin: 0 0 7px; }
  .tag { display: inline-block; font-size: 10px; letter-spacing: .05em; text-transform: uppercase; border: 1px solid var(--line); border-radius: 4px; padding: 1px 5px; color: var(--muted); margin-left: 6px; }
  .tag.machine { border-color: var(--machine); color: var(--machine); }
  .tag.hidden-by-slider { opacity: .5; }
  label.tog { display: flex; gap: 8px; align-items: flex-start; font-size: 12.5px; padding: 5px 0; cursor: pointer; }
  label.tog input { margin-top: 3px; accent-color: var(--accent); }
  .dim { color: var(--muted); font-size: 11.5px; }
  .direct { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11.5px; white-space: pre-wrap; line-height: 1.65; }
  .direct .k { color: var(--accent); }
  .direct .no { color: var(--hot); }
  .note { font-size: 11.5px; color: var(--muted); border-top: 1px dashed var(--line); margin-top: 12px; padding-top: 10px; }
  .warn { border-left: 3px solid var(--hot); padding-left: 10px; font-size: 12px; margin-top: 10px; }
  .block { border: 1px solid var(--blocked); color: var(--blocked); border-radius: 6px; padding: 9px 11px; font-size: 12px; margin-bottom: 10px; }
  .scroll { overflow-x: auto; }
  .link { background: none; border: 0; font: inherit; font-size: 12px; color: var(--accent); cursor: pointer; padding: 0; text-decoration: underline; }
  .pay { border: 1px solid var(--line); border-radius: 8px; padding: 12px; margin-bottom: 12px; }
  .pay h3 { font-size: 12.5px; margin: 0 0 8px; font-weight: 600; }
  .fld { font-size: 11px; letter-spacing: .07em; text-transform: uppercase; color: var(--muted); margin: 10px 0 3px; }
  .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11.5px; line-height: 1.6; white-space: pre-wrap; word-break: break-word; }
  .neg { color: var(--hot); }
  .lock { color: var(--blocked); font-weight: 600; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
  .chip { font-size: 11px; border: 1px solid var(--line); border-radius: 999px; padding: 2px 9px; color: var(--muted); }
  .split { border-left: 3px solid var(--hot); padding-left: 10px; font-size: 12px; margin-bottom: 12px; }
  a { color: var(--accent); }
  ${BADGE_CSS}
  ${AREAS_CSS}
  select { font: inherit; font-size: 12.5px; color: var(--ink); background: var(--panel);
           border: 1px solid var(--line); border-radius: 6px; padding: 4px 8px; }
  .verses { margin-top: 12px; max-height: 340px; overflow-y: auto; }
  .verse { display: flex; gap: 10px; align-items: baseline; width: 100%; text-align: left;
           background: none; border: 0; border-radius: 6px; padding: 5px 7px; cursor: pointer;
           font-family: var(--font-read); font-size: 14px; color: var(--ink); line-height: 1.55; }
  .verse:hover { background: color-mix(in srgb, var(--accent) 8%, transparent); }
  .verse[aria-current="true"] { background: color-mix(in srgb, var(--accent) 14%, transparent); }
  .verse b { font-family: var(--font-ui); font-size: 10.5px; color: var(--muted);
             min-width: 34px; text-align: right; font-variant-numeric: tabular-nums; }
  .verse .has { color: var(--accent); }
  .selanchor { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11.5px;
               border: 1px solid var(--line); border-left: 3px solid var(--accent);
               border-radius: 0 7px 7px 0; padding: 9px 11px; margin-top: 10px; color: var(--muted); }
  .selanchor b { color: var(--ink); font-weight: 600; }
  .selanchor q { font-family: var(--font-read); font-size: 13.5px; color: var(--ink); display: block; margin-top: 6px; }
  .act { font: inherit; font-size: 12.5px; padding: 8px 13px; border-radius: 7px; cursor: pointer;
         border: 1px solid var(--line); background: var(--panel); color: var(--ink); }
  .act:hover { border-color: var(--accent); color: var(--accent); }
  .act[disabled] { opacity: .5; cursor: default; }
  .out { margin-top: 12px; font-size: 12.5px; color: var(--muted); }
  .out img, .out video { width: 100%; border-radius: 8px; border: 1px solid var(--line); margin-top: 10px; display: block; }
  .out .fail { border-left: 3px solid var(--hot); color: var(--hot); padding-left: 10px; }
  .machine-mark { font-size: 11px; color: var(--machine); margin-top: 6px; }

</style>

<div class="wrap">
  <h1>Open Hermeneutics — Reader &amp; Studio prototype</h1>
  <div class="sub">
    Seven works. Layered reading, the contestation slider, and the Director Lens Hook.
    <span id="mode"></span> ·
    <strong>no source text here is verified</strong> — the King James Version below is machine-ingested
    and checksummed but not curator-signed; the sample passages in other works were hand-entered.
  </div>

  ${areasNav('/')}

  <div class="bar" id="anchors"></div>

  <div class="cols">
    <div>
      <div class="card">
        <h2>The text</h2>
        <div id="text"></div>
      </div>
      <div class="card">
        <h2>Layers on this anchor</h2>
        <div id="glosses"></div>
      </div>

      <div class="card">
        <h2>Bible — the whole text</h2>
        <div class="row" style="gap:8px;flex-wrap:wrap">
          <select id="bkBook"></select>
          <select id="bkChapter"></select>
          <span class="dim" id="bkNote"></span>
        </div>
        <div id="bkVerses" class="verses"></div>
      </div>
    </div>

    <div>
      <div class="card">
        <h2>Contestation</h2>
        <div class="meter"><i id="cmeter"></i></div>
        <div class="row"><span id="cnum"></span><span id="cvoices"></span></div>
        <div style="margin-top:14px">
          <div class="row" style="margin-bottom:4px">
            <span>settled reading only</span><span>every argument</span>
          </div>
          <input type="range" id="slider" min="0" max="100" value="100">
          <div class="dim" id="sliderNote" style="margin-top:6px"></div>
        </div>
      </div>

      <div class="card">
        <h2>Layer stack</h2>
        <div id="stack"></div>
      </div>

      <div class="card">
        <h2>Director lens — composed visual directive</h2>
        <div id="director"></div>
        <div class="note" style="display:flex;justify-content:space-between;align-items:center">
          <button class="link" id="studioToggle">Open Studio — compile prompts &rarr;</button>
          <span class="dim" id="studioHint"></span>
        </div>
      </div>

      <div class="card" id="compose">
        <h2>Compose from this passage</h2>
        <div id="selNote" class="dim">Select any words in the text, or drag across verses, to anchor a rendering to exactly that much of the passage.</div>
        <div id="selAnchor" class="selanchor" hidden></div>
        <div class="row" style="gap:8px;margin-top:12px;flex-wrap:wrap">
          <button class="act" data-medium="image" data-provider="google">Image &mdash; Nano Banana Pro</button>
          <button class="act" data-medium="image" data-provider="openai">Image &mdash; GPT Image 2.5 Flare</button>
          <button class="act" data-medium="video" data-provider="google">Video &mdash; Omni Flash</button>
        </div>
        <p class="dim" style="margin:8px 0 0">Two image models, one reading. The same compiled payload
          goes to both, so a difference between the results is the model's, not the prompt's.</p>
        <div id="composeOut" class="out"></div>
      </div>

      <div class="card" id="studio" hidden>
        <h2>Studio — compiled generation payload</h2>
        <div id="payloads"></div>
      </div>
    </div>
  </div>
</div>

${badgeHtml({ short: version.short, built: version.built, area: 'reader' })}

<script id="corpus" type="application/json">${JSON.stringify(corpus).replace(/</g, '\\u003c')}</script>
<script>
${COMPILER}
</script>
<script>
const C = JSON.parse(document.getElementById('corpus').textContent);

document.getElementById('mode').textContent = C.mode + (C.held.length ? \` · \${C.held.length} item(s) held for review\` : '');

const layerOf = Object.fromEntries(C.layers.map(l => [l.id, l]));
const edOf = Object.fromEntries(C.editions.map(e => [e.id, e]));
const cps = s => [...s];

let anchor = C.anchors[0];
let openness = 1;                 // the contestation slider, 0..1
let studioOpen = false;
let soloLens = null;              // compile one lens alone
const manual = new Map();         // explicit per-layer overrides

const forAnchor = cr => C.interps.filter(i => i.anchor.cr === cr);
const stanceOf = i => layerOf[i.layer]?.stance ?? layerOf[i.layer]?.kind ?? 'unknown';
const weightOf = i => layerOf[i.layer]?.canonical?.weight ?? 0;
const isTradition = i => {
  const l = layerOf[i.layer];
  return l && l.kind !== 'personal' && l.kind !== 'machine' && (l.canonical?.weight ?? 0) > 0;
};

// Contestation, the same formula as tools/salience.mjs.
function contestation(cr) {
  const all = forAnchor(cr), voices = all.filter(isTradition);
  const mass = {}; let total = 0;
  for (const i of voices) { const s = stanceOf(i); mass[s] = (mass[s] ?? 0) + weightOf(i); total += weightOf(i); }
  let H = 0;
  if (total > 0) for (const v of Object.values(mass)) { const p = v / total; if (p > 0) H -= p * Math.log(p); }
  const k = Object.keys(mass).length;
  const spread = k > 1 ? Math.min(1, H / Math.log(k)) : 0;
  const here = new Set(all.map(i => i.id));
  const reb = voices.filter(i => ['rebuts','questions'].includes(i.relation) && (i.derived_from ?? []).some(p => here.has(p))).length;
  const density = voices.length > 1 ? Math.min(1, reb / (voices.length - 1)) : 0;
  return { index: 0.6 * spread + 0.4 * density, voices: voices.length, stances: k };
}

// The slider. At 0 only the leading stance is shown; raising it admits
// dissenting stances in order of how far they sit from that leading reading.
// The DIVERSITY FLOOR from docs/06-salience.md means the second stance is
// admitted immediately above zero — the majority reading is never alone.
function visible() {
  const all = forAnchor(anchor);
  const trad = all.filter(isTradition);
  if (!trad.length) return { on: new Set(all.map(i => i.id)), floor: null, leading: null };

  const byStance = {};
  for (const i of trad) (byStance[stanceOf(i)] ??= []).push(i);
  const leading = Object.entries(byStance).sort((a, b) =>
    b[1].reduce((s, i) => s + weightOf(i), 0) - a[1].reduce((s, i) => s + weightOf(i), 0))[0][0];

  const others = Object.keys(byStance).filter(s => s !== leading);
  const admit = openness === 0 ? 0 : Math.max(1, Math.ceil(openness * others.length));
  const shown = new Set([leading, ...others.slice(0, admit)]);
  const on = new Set(trad.filter(i => shown.has(stanceOf(i))).map(i => i.id));
  for (const i of all) if (!isTradition(i) && manual.get(i.id)) on.add(i.id);
  for (const [id, v] of manual) v ? on.add(id) : on.delete(id);
  return { on, floor: openness > 0 && others.length ? others[0] : null, leading, others: others.length };
}

function highlightsFor(unitEdition, ids) {
  return forAnchor(anchor)
    .filter(i => ids.has(i.id) && i.anchor.span?.origin === unitEdition)
    .map(i => i.anchor.span).sort((a, b) => a.start - b.start);
}

// Units inlined at build time, plus any verse fetched since. A verse the
// reader opened from the Bible panel behaves exactly like one that shipped
// with the page — same highlighting, same layers, same everything.
const fetched = new Map();
const unitsAt = cr => [...C.units, ...fetched.values()].filter(u => u.cr === cr);

function renderText(ids) {
  const us = unitsAt(anchor);
  const el = document.getElementById('text');
  el.innerHTML = '';
  for (const u of us) {
    const ed = edOf[u.edition];
    const spans = highlightsFor(u.edition, ids);
    const chars = cps(u.text);
    let out = '', at = 0;
    const esc = s => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    for (const s of spans) {
      if (s.start < at) continue;
      out += esc(chars.slice(at, s.start).join('')) + '<mark>' + esc(chars.slice(s.start, s.end).join('')) + '</mark>';
      at = s.end;
    }
    out += esc(chars.slice(at).join(''));
    const isSrc = ed.kind === 'source' || ed.kind === 'critical';
    const d = document.createElement('div');
    d.dataset.cr = u.cr;
    d.dataset.edition = u.edition;
    d.innerHTML = \`<p class="\${isSrc ? 'src' : 'tr'}" dir="\${ed.direction || 'ltr'}">\${out}</p>
      <div class="meta">\${ed.title}\${ed.authority === 'interpretive-of-meaning'
        ? ' <span class="tag">interpretation of the meaning, not the Qur\\u2019\\u0101n</span>' : ''}
      \${u.provenance?.verified ? '' : ' <span class="tag">unverified</span>'}</div>\`;
    el.appendChild(d);
  }
}

function renderGlosses(ids) {
  const el = document.getElementById('glosses');
  const all = forAnchor(anchor).sort((a, b) => weightOf(b) - weightOf(a));
  el.innerHTML = all.map(i => {
    const l = layerOf[i.layer], on = ids.has(i.id), machine = l.kind === 'machine';
    const md = i.body.value.split('\\n\\n').map(p =>
      '<p>' + p.replace(/&/g,'&amp;').replace(/</g,'&lt;')
        .replace(/\\*\\*(.+?)\\*\\*/g, '<strong>$1</strong>')
        .replace(/\\*(.+?)\\*/g, '<em>$1</em>')
        .replace(/\`(.+?)\`/g, '<code>$1</code>') + '</p>').join('');
    return \`<div class="gloss \${on ? 'on' : ''} \${machine ? 'machine' : ''}" style="\${on ? '' : 'display:none'}">
      <div class="who">\${l.author.display}
        \${machine ? '<span class="tag machine">machine-authored</span>' : ''}
        \${l.kind === 'variant' ? '<span class="tag">variant</span>' : ''}</div>
      <div class="meta">\${l.stance ?? l.kind}\${i.citation ? ' · ' + i.citation : ''}\${i.relation ? ' · ' + i.relation : ''}</div>
      <div class="body">\${md}</div></div>\`;
  }).join('') || '<div class="dim">No layers on this anchor.</div>';
  const hidden = all.filter(i => !ids.has(i.id)).length;
  if (hidden) el.innerHTML += \`<div class="note">\${hidden} reading(s) hidden at this slider position.</div>\`;
}

function renderStack(ids) {
  const el = document.getElementById('stack');
  el.innerHTML = forAnchor(anchor).sort((a, b) => weightOf(b) - weightOf(a)).map(i => {
    const l = layerOf[i.layer];
    return \`<label class="tog"><input type="checkbox" data-id="\${i.id}" \${ids.has(i.id) ? 'checked' : ''}>
      <span><strong data-lens="\${l.id}">\${l.title.en ?? l.id}</strong>
        \${l.kind === 'machine' ? '<span class="tag machine">machine</span>' : ''}
        <br><span class="dim">\${l.stance ?? l.kind} · canonical weight \${(l.canonical?.weight ?? 0).toFixed(2)}</span></span></label>\`;
  }).join('');
  el.querySelectorAll('input').forEach(b =>
    b.addEventListener('change', e => { manual.set(e.target.dataset.id, e.target.checked); render(); }));
  el.querySelectorAll('strong[data-lens]').forEach(n => {
    n.style.cursor = 'pointer'; n.title = 'Compile this lens alone';
    n.addEventListener('click', () => { soloLens = n.dataset.lens; studioOpen = true; render(); });
  });
}

// The Director Lens Hook. Active layers compose a visual directive, and where
// two readings direct the scene differently the tension is SHOWN, not resolved
// — the same rule the reading surface follows.
function renderDirector(ids) {
  const active = forAnchor(anchor).filter(i => ids.has(i.id))
    .map(i => layerOf[i.layer]).filter(l => l.direction);
  const el = document.getElementById('director');
  if (!active.length) { el.innerHTML = '<div class="dim">No directing layer active.</div>'; return; }

  const blocked = active.filter(l => l.direction.figural === 'blocked');
  const motifs = [...new Set(active.flatMap(l => l.direction.motifs))];
  const avoid = [...new Set(active.flatMap(l => l.direction.avoid))];

  // Where the lenses pull the scene apart. Two sources, and the first is
  // authoritative: if one reading REBUTS another in the fork graph, they are by
  // definition not directing the same image. The lexical check is only a hint.
  const shown = forAnchor(anchor).filter(i => ids.has(i.id));
  const byId = Object.fromEntries(shown.map(i => [i.id, i]));
  const clash = [];
  for (const i of shown) {
    if (!['rebuts', 'questions'].includes(i.relation)) continue;
    for (const pid of i.derived_from ?? []) {
      const parent = byId[pid];
      if (!parent) continue;
      const a = layerOf[i.layer], b = layerOf[parent.layer];
      if (!a?.direction || !b?.direction) continue;
      clash.push(\`\${a.author.display} <em>\${i.relation}</em> \${b.author.display}: directs \u201c\${a.direction.register.split(' \u2014 ')[0]}\u201d where \${b.author.display} directs \u201c\${b.direction.register.split(' \u2014 ')[0]}\u201d\`);
    }
  }
  for (const a of active) for (const b of active) {
    if (a === b) continue;
    for (const mo of a.direction.motifs) for (const av of b.direction.avoid) {
      const key = w => w.toLowerCase().split(/\\W+/).filter(x => x.length > 4);
      if (key(mo).some(w => key(av).includes(w)))
        clash.push(\`\${a.author.display} directs \u201c\${mo}\u201d — \${b.author.display} excludes \u201c\${av}\u201d\`);
    }
  }

  el.innerHTML =
    (blocked.length ? \`<div class="block"><strong>Figural depiction blocked</strong> by corpus policy
      (\${blocked.map(l => l.title.en ?? l.id).join(', ')}). The gate runs before generation, has no user
      override, and a refusal names this rule. See docs/04-generative.md.</div>\` : '') +
    \`<div class="direct"><span class="k">anchor</span>   \${anchor}
<span class="k">lenses</span>   \${active.map(l => l.author.display).join(' + ')}
<span class="k">register</span> \${active.map(l => l.direction.register).join('\\n         ')}
<span class="k">motifs</span>   \${motifs.join('\\n         ')}
<span class="no">avoid</span>    \${avoid.join('\\n         ')}
<span class="k">palette</span>  \${[...new Set(active.map(l => l.direction.palette).filter(Boolean))].join(' / ')}</div>\` +
    (clash.length ? \`<div class="warn"><strong>These lenses direct the scene differently.</strong>
      The studio shows the tension rather than averaging it — an image that splits the difference
      represents no reading at all.<br><br>\${[...new Set(clash)].slice(0, 4).join('<br>')}</div>\` : '') +
    \`<div class="note">Nothing is generated here. This is the directive a rendition would carry, together with
      its lens, so the output is attributed to a <em>reading</em> and never to the text.</div>\`;
}

// The Studio drawer. Runs the SAME compiler module the Node tests run.
function renderStudio(ids) {
  const card = document.getElementById('studio');
  const hint = document.getElementById('studioHint');
  const btn = document.getElementById('studioToggle');
  card.hidden = !studioOpen;
  btn.textContent = studioOpen ? 'Close Studio' : 'Open Studio — compile prompts \u2192';
  if (!studioOpen) { hint.textContent = ''; return; }

  const active = soloLens
    ? [layerOf[soloLens]].filter(Boolean)
    : [...new Set(forAnchor(anchor).filter(i => ids.has(i.id)).map(i => i.layer))].map(id => layerOf[id]);

  const result = compile({
    anchor,
    lenses: active,
    oppositions: soloLens ? [] : oppositionsAt(C.interps, anchor),
  });

  hint.textContent = soloLens ? 'one lens \u00b7 ' + (layerOf[soloLens].author.display) : active.length + ' lens(es)';

  const el = document.getElementById('payloads');
  if (result.decision !== 'compiled') {
    el.innerHTML = \`<div class="block"><strong>\${result.decision}</strong><br>\${result.note ?? result.reason ?? ''}</div>\`;
    return;
  }

  const esc = t => String(t).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  el.innerHTML =
    (soloLens ? \`<div class="note" style="margin:0 0 12px;border:0;padding:0">
        Compiling one lens. <button class="link" id="allLenses">Use the whole active stack instead</button></div>\` : '') +
    (result.contending ? \`<div class="split"><strong>These readings are in recorded opposition, so they were not merged.</strong>
        One payload per reading, and the choice is yours \u2014 a blend represents none of them.<br><br>
        \${result.conflicts.map(c => esc(c.note)).join('<br>')}</div>\` : '') +
    (result.blocks.length ? \`<div class="block"><strong>\${esc(result.blocks[0].rule)}</strong> \u2014
        \${esc(result.blocks[0].note ?? '')} Its negatives are locked and cannot be removed.</div>\` : '') +
    result.payloads.map(p => \`<div class="pay">
      <h3>\${p.lenses.map(id => esc(layerOf[id].author.display)).join(' + ')}</h3>
      <div class="fld">positive</div><div class="mono">\${esc(p.positive)}</div>
      <div class="fld">negative</div><div class="mono neg">\${p.negative.map(n =>
        p.locked_negative.includes(n) ? '<span class="lock">\u{1F512} ' + esc(n) + '</span>' : esc(n)).join('\\n')}</div>
      \${p.dropped_from_positive.length ? \`<div class="fld">dropped \u2014 excluded by an active lens</div>
        <div class="mono dim">\${p.dropped_from_positive.map(esc).join('\\n')}</div>\` : ''}
      <div class="chips"><span class="chip">\${esc(p.camera)}</span><span class="chip">\${esc(p.lighting)}</span>
        <span class="chip">\${esc(p.aspect)}</span><span class="chip">\${esc(p.id)}</span></div>
      <div class="note" style="display:flex;gap:12px">
        <button class="link" data-copy="\${esc(p.id)}">Copy payload JSON</button>
        <span class="dim">carries its lens, so the output is attributed to a reading</span>
      </div></div>\`).join('');

  const solo = document.getElementById('allLenses');
  if (solo) solo.addEventListener('click', () => { soloLens = null; render(); });
  el.querySelectorAll('[data-copy]').forEach(b => b.addEventListener('click', () => {
    const p = result.payloads.find(x => x.id === b.dataset.copy);
    const text = JSON.stringify(p, null, 2);
    (navigator.clipboard?.writeText(text) ?? Promise.reject()).then(
      () => { b.textContent = 'Copied'; setTimeout(() => (b.textContent = 'Copy payload JSON'), 1200); },
      () => { b.textContent = 'Copy blocked \u2014 select the JSON below'; }
    );
  }));
}

function render() {
  const { on, floor, leading, others } = visible();
  const c = contestation(anchor);
  document.getElementById('cmeter').style.width = (c.index * 100).toFixed(0) + '%';
  document.getElementById('cnum').textContent = 'index ' + (c.index * 100).toFixed(0) + '%';
  document.getElementById('cvoices').textContent = \`\${c.voices} voice(s), \${c.stances} stance(s)\`;
  document.getElementById('sliderNote').innerHTML = !others
    ? 'Only one stance is recorded at this anchor — nothing to open onto.'
    : (openness === 0
      ? \`Showing the leading reading only (<strong>\${leading}</strong>). \${others} other stance(s) hidden.\`
      : \`Leading: <strong>\${leading}</strong>. Diversity floor active — at least one reading from outside it is always carried.\`);
  document.querySelectorAll('#anchors button').forEach(b =>
    b.setAttribute('aria-pressed', String(b.dataset.cr === anchor)));
  renderText(on); renderGlosses(on); renderStack(on); renderDirector(on); renderStudio(on);
}

document.getElementById('anchors').innerHTML = C.anchors.map(cr => {
  const w = C.works.find(w => w.cr_grammar.split(':')[0] === cr.split(':')[0]);
  return \`<button class="anchor" data-cr="\${cr}">\${(w?.title.en ?? '?')} \${cr.split(':').slice(1).join(':')}</button>\`;
}).join('');
document.querySelectorAll('#anchors button').forEach(b =>
  b.addEventListener('click', () => { anchor = b.dataset.cr; manual.clear(); soloLens = null; render(); }));
document.getElementById('slider').addEventListener('input', e => {
  openness = e.target.value / 100; manual.clear(); soloLens = null; render();
});
document.getElementById('studioToggle').addEventListener('click', () => {
  studioOpen = !studioOpen; if (!studioOpen) soloLens = null; render();
});
/* -------------------------------------------- selection becomes an anchor */

// A reader points at words; the data model wants a Canonical Reference and,
// below unit granularity, a character span measured in CODEPOINTS of the NFC
// text with the quote carried alongside. This is the translation between them.
//
// Offsets are codepoints, not UTF-16 units: the Hebrew of Genesis 1:1 is full
// of characters JavaScript counts as two, and an offset that disagrees with the
// stored text by one is an annotation that lands on the wrong letter forever.

let selection = null;

const segmenter = typeof Intl !== 'undefined' && Intl.Segmenter
  ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;

// Snap to grapheme-cluster boundaries so a consonant is never split from its
// combining marks. Required for Hebrew, Arabic and Devanagari; harmless here.
function snap(chars, start, end) {
  if (!segmenter) return [start, end];
  const bounds = new Set([0]);
  let at = 0;
  for (const { segment } of segmenter.segment(chars.join(''))) {
    at += cps(segment).length;
    bounds.add(at);
  }
  const down = i => { while (i > 0 && !bounds.has(i)) i--; return i; };
  const up = i => { while (i < chars.length && !bounds.has(i)) i++; return i; };
  return [down(start), up(end)];
}

// Codepoint offset of a (node, offset) DOM position within an element's text.
function offsetIn(root, node, nodeOffset) {
  let count = 0;
  const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walk.nextNode())) {
    if (n === node) return count + cps(n.textContent.slice(0, nodeOffset)).length;
    count += cps(n.textContent).length;
  }
  return count;
}

function describeSelection() {
  const sel = window.getSelection();
  const note = document.getElementById('selNote');
  const box = document.getElementById('selAnchor');

  if (!sel || sel.isCollapsed || !sel.rangeCount) return;
  const range = sel.getRangeAt(0);

  // Case 1: inside one rendered unit — a character span.
  const unitEl = range.startContainer.parentElement?.closest('[data-cr]');
  const endUnitEl = range.endContainer.parentElement?.closest('[data-cr]');
  if (!unitEl || !endUnitEl) return;

  if (unitEl === endUnitEl) {
    const cr = unitEl.dataset.cr;
    if (unitEl.classList.contains('verse')) ensureUnit(cr);
    const unit = unitsAt(cr).find(u => u.edition === unitEl.dataset.edition) ?? unitsAt(cr)[0];
    if (!unit) return;
    const chars = cps(unit.text);
    let start = offsetIn(unitEl, range.startContainer, range.startOffset);
    let end = offsetIn(unitEl, range.endContainer, range.endOffset);
    if (end <= start) return;
    [start, end] = snap(chars, start, end);
    selection = {
      cr,
      granularity: end - start === 1 ? 'letter' : (end - start < 30 ? 'phrase' : 'clause'),
      span: {
        origin: unit.edition,
        start, end,
        exact: chars.slice(start, end).join(''),
        prefix: chars.slice(Math.max(0, start - 32), start).join(''),
        suffix: chars.slice(end, end + 32).join(''),
        grapheme_aligned: true,
      },
    };
  } else {
    // Case 2: across units — a canonical range, no span. A span is defined
    // within one unit of one edition; a selection that crosses verses is a
    // range of references and the model says so rather than inventing offsets.
    selection = { cr: unitEl.dataset.cr, cr_end: endUnitEl.dataset.cr, granularity: 'unit' };
  }

  note.hidden = true;
  box.hidden = false;
  const esc = t => String(t).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  box.innerHTML = selection.span
    ? \`<b>\${esc(selection.cr)}</b> · \${selection.granularity} · codepoints \${selection.span.start}–\${selection.span.end}
       <span class="dim">in \${esc(edOf[selection.span.origin]?.title ?? selection.span.origin)}</span>
       <q>\${esc(selection.span.exact)}</q>\`
    : \`<b>\${esc(selection.cr)} → \${esc(selection.cr_end)}</b> · range of \${selection.granularity}s
       <span class="dim">— a span is only defined inside one unit, so this anchors to the references</span>\`;
}

document.addEventListener('selectionchange', () => {
  // Only react to selections inside the text and the verse list.
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed) return;
  const within = sel.anchorNode?.parentElement?.closest('#text, #bkVerses');
  if (within) describeSelection();
});

/* ---------------------------------------------------- compose a rendition */

const composeOut = () => document.getElementById('composeOut');

async function composeFrom(medium, provider) {
  const out = composeOut();
  const at = selection ?? { cr: anchor };
  const active = soloLens
    ? [layerOf[soloLens]].filter(Boolean)
    : [...new Set(forAnchor(at.cr).map(i => i.layer))].map(id => layerOf[id]);

  if (!active.some(l => l && l.direction)) {
    out.innerHTML = '<div class="fail">No active lens carries a direction at this anchor. ' +
      'A rendering is directed by a reading; without one there is nothing to compose.</div>';
    return;
  }

  out.innerHTML = '<div>composing…</div>';
  document.querySelectorAll('.act').forEach(b => b.disabled = true);

  try {
    const res = await fetch('api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        anchor: at, medium, provider, lenses: active,
        oppositions: soloLens ? [] : oppositionsAt(C.interps, at.cr),
      }),
    });
    const body = await res.json();
    renderRendition(body, res.status, medium);
  } catch (e) {
    out.innerHTML = '<div class="fail">The request did not reach the server.</div>';
  } finally {
    document.querySelectorAll('.act').forEach(b => b.disabled = false);
  }
}

function renderRendition(body, status, medium) {
  const out = composeOut();
  const esc = t => String(t).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

  if (status === 501) {
    out.innerHTML = \`<div class="fail">\${esc(body.detail)}</div>\`;
    return;
  }
  if (body.error === 'contending') {
    out.innerHTML = \`<div class="fail">\${esc(body.note)}</div>\`;
    return;
  }
  if (body.error) {
    out.innerHTML = \`<div class="fail">\${esc(body.note ?? body.detail ?? body.error)}</div>\`;
    return;
  }

  const prov = body.provenance ?? {};
  const mark = \`<div class="machine-mark">machine-authored · \${esc(prov.model ?? '')} · directed by
      \${(prov.lenses ?? []).map(l => esc(layerOf[l]?.author.display ?? l)).join(', ')}
      \${prov.locked_negative?.length ? ' · ' + prov.locked_negative.length + ' locked exclusion(s)' : ''}</div>\`;

  if (medium === 'image' && body.data) {
    out.innerHTML = \`<img alt="rendering of \${esc(prov.anchor?.cr ?? '')}" src="data:\${esc(body.mime)};base64,\${body.data}">\` + mark;
    return;
  }
  if (medium === 'video') {
    out.innerHTML = \`<div>the video is rendering…</div>\` + mark;
    if (body.interaction) pollRendition(body.interaction, mark);
    return;
  }
  out.innerHTML = '<div class="fail">Nothing came back.</div>';
}

async function pollRendition(id, mark, tries = 0) {
  if (tries > 60) { composeOut().innerHTML = '<div class="fail">The video is taking longer than expected.</div>'; return; }
  await new Promise(r => setTimeout(r, 5000));
  const res = await fetch('api/generate/' + encodeURIComponent(id));
  const body = await res.json().catch(() => ({}));
  if (body.video?.uri) {
    composeOut().innerHTML = \`<video controls playsinline src="\${body.video.uri}"></video>\` + mark;
    return;
  }
  if (body.error) { composeOut().innerHTML = '<div class="fail">' + (body.detail || body.error) + '</div>'; return; }
  pollRendition(id, mark, tries + 1);
}

document.querySelectorAll('.act').forEach(b =>
  b.addEventListener('click', () => composeFrom(b.dataset.medium, b.dataset.provider)));

/* ------------------------------------------------------- the Bible panel */

// Books arrive one at a time, on demand. The whole edition is four megabytes;
// no reader should wait for Leviticus to read John.
const books = new Map();
let openBook = null, openChapter = 1;

const anchorsWithLayers = new Set(C.interps.map(i => i.anchor.cr));

async function loadBook(usfm) {
  if (books.has(usfm)) return books.get(usfm);
  const note = document.getElementById('bkNote');
  note.textContent = 'loading…';
  try {
    // Relative on purpose: the page is served at / and at /reader.html, and
    // this resolves against either.
    const res = await fetch(\`corpus/bible/\${usfm}.json\`);
    if (!res.ok) throw new Error(res.status);
    const book = await res.json();
    books.set(usfm, book);
    note.textContent = \`\${book.book.units} verses · King James Version · unverified\`;
    return book;
  } catch {
    note.textContent = 'the full text is not available from here';
    return null;
  }
}

// Any verse of a loaded book, in TextUnit shape. Selection needs the stored
// text to measure offsets against, and it must be the SAME string the checksum
// covers — not what the DOM happens to render.
function ensureUnit(cr) {
  if (fetched.has(cr)) return fetched.get(cr);
  const [, ref] = cr.split(':');
  const [usfm, c, v] = ref.split('.');
  const book = books.get(usfm);
  const text = book?.chapters?.[Number(c) - 1]?.[Number(v) - 1];
  if (text === undefined) return null;
  const unit = {
    type: 'TextUnit', edition: book.edition, cr, label: \`\${c}:\${v}\`,
    text, provenance: book.provenance,
  };
  fetched.set(cr, unit);
  return unit;
}

function renderVerses() {
  const el = document.getElementById('bkVerses');
  const book = books.get(openBook);
  el.innerHTML = '';
  if (!book) return;
  const verses = book.chapters[openChapter - 1] ?? [];
  verses.forEach((text, i) => {
    const cr = \`bible:\${openBook}.\${openChapter}.\${i + 1}\`;
    const b = document.createElement('div');
    b.className = 'verse';
    b.setAttribute('role', 'button');
    b.setAttribute('tabindex', '0');
    b.dataset.cr = cr;
    b.dataset.edition = book.edition;
    b.setAttribute('aria-current', String(cr === anchor));
    const layered = anchorsWithLayers.has(cr);
    b.innerHTML = \`<b class="\${layered ? 'has' : ''}">\${openChapter}:\${i + 1}</b><span></span>\`;
    b.lastChild.textContent = text;
    const open = () => {
      // Selecting words inside a verse must not also jump the anchor; a drag
      // is a different intent from a tap.
      if (!window.getSelection()?.isCollapsed) return;
      ensureUnit(cr); anchor = cr; manual.clear(); soloLens = null;
      render(); renderVerses();
    };
    b.addEventListener('click', open);
    b.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
    });
    el.appendChild(b);
  });
}

async function showBook(usfm, chapter = 1) {
  openBook = usfm; openChapter = chapter;
  const book = await loadBook(usfm);
  const sel = document.getElementById('bkChapter');
  sel.innerHTML = book
    ? Array.from({ length: book.chapters.length }, (_, i) =>
        \`<option value="\${i + 1}"\${i + 1 === chapter ? ' selected' : ''}>chapter \${i + 1}</option>\`).join('')
    : '';
  renderVerses();
}

document.getElementById('bkBook').innerHTML =
  C.bible.books.map(b => \`<option value="\${b.usfm}">\${b.name}</option>\`).join('');
document.getElementById('bkBook').addEventListener('change', e => showBook(e.target.value));
document.getElementById('bkChapter').addEventListener('change', e => {
  openChapter = Number(e.target.value); renderVerses();
});

render();

// Open on the book the current anchor is in, so the panel starts somewhere
// meaningful rather than at Genesis 1 every time.
{
  const [work, ref] = anchor.split(':');
  const usfm = work === 'bible' ? ref.split('.')[0] : 'JHN';
  const chapter = work === 'bible' ? Number(ref.split('.')[1]) : 1;
  document.getElementById('bkBook').value = usfm;
  showBook(usfm, chapter);
}
${BADGE_SCRIPT}
</script>
`;

mkdirSync('web', { recursive: true });
writeFileSync('web/reader.html', html);

// The edition ships beside the page rather than inside it. Behind the same
// gate as everything else — the Worker answers before the asset server.
cpSync('data/editions/bible-kjv', 'web/corpus/bible', { recursive: true });
console.log(
  `build-reader: web/reader.html (${(html.length / 1024).toFixed(0)} KB, ${corpus.mode})` +
  ` + web/corpus/bible (${bibleIndex.books.length} books, ${bibleIndex.units} verses)` +
  (corpus.held.length ? `, ${corpus.held.length} item(s) excluded as held: ${corpus.held.join(', ')}` : '')
);
