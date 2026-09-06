#!/usr/bin/env node
// Production build. The doctrinal gate from docs/11-guardrails.md, enforced.
//
//   node tools/build-prod.mjs                  strict — held items FAIL the build
//   node tools/build-prod.mjs --hold-excluded  ship without them, and say so
//
// Staging rule: `npm test` and `npm run resonance` warn about high-tier items
// awaiting advisory sign-off. This build refuses to publish them. Development
// is never blocked; the production CDN is.

import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { map } from './resonance.mjs';
import { versionInfo } from './version.mjs';

const allowExcluded = process.argv.includes('--hold-excluded');
const step = (label, fn) => {
  process.stdout.write(`  ${label.padEnd(34)}`);
  try {
    const out = fn();
    console.log('ok');
    return out;
  } catch (e) {
    console.log('FAILED');
    throw e;
  }
};

console.log('\nPRODUCTION BUILD\n');

step('schema and integrity', () =>
  execFileSync(process.execPath, ['tools/validate.mjs'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));

const m = map('.');
const found = m.audit({ strict: true });
const errors = found.filter((f) => f.severity === 'error' && !f.staging);
const held = found.filter((f) => f.staging);

step('resonance structure', () => {
  if (errors.length) throw new Error(errors.map((e) => `${e.id}: ${e.message}`).join('\n'));
});

if (held.length) {
  console.log('\n  HELD BY THE ADVISORY GATE\n');
  console.log('  code               id                                  detail');
  console.log('  ' + '-'.repeat(100));
  for (const h of held) console.log(`  ${h.code.padEnd(18)} ${h.id.padEnd(35)} ${h.message}`);

  if (!allowExcluded) {
    console.error(
      '\n  BUILD REFUSED.\n\n' +
      `  ${held.length} high-consequence item(s) have not been cleared by the advisory groups\n` +
      '  of the traditions they speak about. They cannot go to the production CDN.\n\n' +
      '  This is the gate working, not a defect. Three ways forward:\n\n' +
      '    1. Seat the advisory groups and record real sign-off in `review.signed_off_by`\n' +
      '       (a placeholder containing "pending" does not count and is tested).\n' +
      '    2. Ship without the held items: `node tools/build-prod.mjs --hold-excluded`.\n' +
      '       They are excluded from the bundle and named in the manifest — never\n' +
      '       silently downgraded to a lower tier.\n' +
      '    3. Lower the question\'s `consequence_tier`, which is an editorial decision\n' +
      '       and should be argued for, not taken to unblock a build.\n'
    );
    process.exit(1);
  }
  console.log('\n  --hold-excluded: shipping without them. They are named in the manifest.\n');
}

const set = m.productionSet();
step('reader bundle', () =>
  execFileSync(process.execPath, ['tools/build-reader.mjs', '--prod'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));

mkdirSync('dist', { recursive: true });
// The manifest is the public transparency log AND the scholar recruitment
// agenda, so each held item names the RFC that would clear it, the seats it
// needs, and the document a prospective reviewer can open and read.
const rfcFor = (id) => m.advisory.rfcs.find((r) => (r.targets ?? []).includes(id));
const seatsWanted = new Set();
for (const h of held) for (const s2 of rfcFor(h.id)?.seats_required ?? []) seatsWanted.add(s2);

const manifest = {
  build: versionInfo('.').build,
  built: versionInfo('.').built,
  mode: 'production',
  published: { positions: set.positions.length, resonances: set.resonances.length },
  held: held.map((h) => {
    const r = rfcFor(h.id);
    return {
      id: h.id,
      code: h.code,
      reason: h.message,
      rfc: r?.id ?? null,
      rfc_status: r?.status ?? 'no RFC opened',
      seats_required: r?.seats_required ?? [],
      document: r?._file ?? null,
      title: r?.title ?? null,
    };
  }),
  recruiting: {
    seats: [...seatsWanted],
    note:
      seatsWanted.size
        ? `Advisory seats currently sought: ${[...seatsWanted].join(', ')}. Each named RFC ` +
          'states what that seat is being asked to decide. Withdrawing the claim entirely ' +
          'is one of the options every RFC puts to its reviewers.'
        : 'No seats outstanding.',
  },
  note:
    'Held items are excluded from this bundle, not downgraded. They remain in the ' +
    'repository at their true consequence tier and become publishable when the ' +
    'named advisory groups sign off. No sign-off has been invented to unblock a build.',
};
writeFileSync('dist/manifest.json', JSON.stringify(manifest, null, 2) + '\n');
step('manifest', () => manifest);

console.log(
  `\n  BUILD OK — ${set.resonances.length} resonance(s), ${set.positions.length} position(s) published` +
  (held.length ? `, ${held.length} held and excluded` : '') +
  '\n  dist/manifest.json, web/reader.html\n'
);
