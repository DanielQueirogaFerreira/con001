#!/usr/bin/env node
// Builds web/console.html — one page holding both finished views.
//
// The status page and the reader are complete documents that each define .card,
// .bar, .note and .dim with different meanings, so merging their markup would
// silently cross the two stylesheets. Instead each is carried verbatim inside a
// <script type="text/plain"> block and handed to an iframe's srcdoc at runtime:
// two documents, two stylesheets, one URL, nothing to run.
//
//   node tools/build-console.mjs   (after reader + status have been built)

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { BADGE_CSS, BADGE_SCRIPT, badgeHtml } from './badge.mjs';
import { versionInfo } from './version.mjs';

for (const f of ['web/reader.html', 'web/status.html'])
  if (!existsSync(f)) {
    console.error(`missing ${f} — run npm run reader && npm run status first`);
    process.exit(1);
  }

// Only the closing tag can end a script element; escaping it is the whole trick.
// The <base> matters as much: a srcdoc document's base URL is about:srcdoc, so
// the reader's relative fetch of a book of the Bible would resolve to nothing.
const carry = (f) =>
  '<base href="/">\n' +
  // Each framed page carries its own build badge. Inside the console the shell's badge
  // already answers for both, and a srcdoc frame has an opaque origin — so the framed
  // badges could not share the collapsed state even if three of them were wanted.
  '<style>.oh-badge{display:none!important}</style>\n' +
  readFileSync(f, 'utf8').replaceAll('</script', '<\\/script');

const version = versionInfo('.');
const commit = version.sha;
const dated = version.built.slice(0, 10);

// Charset is declared by the page, not left to the server's Content-Type. These
// pages are served raw by the asset server and framed inside srcdoc documents
// that carry no header at all; a page whose encoding depends on how it was
// delivered renders "Gītā" as "GÄ«tÄ" wherever the header goes missing.
const html = `<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Open Hermeneutics Console</title>
<style>
  :root {
    --bg:#faf8f4; --panel:#fffefb; --ink:#1d1a16; --muted:#6b6459;
    --line:#e3ddd2; --accent:#7a5c3e;
    --font-read: ui-serif, Georgia, "Times New Roman", serif;
    --font-ui: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  }
  :root:not([data-theme="light"]) { color-scheme: light; }
  @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
    --bg:#16140f; --panel:#1e1b16; --ink:#ece6dc; --muted:#9b9285;
    --line:#332e26; --accent:#c9a173; color-scheme: dark; } }
  :root[data-theme="dark"] {
    --bg:#16140f; --panel:#1e1b16; --ink:#ece6dc; --muted:#9b9285;
    --line:#332e26; --accent:#c9a173; color-scheme: dark; }

  html, body { height:100%; }
  body { background:var(--bg); color:var(--ink); font-family:var(--font-ui);
         display:flex; flex-direction:column; }
  header { border-bottom:1px solid var(--line); background:var(--panel);
           padding:9px 16px; display:flex; gap:16px; align-items:baseline;
           flex-wrap:wrap; }
  h1 { font-family:var(--font-read); font-size:15px; font-weight:600; margin:0; }
  .build { font-family:ui-monospace,SFMono-Regular,Menlo,monospace;
           font-size:11px; color:var(--muted); }
  nav { display:flex; gap:4px; margin-left:auto; }
  button { font:inherit; font-size:12.5px; color:var(--muted); cursor:pointer;
           background:transparent; border:1px solid transparent;
           border-radius:6px; padding:4px 12px; }
  button:hover { color:var(--ink); }
  button[aria-selected="true"] { color:var(--ink); border-color:var(--line);
                                 background:var(--bg); }
  button:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
  main { flex:1; min-height:0; }
  iframe { width:100%; height:100%; border:0; display:block; background:var(--bg); }
  ${BADGE_CSS}
</style>

<header>
  <h1>Open Hermeneutics</h1>
  <span class="build">${commit} · ${dated}</span>
  <nav role="tablist">
    <button role="tab" id="t-progress" aria-selected="true">Progress</button>
    <button role="tab" id="t-reader" aria-selected="false">Reader</button>
  </nav>
</header>
<main>
  <iframe id="view" title="Progress"></iframe>
</main>

${badgeHtml({ short: version.short, built: version.built, area: 'console' })}

<script type="text/plain" id="src-progress">${carry('web/status.html')}</script>
<script type="text/plain" id="src-reader">${carry('web/reader.html')}</script>
<script>
  const view = document.getElementById('view');
  const tabs = { progress: document.getElementById('t-progress'),
                 reader: document.getElementById('t-reader') };
  const show = (name) => {
    for (const [k, b] of Object.entries(tabs))
      b.setAttribute('aria-selected', String(k === name));
    view.title = tabs[name].textContent;
    view.srcdoc = document.getElementById('src-' + name).textContent;
    try { localStorage.setItem('oh-console-tab', name); } catch {}
  };
  for (const [k, b] of Object.entries(tabs)) b.addEventListener('click', () => show(k));
  let start = 'progress';
  try { const s = localStorage.getItem('oh-console-tab'); if (s in tabs) start = s; } catch {}
  show(start);
${BADGE_SCRIPT}
</script>
`;

writeFileSync('web/console.html', html);
console.log(`web/console.html  ${(html.length / 1024).toFixed(1)}KB  (${commit})`);
