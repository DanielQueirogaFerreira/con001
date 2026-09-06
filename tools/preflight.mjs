#!/usr/bin/env node
// Deploy preflight: everything that must be true before the Worker ships.
//
// This exists because a deploy misconfiguration does not fail loudly — it
// succeeds and serves the site with the gate disabled. `run_worker_first` is
// the sharp example: drop that one line and the asset server answers before the
// Worker, every page becomes public, and nothing anywhere reports an error.
//
//   node tools/preflight.mjs

import { readFileSync, existsSync } from 'node:fs';

const problems = [];
const checks = [];
const check = (label, ok, detail = '') => {
  checks.push({ label, ok, detail });
  if (!ok) problems.push(`${label}${detail ? ' — ' + detail : ''}`);
};

const cfg = existsSync('wrangler.toml') ? readFileSync('wrangler.toml', 'utf8') : '';
check('wrangler.toml at the repository root', cfg.length > 0,
  'Workers Builds looks for the config here by default');

// Crude but sufficient: the file is ours, and a TOML parser is a dependency.
const field = (k) => (cfg.match(new RegExp(`^\\s*${k}\\s*=\\s*"?([^"\\n#]+)"?`, 'm')) ?? [])[1]?.trim();

const main = field('main');
check('main entry point is declared', !!main);
check('main entry point exists', !!main && existsSync(main), main ?? '');

check('a Worker name is set', !!field('name'), field('name') ?? '');
// Workers Builds ignores wrangler's [build] section, so the check that matters
// is that a script exists which builds before deploying — and that whatever the
// dashboard is set to points at one of them.
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
for (const s of ['deploy', 'deploy:preview'])
  check(`npm run ${s} builds before shipping`,
    /reader/.test(pkg.scripts?.[s] ?? '') && /status/.test(pkg.scripts?.[s] ?? ''),
    'web/ is generated and untracked; a deploy that skips the build has no assets');

// THE check. Without it the gate is decorative.
check('assets run the Worker first', /run_worker_first\s*=\s*true/.test(cfg),
  'without this the asset server answers before the login gate and the whole site is public');

const assetsDir = (cfg.match(/\[assets\][\s\S]*?directory\s*=\s*"([^"]+)"/) ?? [])[1];
check('assets directory is declared', !!assetsDir);
check('assets directory has been built', !!assetsDir && existsSync(assetsDir),
  `${assetsDir ?? 'web'} is generated — run npm run reader && npm run status`);
for (const page of ['reader.html', 'status.html'])
  check(`${page} is built`, !!assetsDir && existsSync(`${assetsDir}/${page}`));

check('a D1 binding is configured', /\[\[d1_databases\]\]/.test(cfg));
check('the database id is real', !/REPLACE_WITH_ID|placeholder/i.test(cfg),
  'wrangler.toml still holds a placeholder');
check('the D1 binding is named DB', /binding\s*=\s*"DB"/.test(cfg),
  'worker/index.mjs reads env.DB');

// The Worker must not have picked up an import the Workers runtime lacks.
const src = existsSync(main ?? '') ? readFileSync(main, 'utf8') : '';
check('the Worker imports nothing but its own modules',
  [...src.matchAll(/^import .* from ['"]([^'"]+)['"]/gm)].every((m) => m[1].startsWith('.')),
  'node: and npm imports do not exist in the Workers runtime');

const pad = Math.max(...checks.map((c) => c.label.length));
console.log('\nDEPLOY PREFLIGHT\n');
for (const c of checks)
  console.log(`  ${c.ok ? 'ok  ' : 'FAIL'}  ${c.label.padEnd(pad)}${c.detail && !c.ok ? '  — ' + c.detail : ''}`);

if (problems.length) {
  console.error(`\n  ${problems.length} problem(s). Not safe to deploy.\n`);
  process.exit(1);
}
console.log(`\n  ${checks.length} checks passed. Safe to deploy.\n`);
