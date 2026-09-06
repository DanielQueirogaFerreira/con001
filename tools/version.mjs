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

import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

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
    built: new Date().toISOString(),
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
