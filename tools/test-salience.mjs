#!/usr/bin/env node
// Tests for the salience invariants in docs/06-salience.md.
//
// These are the properties that stop a popularity system from quietly becoming
// a majority vote on what a text means. Each case builds a fixture corpus in a
// scratch directory and asserts the property holds.
//
// Usage: node tools/test-salience.mjs

import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { analyse } from './salience.mjs';

let failed = 0;
const t = (name, fn) => {
  const dir = mkdtempSync(join(tmpdir(), 'con001-sal-'));
  try {
    cpSync('data', join(dir, 'data'), { recursive: true });
    const patch = (file, f) => {
      const p = join(dir, file);
      writeFileSync(p, JSON.stringify(f(JSON.parse(readFileSync(p, 'utf8'))), null, 2));
    };
    fn(patch, () => analyse(dir));
    console.log(`ok    ${name}`);
  } catch (e) {
    console.error(`FAIL  ${name}\n      ${e.message}`);
    failed++;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};
const assert = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

t('a machine layer cannot manufacture the appearance of disagreement', (patch, run) => {
  const before = run().contestation('gita:2.47').index;

  // Give the machine layer a stance of its own and pile on machine readings.
  patch('data/layers/layers.json', (ls) => {
    ls.find((l) => l.id === 'layer:gita.machine.reading-01').stance = 'invented-school';
    return ls;
  });
  patch('data/interpretations/interpretations.json', (is) => {
    const seed = is.find((i) => i.id === 'interp:gita.2-47.machine.01');
    for (let n = 0; n < 5; n++)
      is.push({ ...structuredClone(seed), id: `${seed.id}.clone${n}`, relation: undefined, derived_from: undefined });
    return is;
  });

  const after = run().contestation('gita:2.47').index;
  assert(after === before, `contestation moved from ${before} to ${after}; machine layers must not count`);
});

t('a personal layer cannot move the contestation index', (patch, run) => {
  const before = run().contestation('gita:2.47').index;
  patch('data/layers/layers.json', (ls) => {
    ls.find((l) => l.id === 'layer:user.daniel.private').stance = 'my-own-school';
    return ls;
  });
  const after = run().contestation('gita:2.47').index;
  assert(after === before, `contestation moved from ${before} to ${after}; personal layers must not count`);
});

t('an anchor with a single stance scores zero contestation', (_patch, run) => {
  const r = run().contestation('bible:JHN.3.16');
  assert(r.index === 0, `expected 0, got ${r.index}`);
});

t('the long-tail floor fires when engagement buries a minority reading', (patch, run) => {
  assert(run().diversityFloor('gita:2.47') === null, 'floor should be quiet before the corpus is skewed');

  // Bury every non-Śaṅkara reading of 2.47 under the majority one.
  patch('data/salience/engagement.json', (e) => {
    e.interpretations['interp:gita.2-47.shankara'].reads = 5_000_000;
    for (const id of ['interp:gita.2-47.tilak', 'interp:gita.2-47.gandhi'])
      e.interpretations[id] = { reads: 5, saves: 0, forks: 0, shares: 0 };
    return e;
  });
  // With philology (a non-stance reference layer) ranked second, the top two
  // are still not two schools of thought arguing.
  patch('data/layers/layers.json', (ls) => {
    ls.find((l) => l.id === 'layer:gita.philology').stance = 'advaita';
    return ls;
  });

  const floor = run().diversityFloor('gita:2.47');
  assert(floor !== null, 'floor should fire once one stance dominates the top readings');
  assert(floor.leading === 'advaita', `leading stance was ${floor.leading}`);
  assert(floor.stance !== 'advaita', 'the injected reading must come from outside the leading stance');
});

t('popularity is normalised within a work, never across traditions', (patch, run) => {
  // Make one work wildly more read than the others; the others must be unmoved.
  const before = run().popularity.get('interp:analects.1-1.zhuxi.xi');
  patch('data/salience/engagement.json', (e) => {
    e.interpretations['interp:bible.jhn3-16.matthew-henry'].reads = 900_000_000;
    return e;
  });
  const after = run().popularity.get('interp:analects.1-1.zhuxi.xi');
  assert(after === before, `Analects popularity moved from ${before} to ${after} because a Bible verse got popular`);
});

console.log(failed ? `\n${failed} salience test(s) failed` : `\nall salience tests pass`);
process.exit(failed ? 1 : 0);
