#!/usr/bin/env node
// Negative tests for tools/validate.mjs.
//
// A validator nobody has seen fail is not a validator. Each case below copies
// the repo to a scratch directory, breaks exactly one invariant, and asserts
// that validation rejects it.
//
// Usage: node tools/test-validate.mjs

import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const cases = [
  {
    name: 'span offsets that no longer select the quoted text',
    file: 'data/interpretations/interpretations.json',
    mutate: (d) => {
      d.find((i) => i.id === 'interp:analects.1-1.zhuxi.xi').anchor.span.start += 1;
      return d;
    },
    expect: /offsets .* select/,
  },
  {
    name: 'a letter span that splits a Hebrew consonant from its combining marks',
    file: 'data/interpretations/interpretations.json',
    mutate: (d) => {
      const s = d.find((i) => i.id === 'interp:bible.gen1-1.bereshit-rabbah.bet').anchor.span;
      s.end = 1;
      s.exact = 'ב';
      return d;
    },
    expect: /not grapheme aligned/,
  },
  {
    name: 'an anchor with no Canonical Reference',
    file: 'data/interpretations/interpretations.json',
    mutate: (d) => {
      delete d.find((i) => i.id === 'interp:gita.2-47.shankara').anchor.cr;
      return d;
    },
    expect: /missing required property "cr"/,
  },
  {
    name: 'a machine-authored reading filed as traditional commentary',
    file: 'data/interpretations/interpretations.json',
    mutate: (d) => {
      d.find((i) => i.id === 'interp:gita.2-47.machine.01').layer = 'layer:gita.shankara';
      return d;
    },
    expect: /cannot occupy the register of the tradition/,
  },
  {
    name: 'a machine layer placed in the default stack',
    file: 'data/layers/layers.json',
    mutate: (d) => {
      d.find((l) => l.id === 'layer:gita.machine.reading-01').default_in_stack = true;
      return d;
    },
    expect: /never sit in the default stack/,
  },
  {
    name: 'a model-authored layer with no generation provenance',
    file: 'data/layers/layers.json',
    mutate: (d) => {
      delete d.find((l) => l.id === 'layer:gita.machine.reading-01').author.inputs;
      return d;
    },
    expect: /missing required property "inputs"/,
  },
  {
    name: 'a fork whose parent does not exist',
    file: 'data/interpretations/interpretations.json',
    mutate: (d) => {
      d.find((i) => i.id === 'interp:gita.2-47.tilak').derived_from = ['interp:does-not-exist'];
      return d;
    },
    expect: /must never detach from its parent/,
  },
  {
    name: 'a Canonical Reference that does not fit its work grammar',
    file: 'data/interpretations/interpretations.json',
    mutate: (d) => {
      d.find((i) => i.id === 'interp:gita.2-47.shankara').anchor.cr = 'gita:2';
      return d;
    },
    expect: /does not match the declared pattern|reference grammar/,
  },
  {
    name: 'synthetic recitation marked as allowed',
    file: 'data/renditions/renditions.json',
    mutate: (d) => {
      d.find((r) => r.id === 'rend:quran.audio.blocked').policy.decision = 'allowed';
      return d;
    },
    expect: /synthetic recitation is never generated|expected const/,
  },
  {
    name: 'a published rendition with no embedded provenance',
    file: 'data/renditions/renditions.json',
    mutate: (d) => {
      d.find((r) => r.id === 'rend:gita.11-12.vishvarupa').provenance_embedded = false;
      return d;
    },
    expect: /must carry embedded provenance/,
  },
];

let failed = 0;
for (const c of cases) {
  const dir = mkdtempSync(join(tmpdir(), 'con001-'));
  try {
    for (const d of ['schema', 'data', 'tools']) cpSync(d, join(dir, d), { recursive: true });
    const target = join(dir, c.file);
    writeFileSync(target, JSON.stringify(c.mutate(JSON.parse(readFileSync(target, 'utf8'))), null, 2));

    let output = '';
    let rejected = false;
    try {
      execFileSync(process.execPath, ['tools/validate.mjs'], {
        cwd: dir,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (e) {
      rejected = true;
      output = `${e.stdout ?? ''}${e.stderr ?? ''}`;
    }

    if (!rejected) {
      console.error(`FAIL  ${c.name}\n      validation passed but should not have`);
      failed++;
    } else if (!c.expect.test(output)) {
      console.error(`FAIL  ${c.name}\n      rejected, but not for the expected reason:\n${output.trim().split('\n').map((l) => '      ' + l).join('\n')}`);
      failed++;
    } else {
      console.log(`ok    ${c.name}`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

console.log(failed ? `\n${failed} of ${cases.length} negative tests failed` : `\nall ${cases.length} negative tests pass`);
process.exit(failed ? 1 : 0);
