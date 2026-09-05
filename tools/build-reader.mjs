#!/usr/bin/env node
// Builds web/reader.html — a self-contained Reader + Studio prototype with the
// corpus inlined, so it opens from the filesystem with no server and no
// dependencies. That is not a shortcut: it is the cost architecture from
// docs/08-open-source-and-cost.md made literal. The corpus is static and
// immutable, so the reading surface is a file.
//
//   node tools/build-reader.mjs            all data
//   node tools/build-reader.mjs --prod     production set only (held items excluded)

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { map } from './resonance.mjs';

const read = (p) => JSON.parse(readFileSync(p, 'utf8'));
const prod = process.argv.includes('--prod');

const works = read('data/works/works.json');
const editions = read('data/editions/editions.json');
const units = read('data/editions/text-units.json');
const layers = read('data/layers/layers.json');
const interps = read('data/interpretations/interpretations.json');
const questions = read('data/questions/questions.json');

const m = map('.');
const set = prod ? m.productionSet() : { positions: m.positions, resonances: m.resonances, held: [] };

// Only the anchors the prototype opens on, to keep the file small.
const ANCHORS = ['gita:2.47', 'dhammapada:1', 'upanishad:ISH.1', 'daodejing:1', 'quran:2:1'];

const corpus = {
  built: new Date().toISOString().slice(0, 10),
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
};

const html = `<title>Open Hermeneutics Reader</title>
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
  a { color: var(--accent); }
</style>

<div class="wrap">
  <h1>Open Hermeneutics — Reader &amp; Studio prototype</h1>
  <div class="sub">
    Seven works. Layered reading, the contestation slider, and the Director Lens Hook.
    Built <span id="built"></span> · <span id="mode"></span> ·
    <strong>no source text here is verified</strong> — every passage was hand-entered to demonstrate the format.
  </div>

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
      </div>
    </div>
  </div>
</div>

<script id="corpus" type="application/json">${JSON.stringify(corpus).replace(/</g, '\\u003c')}</script>
<script>
const C = JSON.parse(document.getElementById('corpus').textContent);
document.getElementById('built').textContent = C.built;
document.getElementById('mode').textContent = C.mode + (C.held.length ? \` · \${C.held.length} item(s) held for review\` : '');

const layerOf = Object.fromEntries(C.layers.map(l => [l.id, l]));
const edOf = Object.fromEntries(C.editions.map(e => [e.id, e]));
const cps = s => [...s];

let anchor = C.anchors[0];
let openness = 1;                 // the contestation slider, 0..1
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

function renderText(ids) {
  const us = C.units.filter(u => u.cr === anchor);
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
      <span><strong>\${l.title.en ?? l.id}</strong>
        \${l.kind === 'machine' ? '<span class="tag machine">machine</span>' : ''}
        <br><span class="dim">\${l.stance ?? l.kind} · canonical weight \${(l.canonical?.weight ?? 0).toFixed(2)}</span></span></label>\`;
  }).join('');
  el.querySelectorAll('input').forEach(b =>
    b.addEventListener('change', e => { manual.set(e.target.dataset.id, e.target.checked); render(); }));
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
  renderText(on); renderGlosses(on); renderStack(on); renderDirector(on);
}

document.getElementById('anchors').innerHTML = C.anchors.map(cr => {
  const w = C.works.find(w => w.cr_grammar.split(':')[0] === cr.split(':')[0]);
  return \`<button class="anchor" data-cr="\${cr}">\${(w?.title.en ?? '?')} \${cr.split(':').slice(1).join(':')}</button>\`;
}).join('');
document.querySelectorAll('#anchors button').forEach(b =>
  b.addEventListener('click', () => { anchor = b.dataset.cr; manual.clear(); render(); }));
document.getElementById('slider').addEventListener('input', e => {
  openness = e.target.value / 100; manual.clear(); render();
});
render();
</script>
`;

mkdirSync('web', { recursive: true });
writeFileSync('web/reader.html', html);
console.log(
  `build-reader: web/reader.html (${(html.length / 1024).toFixed(0)} KB, ${corpus.mode})` +
  (corpus.held.length ? `, ${corpus.held.length} item(s) excluded as held: ${corpus.held.join(', ')}` : '')
);
