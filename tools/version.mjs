#!/usr/bin/env node
// One source of truth for what build this is.
//
// Every artefact this project emits — the reader, the status page, the
// production manifest — is stamped with the same identifier, because the
// evaluation loop attaches team feedback to a SPECIFIC build. "The slider felt
// wrong" is not actionable; "the slider felt wrong in 0.1.0-alpha.1+d52ed9f"
// is. See docs/14-loop.md.
//
//   node tools/version.mjs          print
//   node tools/version.mjs --json   machine-readable

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

// One instant for a whole build run, to the millisecond.
//
// The commit date cannot supply this: git stores whole seconds, which is why the build
// stamp read `.000` forever. The moment with real milliseconds is the moment the build
// RAN, and that is a different fact from when the source was committed — so it is recorded
// as a different field rather than by pretending the commit date is more precise than it
// is.
//
// It lives in a file because a build run is four separate processes: the reader, the
// navigator, the status page and the console are built one after another, and four
// wall-clocks would name four different builds seconds apart. The first tool to ask writes
// the stamp and the rest read it. A stamp older than the reuse window belongs to a previous
// run, so the next build takes a fresh one — the window only has to outlast a single build,
// which takes seconds.
const STAMP_FILE = 'web/.build-stamp';
const STAMP_REUSE_MS = 5 * 60 * 1000;

export function buildStamp(root = '.') {
  const path = `${root}/${STAMP_FILE}`;
  try {
    const previous = readFileSync(path, 'utf8').trim();
    const at = Date.parse(previous);
    if (Number.isFinite(at) && Date.now() - at < STAMP_REUSE_MS && at <= Date.now()) return previous;
  } catch {
    // No stamp yet, or an unreadable one. Either way, take a fresh instant.
  }
  const now = new Date().toISOString();
  try {
    mkdirSync(`${root}/web`, { recursive: true });
    writeFileSync(path, now);
  } catch {
    // A read-only tree still gets a usable stamp; it just will not be shared.
  }
  return now;
}

const git = (args, fallback = '') => {
  try {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return fallback;
  }
};

export function versionInfo(root = '.') {
  const pkg = JSON.parse(readFileSync(`${root}/package.json`, 'utf8'));
  const sha = git(['rev-parse', '--short', 'HEAD'], 'nogit');
  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD'], 'unknown');
  const dirty = git(['status', '--porcelain'], '').length > 0;
  const committed = git(['log', '-1', '--format=%cI'], '');

  return {
    version: pkg.version,
    sha,
    branch,
    dirty,
    // A build id that changes whenever the code does. `+dirty` is deliberate:
    // an evaluation written against an uncommitted build cannot be reproduced,
    // and the id says so rather than pretending otherwise.
    build: `${pkg.version}+${sha}${dirty ? '.dirty' : ''}`,
    committed,
    // The commit date, NOT the wall clock. Builds must be reproducible: the
    // same commit has to produce byte-identical output, or every rebuild
    // dirties the tree and the `.dirty` flag becomes meaningless noise.
    built: committed || new Date().toISOString(),
    // When this build ran, to the millisecond. Kept separate from `built` on purpose:
    // `built` identifies the SOURCE and must not move between rebuilds of one commit;
    // this identifies the RUN and moves every time, which is what "when was this
    // registered" actually asks. Nothing tracked by git is stamped with it.
    stamped: buildStamp(root),
    // The same identity, short enough to sit in a corner of the screen without
    // becoming furniture: `0.1.0a1·f58cc27`, with a trailing * for a dirty
    // tree. Nothing is invented here — it is `build` with the words taken out,
    // so a person reading the badge and a person reading a log are looking at
    // the same build.
    short: `${pkg.version.replace(/-alpha\./, 'a').replace(/-beta\./, 'b').replace(/-rc\./, 'rc')}` +
           `\u00b7${sha}${dirty ? '*' : ''}`,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const v = versionInfo('.');
  if (process.argv.includes('--json')) console.log(JSON.stringify(v, null, 2));
  else {
    console.log(`\n  build    ${v.build}`);
    console.log(`  version  ${v.version}`);
    console.log(`  branch   ${v.branch}  (${v.sha}${v.dirty ? ', uncommitted changes' : ''})`);
    console.log(`  commit   ${v.committed || 'unknown'}\n`);
    if (v.dirty)
      console.log('  Working tree is dirty. Anything built now cannot be reproduced from git,\n' +
                  '  so evaluations written against it are not reliably actionable.\n');
  }
}
