#!/usr/bin/env node
// Builds web/evolution.html — the Codebase Navigator's renderer.
//
// The camera and layout modules are inlined verbatim, the same way the reader inlines the
// prompt compiler: one implementation, unit-tested in Node under tools/nav/, executed in
// the browser. Nothing is fetched from a CDN — the CSP names no remote origin, and a 3D
// library would be 600 KB to draw a few hundred dots that need no materials or lighting.
//
// Implements CODEBASE-VIEWER-SPEC.md §6. The route is /evolution, which is an ADDRESS and
// does not churn when the tool's name improves.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { versionInfo } from './version.mjs';
import { BADGE_CSS, BADGE_SCRIPT, badgeHtml } from './badge.mjs';
import { AREAS_CSS, areasNav } from './areas.mjs';

const version = versionInfo('.');
const AREA = '501';   // this project's identifier for the area; printed in the HUD

const strip = (f) => readFileSync(f, 'utf8').replace(/^export /gm, '');
const CAMERA = strip('tools/nav/camera.mjs');
const EVO = strip('tools/nav/evolution.mjs');

const html = `<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Codebase Navigator</title>
<style>
  :root {
    --bg:#faf8f4; --panel:#fffefb; --ink:#1d1a16; --muted:#6b6459; --line:#e3ddd2; --accent:#7a5c3e;
    --stage:#0b0d12; --stage-ink:#c9d2de; --stage-line:#1d2430; --area:#e0a33c;
    --font-ui: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
    --font-read: ui-serif, Georgia, "Times New Roman", serif;
    color-scheme: light;
  }
  @media (prefers-color-scheme: dark) {
    :root { --bg:#16140f; --panel:#1e1b16; --ink:#ece6dc; --muted:#9b9285; --line:#332e26;
            --accent:#c9a173; color-scheme: dark; }
  }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--ink); font-family:var(--font-ui); line-height:1.5; }
  .wrap { max-width:1180px; margin:0 auto; padding:18px 16px 40px; }
  h1 { font-family:var(--font-read); font-size:20px; font-weight:600; margin:0 0 3px; }
  .sub { color:var(--muted); font-size:12.5px; margin:0 0 14px; }
  a { color:var(--accent); }

  /* The stage stays dark even when the page is light. These colour separations were
     measured against a near-black background; a white stage needs every one re-picked
     rather than re-tinted, which is why every 3D tool with a light interface keeps a dark
     viewport. */
  .stage { background:var(--stage); border:1px solid var(--stage-line); border-radius:12px;
           overflow:hidden; display:flex; flex-direction:column; }
  /* The stage's proportions are part of the layout, not decoration. frameSphere fits the
     bounding sphere, so the binding constraint is the NARROWER field of view: on a stage
     2.3:1 the graph fills the height and leaves half the width empty however hard the
     aspect knob pushes. 1.8:1 is close to the 780x520 these constants were measured at. */
  canvas { display:block; width:100%; height:min(66vh, 62vw); min-height:340px;
           touch-action:none; cursor:grab; }
  canvas:active { cursor:grabbing; }

  /* One column, in flow. The bottom of the stage was three absolutely positioned blocks in
     the original and a new full-width timeline landed on top of the clock, because nothing
     in the layout knew the clock was there. A flow column means a new row pushes the
     others up. (Trap 8.11.) */
  .bar { display:flex; flex-direction:column; gap:8px; padding:10px 12px 12px;
         border-top:1px solid var(--stage-line); color:var(--stage-ink); }
  .row { display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
  .row.when { gap:10px; font-size:11.5px; }
  .clock { font-family:ui-monospace,Menlo,monospace; font-size:11.5px; color:var(--stage-ink); white-space:nowrap; }
  .commit { color:#8b97a8; font-size:11.5px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1 1 120px; }

  .track { position:relative; height:30px; flex:1 1 100%; }
  .marks { position:absolute; inset:0; display:flex; align-items:flex-end; gap:1px; pointer-events:none; }
  .marks i { flex:1 1 auto; background:#2b394d; border-radius:1px 1px 0 0; }
  input[type=range] { position:absolute; inset:auto 0 0 0; width:100%; margin:0; accent-color:#4da3ff; }

  /* Controls span the stage and wrap, aligned right. Anchored right and growing rightward,
     the speed chips grew off-canvas and an animated max-width clipped them while leaving
     them in the tab order — invisible and still focusable. (Trap 8.12.) */
  .controls { justify-content:flex-end; }
  button { font:inherit; font-size:11.5px; padding:6px 11px; border-radius:6px; cursor:pointer;
           background:#141a24; color:var(--stage-ink); border:1px solid var(--stage-line); }
  button:hover { border-color:#3a4a60; color:#fff; }
  button[aria-pressed="true"] { border-color:#4da3ff; color:#fff; }
  button:focus-visible { outline:2px solid #4da3ff; outline-offset:1px; }

  /* The HUD lives INSIDE the scene so it survives fullscreen — the page's own badge is
     outside the shell and disappears exactly when someone asking "which build am I looking
     at" cannot see the answer. One line, at the left of the control row. */
  .hud { font-family:ui-monospace,Menlo,monospace; font-size:10.5px; color:#71809a;
         margin-right:auto; white-space:nowrap; }
  .hud b { color:var(--area); font-weight:600; }

  .panels { display:grid; grid-template-columns:minmax(0,1fr) 280px; gap:14px; margin-top:14px; }
  .card { background:var(--panel); border:1px solid var(--line); border-radius:10px; padding:14px 16px; }
  .card h2 { font-size:10.5px; letter-spacing:.09em; text-transform:uppercase; color:var(--muted);
             margin:0 0 10px; font-weight:600; }
  .legend { display:flex; flex-wrap:wrap; gap:9px 16px; font-size:12px; }
  .legend span { display:flex; align-items:center; gap:6px; }
  .dot { width:10px; height:10px; border-radius:50%; flex:0 0 auto; }
  .ring { width:11px; height:11px; border-radius:50%; border:2px solid; flex:0 0 auto; }
  .dim { color:var(--muted); font-size:12px; }
  .mono { font-family:ui-monospace,Menlo,monospace; }
  .figs { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
  .fig b { display:block; font-size:19px; font-variant-numeric:tabular-nums; }
  .fig span { font-size:10.5px; letter-spacing:.05em; text-transform:uppercase; color:var(--muted); }
  .sel { font-size:12.5px; }
  .sel .path { font-family:ui-monospace,Menlo,monospace; font-size:11.5px; word-break:break-all; }

  ${BADGE_CSS}
  ${AREAS_CSS}
  /* The page badge sits clear of the legend card's bottom edge on a phone, where the two
     would otherwise overlap. */
  @media (max-width: 560px) { .wrap { padding-bottom:62px; } }
  @media (max-width: 760px) { .panels { grid-template-columns:minmax(0,1fr); } }
  @media (max-width: 560px) {
    .wrap { padding:12px 10px 32px; }
    canvas { height:46vh; }
    .controls { justify-content:flex-start; }
    .hud { margin-right:0; flex:1 1 100%; }
    button { padding:8px 12px; font-size:12px; }
  }
</style>

<div class="wrap">
  <h1>Codebase Navigator</h1>
  <p class="sub">This repository's structure and history as a scene you fly through.
    Drag to turn · two fingers or shift-drag to pan · wheel to zoom · tap a node to read it.
    </p>

  ${areasNav('/evolution')}

  <div class="stage">
    <canvas id="scene"></canvas>
    <div class="bar">
      <div class="row when">
        <span class="clock" id="clock">—</span>
        <span class="commit" id="commit"></span>
      </div>
      <div class="track">
        <div class="marks" id="marks"></div>
        <input type="range" id="scrub" min="0" max="1000" value="0" aria-label="Playhead">
      </div>
      <div class="row controls">
        <span class="hud" id="hud"></span>
        <button id="play" aria-pressed="true">Pause</button>
        <button data-rate="0.5">0.5×</button>
        <button data-rate="1" aria-pressed="true">1×</button>
        <button data-rate="3">3×</button>
        <button id="live" aria-pressed="true">Live</button>
        <button data-view="front">Front</button>
        <button data-view="side">Side</button>
        <button data-view="top">Top</button>
        <button id="reset">Reset</button>
      </div>
    </div>
  </div>

  <div class="panels">
    <div class="card">
      <h2>Legend</h2>
      <div class="legend" id="legend"></div>
      <p class="dim" style="margin:12px 0 0">The dot says what kind of file it is; the ring says what
        happened to it. Two encodings, kept orthogonal — and both drawn from the same table the
        painter reads, so the legend cannot drift from the graph.</p>
    </div>
    <div class="card">
      <h2>Window</h2>
      <div class="figs" id="figs"></div>
    </div>
  </div>

  <div class="card" style="margin-top:14px">
    <h2>Selection</h2>
    <div class="sel" id="sel"><span class="dim">Nothing picked. Tap any node in the scene.</span></div>
  </div>
</div>

${badgeHtml({ short: version.short, built: version.stamped, commit: version.built, area: 'navigator · 501' })}

<script>
${BADGE_SCRIPT}
${CAMERA}
${EVO}

const AREA = ${JSON.stringify(AREA)};
const BUILD = ${JSON.stringify(version.short)};

const canvas = document.getElementById('scene');
const ctx = canvas.getContext('2d');
const $ = (id) => document.getElementById(id);

let log = null, nodes = [], layout = null, sphere = { x:0, y:0, z:0, r:1 };
let cam = { ...DEFAULT_CAMERA };
let framed = false, playing = true, rate = 1, live = true;
let selected = null;

// The playhead is the most performance-sensitive value here, so it is a plain variable the
// paint loop reads — not something that triggers a re-render sixty times a second. The
// readable parts are mirrored out on an interval instead.
let clockMs = 0, startMs = 0, endMs = 0;
let lastFrame = performance.now();
let wanderPhase = 0;
const hits = [];

/* ------------------------------------------------------------------ load */

fetch('evolution.json').then(r => r.ok ? r.json() : Promise.reject(r.status)).then(start).catch(() => {
  $('sel').innerHTML = '<span class="dim">The history log could not be loaded.</span>';
});

function start(l) {
  log = l;
  nodes = buildTree(log.paths);
  layout = seedLayout(nodes);
  startMs = (log.since ?? 0) * 1000;
  endMs = (log.until ?? 0) * 1000;
  clockMs = startMs;

  const lg = legend();
  $('legend').innerHTML =
    lg.kinds.map(k => \`<span><i class="dot" style="background:\${k.colour}"></i>\${k.label}
       <span class="dim">\${k.hint}</span></span>\`).join('') +
    lg.actions.map(a => \`<span><i class="ring" style="border-color:\${a.colour}"></i>\${a.label}</span>\`).join('');

  const t = log.totals;
  $('figs').innerHTML = [
    [t.commits, 'commits'], [t.files_at_head, 'files'], [t.edits, 'edits'], [t.authors, 'contributors'],
  ].map(([n, label]) => \`<div class="fig"><b>\${n.toLocaleString()}</b><span>\${label}</span></div>\`).join('');

  const marks = timelineMarks(log, startMs, endMs, 120);
  const busiest = Math.max(1, ...marks.map(m => m.commits));
  $('marks').innerHTML = marks.map(m =>
    // Floored at 15%: a one-file commit beside a busy day must still be visible.
    \`<i style="height:\${Math.max(15, (m.commits / busiest) * 100)}%" title="\${m.commits} commit(s)"></i>\`).join('');

  $('hud').innerHTML = \`<b>\${AREA}</b> · \${BUILD}\${log.head ? ' · ' + log.head.sha : ''}\`;
  $('hud').title = \`area \${AREA} · build \${BUILD}\` + (log.head ? \` · head \${log.head.sha}: \${log.head.subject}\` : '');

  requestAnimationFrame(frame);
  setInterval(readout, 125);   // eight times a second, far faster than anyone reads a clock
}

/* ------------------------------------------------------------ the loop */

function frame(now) {
  // Clamped: a backgrounded tab delivers one enormous delta on return, which would jump
  // the playhead across days in a single step.
  const dt = Math.min(100, now - lastFrame);
  lastFrame = now;

  if (playing && endMs > startMs) {
    clockMs += (dt / SWEEP_MS) * (endMs - startMs) * rate;
    if (clockMs > endMs) clockMs = startMs;
  }

  wanderPhase += dt * 0.0016;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  step(layout, {
    aspect: Math.max(1, Math.min(1.6, w / Math.max(1, h))),
    wander: live ? 7 : 0,
    wanderPhase,
  });
  sphere = boundingSphere(layout);

  if (!framed) {
    cam = frameSphere(cam, sphere, sphere.r, w, h);
    framed = hasSettled(layout);          // stop refitting once the graph stops growing
  } else {
    cam = clampTarget(cam, sphere, sphere.r);
  }

  paint(w, h);
  requestAnimationFrame(frame);
}

/* --------------------------------------------------------------- paint */

function paint(w, h) {
  const dpr = Math.min(2, devicePixelRatio || 1);   // beyond 2 it is pixels nobody sees
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const heat = heatAt(log, clockMs);
  const liveSet = livePaths(log, clockMs);
  const n = nodes.length;

  // 1. Project once, into flat arrays; track near and far over VISIBLE nodes only.
  const px = new Float64Array(n), py = new Float64Array(n), pd = new Float64Array(n), ps = new Float64Array(n);
  const vis = new Uint8Array(n);
  let near = Infinity, far = -Infinity;
  for (let i = 0; i < n; i++) {
    const p = project({ x: layout.x[i], y: layout.y[i], z: layout.z[i] }, cam, w, h);
    px[i] = p.x; py[i] = p.y; pd[i] = p.depth; ps[i] = p.scale; vis[i] = p.visible ? 1 : 0;
    if (p.visible) { if (p.depth < near) near = p.depth; if (p.depth > far) far = p.depth; }
  }
  const range = Math.max(1, far - near);
  const haze = (i) => 1 - 0.62 * Math.min(1, (pd[i] - near) / range);

  // 2. Edges first, unsorted: hairlines behind everything, and sorting a longer list into
  //    the painter's order changes nothing visible.
  ctx.lineWidth = 1;
  for (let i = 1; i < n; i++) {
    const p = nodes[i].parent;
    if (!vis[i] || !vis[p]) continue;
    ctx.strokeStyle = \`rgba(64, 78, 94, \${(0.25 + 0.5 * haze(i)).toFixed(3)})\`;
    ctx.beginPath(); ctx.moveTo(px[p], py[p]); ctx.lineTo(px[i], py[i]); ctx.stroke();
  }

  // 3. Nodes, sorted far to near, so nearer ones genuinely occlude.
  const order = [];
  for (let i = 0; i < n; i++) if (vis[i]) order.push(i);
  order.sort((a, b) => pd[b] - pd[a]);

  hits.length = 0;
  const labels = [];
  for (const i of order) {
    const node = nodes[i];
    const warm = node.file && heat.has(node.pathIndex) ? heat.get(node.pathIndex) : null;
    const warmth = warm ? warm.heat : 0;
    const exists = node.file ? liveSet.has(node.pathIndex) : true;

    // A month of deleted temporary files would clutter the scene permanently.
    if (node.file && !exists && !warmth) continue;

    const worldR = node.file ? 4.2 + warmth * 9 : 5.4;
    const r = Math.min(44, Math.max(1.1, worldR * ps[i]));
    const a = (exists ? 1 : 0.4) * (0.35 + 0.65 * haze(i));

    ctx.globalAlpha = a;
    ctx.fillStyle = node.file ? kindOf(log.paths[node.pathIndex]).colour : '#7f8da3';
    ctx.beginPath(); ctx.arc(px[i], py[i], r, 0, Math.PI * 2); ctx.fill();

    if (warmth > 0) {
      // The only place an action colour appears. It starts tight and expands as the heat
      // decays, which reads as a pulse outward.
      ctx.globalAlpha = warmth * 0.75 * haze(i);
      ctx.strokeStyle = ACTION_COLOUR[warm.action] ?? '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(px[i], py[i], r + (1 - warmth) * 26 * ps[i] * 1.4, 0, Math.PI * 2);
      ctx.stroke();
    }

    hits.push({ x: px[i], y: py[i], r, depth: pd[i], index: i });
    if (warmth > 0.45) labels.push({ i, text: node.name, alpha: (warmth - 0.45) / 0.55 });
    else if (!node.file && node.depth <= 2 && node.depth > 0) labels.push({ i, text: node.name, alpha: 0.5 * haze(i) });
    if (selected === i) labels.push({ i, text: node.id || '/', alpha: 1 });
  }

  // 4. The orbit crosshair, so the centre of rotation is never a mystery.
  ctx.globalAlpha = 0.5; ctx.strokeStyle = '#3a4a60'; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(w / 2 - 6, h / 2); ctx.lineTo(w / 2 + 6, h / 2);
  ctx.moveTo(w / 2, h / 2 - 6); ctx.lineTo(w / 2, h / 2 + 6);
  ctx.stroke();

  // 5. Text last, so a node drawn afterwards can never land on top of a label.
  ctx.font = '11px ui-monospace, Menlo, monospace';
  ctx.textAlign = 'center';
  for (const l of labels) {
    ctx.globalAlpha = Math.max(0, Math.min(1, l.alpha));
    ctx.fillStyle = '#dbe3ee';
    ctx.fillText(l.text, px[l.i], py[l.i] - 9);
  }
  ctx.globalAlpha = 1;
}

/* ------------------------------------------------------------- readouts */

function readout() {
  const at = new Date(clockMs);
  $('clock').textContent = isFinite(clockMs) && clockMs
    ? at.toISOString().slice(0, 16).replace('T', ' ') + ' UTC' : '—';
  const ci = commitIndexAt(log, clockMs);
  const e = ci >= 0 ? log.events[ci] : null;
  $('commit').textContent = e ? \`\${e.s} · \${e.m} · \${log.authors[e.a]}\` : '';
  const span = Math.max(1, endMs - startMs);
  $('scrub').value = String(Math.round(((clockMs - startMs) / span) * 1000));
}

function describe(i) {
  selected = i;
  const node = nodes[i];
  const el = $('sel');
  if (!node.file) {
    let files = 0;
    for (const m of nodes) if (m.file && (m.id === node.id || m.id.startsWith(node.id + '/'))) files++;
    el.innerHTML = \`<div class="path">\${node.id || '/'}</div>
      <div class="dim">directory · \${files} file(s) tracked below it</div>\`;
    return;
  }
  const p = node.pathIndex;
  const touches = log.events.filter(e => e.f.some(([q]) => q === p));
  const last = touches[touches.length - 1];
  el.innerHTML = \`<div class="path">\${log.paths[p]}</div>
    <div class="dim">\${kindOf(log.paths[p]).label} · \${touches.length} commit(s) in the window ·
      \${log.alive[p] ? 'present at HEAD' : 'not at HEAD'}</div>\` +
    (last ? \`<div style="margin-top:8px">last touched <span class="mono">\${last.s}</span> —
      \${last.m}<br><span class="dim">\${log.authors[last.a]} ·
      \${new Date(last.t * 1000).toISOString().slice(0, 10)}</span></div>\` : '');
}

/* -------------------------------------------------------------- controls */

// EVERY camera action sets framed, or the refit loop and the user fight each other and the
// user loses with no sign of it — measured in the original: six wheel notches made the
// graph SMALLER. Reset clears it deliberately. (Trap 8.3.)
const touched = () => { framed = true; };

let drag = null;
canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId);
  drag = { x: e.clientX, y: e.clientY, pan: e.shiftKey || e.button === 2, moved: 0 };
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  drag.x = e.clientX; drag.y = e.clientY; drag.moved += Math.abs(dx) + Math.abs(dy);
  cam = drag.pan ? pan(cam, dx, dy, canvas.clientHeight) : orbit(cam, dx, dy);
  touched();
});
canvas.addEventListener('pointerup', (e) => {
  if (drag && drag.moved < 6) pick(e);
  drag = null;
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  cam = zoom(cam, e.deltaY > 0 ? 1 : -1);
  touched();
}, { passive: false });

function pick(e) {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left, y = e.clientY - rect.top;
  let best = null;
  for (const h of hits) {
    // A generous target on purpose: a 2px dot is impossible to hit exactly, and a graph
    // that ignores clicks reads as broken rather than as precise.
    if (Math.hypot(h.x - x, h.y - y) > Math.max(10, h.r + 6)) continue;
    if (!best || h.depth < best.depth) best = h;
  }
  if (best) describe(best.index);
}

$('play').addEventListener('click', (e) => {
  playing = !playing;
  e.target.textContent = playing ? 'Pause' : 'Play';
  e.target.setAttribute('aria-pressed', String(playing));
});
for (const b of document.querySelectorAll('[data-rate]'))
  b.addEventListener('click', () => {
    rate = Number(b.dataset.rate);
    for (const o of document.querySelectorAll('[data-rate]'))
      o.setAttribute('aria-pressed', String(o === b));
  });
$('live').addEventListener('click', (e) => {
  live = !live;
  e.target.setAttribute('aria-pressed', String(live));
  e.target.textContent = live ? 'Live' : 'Fixed';
});
for (const b of document.querySelectorAll('[data-view]'))
  b.addEventListener('click', () => {
    // Re-orient without moving the orbit centre, so a named view does not also throw away
    // whatever was centred.
    cam = { ...cam, orientation: VIEWS[b.dataset.view] };
    touched();
  });
$('reset').addEventListener('click', () => { cam = { ...DEFAULT_CAMERA }; framed = false; });
$('scrub').addEventListener('input', (e) => {
  clockMs = startMs + (Number(e.target.value) / 1000) * Math.max(1, endMs - startMs);
  readout();
});
</script>
`;

mkdirSync('web', { recursive: true });
writeFileSync('web/evolution.html', html);
console.log(`build-navigator: web/evolution.html (${(html.length / 1024).toFixed(0)} KB, area ${AREA})`);
