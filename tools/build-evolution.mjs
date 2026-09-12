#!/usr/bin/env node
// The producer: git history → web/evolution.json, and the tracked tree → web/source/.
//
// Implements CODEBASE-VIEWER-SPEC.md §4 and §5. It knows nothing about rendering, and the
// renderer knows nothing about git; the contract in §3 is the only thing between them.
//
//   node tools/build-evolution.mjs [--days 30] [--no-bundle]
//
// SECURITY GATE (§4.6). The bundle publishes this repository's source at the application's
// origin. This repository is PRIVATE, so that is only acceptable because every path here is
// served behind the session gate — the Worker runs before the asset server (run_worker_first
// in wrangler.toml, asserted by tools/preflight.mjs and re-checked against the live site by
// tools/verify-live.mjs). If that ever stops being true, this step must stop shipping.

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, copyFileSync, readFileSync, existsSync, statSync, rmSync } from 'node:fs';
import { dirname } from 'node:path';

const arg = (name, fallback) => {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};

const DAYS = Number(arg('days', 30));
const BUNDLE = !process.argv.includes('--no-bundle');
const LOG_PATH = 'web/evolution.json';
const SOURCE_ROOT = 'web/source';
const MAX_FILE_BYTES = 512 * 1024;

const git = (args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

// A lockfile changes on every dependency bump and is thousands of lines nobody reads. The
// generated log would appear as a file that changes on every deploy — untrue of the source,
// and the loudest node on the graph.
const IGNORED = [
  /^pnpm-lock\.yaml$/, /^package-lock\.json$/,
  /(^|\/)dist\//, /(^|\/)node_modules\//, /(^|\/)web\//,
  /^\.dev\.vars$/, /(^|\/)\.env(\.|$)/,
];
const ignored = (p) => IGNORED.some((re) => re.test(p));

// Skipped from the BUNDLE only, never from the log. These bytes already ship at
// /corpus/bible, so copying them again would double the deploy for nothing; but the commit
// that ingested them touched 66 real files and the graph should show that it happened.
const BUNDLE_SKIP = [/^data\/editions\/bible-kjv\//];
const bundleSkipped = (p) => BUNDLE_SKIP.some((re) => re.test(p));

// The security gate in §4.6 says to scan the bundle for credentials before the first
// deploy. "Verify, do not assume" — so it runs on every build rather than once.
const SECRET_SHAPES = [
  [/AIza[0-9A-Za-z_-]{35}/, 'a Google API key'],
  [/sk-[A-Za-z0-9]{32,}/, 'an OpenAI-style key'],
  [/ghp_[A-Za-z0-9]{36}/, 'a GitHub token'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'a private key'],
  [/xox[abprs]-[A-Za-z0-9-]{10,}/, 'a Slack token'],
];

/* ------------------------------------------------------------- reading git */

// %x00 field separators, not a printable character: commit subjects are written by people,
// and one containing a pipe or a tab splits a record into the wrong number of fields — a
// parser correct for every message so far and silently wrong for the next one.
const raw = git([
  'log', `--since=${DAYS} days ago`, '--no-merges', '--reverse',
  '--name-status', '--no-renames', '--format=%x01%H%x00%at%x00%an%x00%s',
]);

const authors = [];          // display names, interned in first-seen order
const authorKeyToIndex = new Map();
const paths = [];
const pathToIndex = new Map();
const events = [];

// One person, one node. The same human commits from two machines under two identities, and
// showing them as two contributors is wrong in the one place this view makes a factual
// claim. Keyed on the name with spacing and punctuation removed — NEVER on the email
// address, because this file is served and a contributor list is not a reason to publish
// anyone's address.
const authorKey = (name) => name.toLowerCase().replace(/[^a-z0-9]/g, '');

function internAuthor(name) {
  const key = authorKey(name);
  if (authorKeyToIndex.has(key)) {
    const at = authorKeyToIndex.get(key);
    // Prefer the spaced form as the display name — it is the one a person would write down.
    if (name.includes(' ') && !authors[at].includes(' ')) authors[at] = name;
    return at;
  }
  authors.push(name);
  authorKeyToIndex.set(key, authors.length - 1);
  return authors.length - 1;
}

const internPath = (p) => {
  if (pathToIndex.has(p)) return pathToIndex.get(p);
  paths.push(p);
  pathToIndex.set(p, paths.length - 1);
  return paths.length - 1;
};

for (const record of raw.split('\x01').slice(1)) {
  const [header, ...rest] = record.split('\n');
  const [sha, at, name, subject] = header.split('\x00');
  const f = [];
  for (const line of rest) {
    if (!line.trim()) continue;
    const tab = line.indexOf('\t');
    if (tab < 0) continue;
    // Status letters can carry a score (R100, C075) — take the first character only.
    const action = line.slice(0, tab).trim()[0];
    const path = line.slice(tab + 1).trim();
    if (!'AMD'.includes(action)) continue;
    if (!path || ignored(path)) continue;
    f.push([internPath(path), action]);
  }
  // Drop commits whose file list is empty after filtering: keeping them shows a beat where
  // nothing happens and makes the timeline look emptier than the work was.
  if (!f.length) continue;
  events.push({
    t: Number(at), a: internAuthor(name), s: sha.slice(0, 7),
    m: (subject ?? '').slice(0, 120), f,
  });
}

events.sort((x, y) => x.t - y.t);   // the contract requires ascending; --reverse already does it

/* ---------------------------------------------------------------- `alive` */

// From the tree at HEAD, NOT by replaying adds and deletes: a file created before the window
// opened has no `A` event and would otherwise look like one that never existed.
const headFiles = git(['ls-tree', '-r', '--name-only', 'HEAD']).split('\n').filter(Boolean);
const headSet = new Set(headFiles.filter((p) => !ignored(p)));
const alive = paths.map((p) => (headSet.has(p) ? 1 : 0));

const head = events.length
  ? { sha: events[events.length - 1].s, at: events[events.length - 1].t, subject: events[events.length - 1].m }
  : null;

const log = {
  generated_at: new Date().toISOString(),
  window_days: DAYS,
  since: events.length ? events[0].t : null,
  until: events.length ? events[events.length - 1].t : null,
  head,
  authors, paths, alive, events,
  totals: {
    commits: events.length,
    files_touched: paths.length,
    files_at_head: headSet.size,
    authors: authors.length,
    edits: events.reduce((n, e) => n + e.f.length, 0),
  },
};

mkdirSync('web', { recursive: true });
writeFileSync(LOG_PATH, JSON.stringify(log));

/* ------------------------------------------------------------- the bundle */

let bundled = 0, skippedBig = 0, skippedMissing = 0, skippedElsewhere = 0;
const leaks = [];
if (BUNDLE) {
  rmSync(SOURCE_ROOT, { recursive: true, force: true });
  const manifest = {};
  for (const p of headSet) {
    if (bundleSkipped(p)) { skippedElsewhere++; continue; }
    if (!existsSync(p)) { skippedMissing++; continue; }   // submodules, partial checkouts
    const size = statSync(p).size;
    // Bigger than this is not something a navigator should try to paint.
    if (size > MAX_FILE_BYTES) { skippedBig++; continue; }
    const body = readFileSync(p, 'utf8');
    for (const [re, what] of SECRET_SHAPES) if (re.test(body)) leaks.push(`${p}: looks like ${what}`);

    const dest = `${SOURCE_ROOT}/${p}`;
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(p, dest);
    manifest[p] = size;
    bundled++;
  }
  writeFileSync(`${SOURCE_ROOT}/manifest.json`, JSON.stringify(manifest));

  // Refuse rather than warn. A bundle that ships a credential cannot be un-shipped.
  if (leaks.length) {
    rmSync(SOURCE_ROOT, { recursive: true, force: true });
    console.error('\n  The source bundle was NOT written — something in it looks like a credential:');
    for (const l of leaks) console.error(`    ${l}`);
    process.exit(1);
  }
}

const kb = (n) => (n / 1024).toFixed(0);
console.log(
  `build-evolution: ${LOG_PATH} (${kb(JSON.stringify(log).length)} KB) — ` +
  `${log.totals.commits} commits, ${log.totals.files_touched} paths touched, ` +
  `${log.totals.edits} edits, ${log.totals.authors} author(s), window ${DAYS}d`);
if (BUNDLE)
  console.log(
    `                 ${SOURCE_ROOT}/ — ${bundled} files bundled` +
    (skippedBig ? `, ${skippedBig} skipped over ${kb(MAX_FILE_BYTES)} KB` : '') +
    (skippedElsewhere ? `, ${skippedElsewhere} already served elsewhere` : '') +
    (skippedMissing ? `, ${skippedMissing} in the tree but not on disk` : '') +
    `, scanned for credentials`);
