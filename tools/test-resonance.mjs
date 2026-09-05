#!/usr/bin/env node
// Tests for the resonance invariants in docs/10-resonance.md and
// docs/11-guardrails.md.
//
// These are the properties that keep a cross-tradition comparison engine from
// becoming either a syncretism machine ("all religions say the same thing") or
// a conflict generator ("these traditions oppose each other"). Both are failure
// modes with real-world consequences, so both get tests.
//
// Usage: node tools/test-resonance.mjs

import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { map, EVIDENCE_FLOOR } from './resonance.mjs';

let failed = 0;
const t = (name, fn) => {
  const dir = mkdtempSync(join(tmpdir(), 'con001-res-'));
  try {
    cpSync('data', join(dir, 'data'), { recursive: true });
    const patch = (file, f) => {
      const p = join(dir, file);
      writeFileSync(p, JSON.stringify(f(JSON.parse(readFileSync(p, 'utf8'))), null, 2));
    };
    fn(patch, () => map(dir));
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
const hits = (found, re) => found.some((f) => re.test(f.message));
const errorsOf = (found) => found.filter((f) => f.severity === 'error');

t('an agreement that records no divergence is rejected', (patch, run) => {
  assert(errorsOf(run().audit()).length === 0, 'baseline corpus should have no audit errors');
  patch('data/resonances/resonances.json', (rs) => {
    rs.find((r) => r.id === 'res:outcome.gita-analects-dhammapada').divergence = [];
    return rs;
  });
  assert(hits(run().audit(), /no divergence/), 'a resonance with no divergence must be rejected');
});

t('a claim of similarity is rejected when the positions are far apart', (patch, run) => {
  patch('data/resonances/resonances.json', (rs) => {
    rs.find((r) => r.id === 'res:naming.daodejing-john').claim = 'answers-similarly';
    return rs;
  });
  assert(hits(run().audit(), /claims "answers-similarly" but the positions span/),
    'the claim must match the geometry of the axis');
});

t('a claim of opposition is rejected when the positions nearly coincide', (patch, run) => {
  patch('data/resonances/resonances.json', (rs) => {
    rs.find((r) => r.id === 'res:outcome.gita-analects-dhammapada').claim = 'answers-oppositely';
    return rs;
  });
  assert(hits(run().audit(), /claims "answers-oppositely" but the positions span only/),
    'manufactured opposition must be rejected as firmly as manufactured agreement');
});

t('a position with no anchored evidence is rejected', (patch, run) => {
  patch('data/positions/positions.json', (ps) => {
    ps.find((p) => p.id === 'pos:dhp.1.buddhaghosa').evidence = ['interp:does-not-exist'];
    return ps;
  });
  assert(hits(run().audit(), /evidence interp:does-not-exist does not exist/),
    'no position may exist without a real anchored interpretation behind it');
});

t('a high-consequence position with no advisory review is held', (patch, run) => {
  patch('data/positions/positions.json', (ps) => {
    delete ps.find((p) => p.id === 'pos:upanishad.ish1.shankara').reviewed_by;
    return ps;
  });
  const dev = run().audit();
  assert(hits(dev, /high-consequence question with no advisory review/),
    'high-tier questions require sign-off from inside the tradition');
  assert(dev.find((f) => f.code === 'awaiting-advisory').severity === 'warn',
    'in development an unreviewed high-tier item warns rather than failing the build');
  const prod = run().audit({ strict: true });
  assert(prod.find((f) => f.code === 'awaiting-advisory').severity === 'error',
    'in production the same item must block');
});

t('"pending" is not a sign-off', (patch, run) => {
  patch('data/positions/positions.json', (ps) => {
    ps.find((p) => p.id === 'pos:upanishad.ish1.shankara').reviewed_by = ['advisory:hindu (pending)'];
    return ps;
  });
  assert(hits(run().audit(), /no advisory review/),
    'a placeholder must not satisfy a review gate — otherwise writing the word "pending" clears it');
});

t('the production set excludes held items and names them', (_patch, run) => {
  const m = run();
  const prod = m.productionSet();
  assert(prod.held.includes('res:self.upanishad-dhammapada'),
    'the unreviewed high-tier resonance must be named as held');
  assert(!prod.resonances.some((r) => r.id === 'res:self.upanishad-dhammapada'),
    'held items must be excluded from a production bundle, never silently downgraded');
  assert(prod.resonances.length === m.resonances.length - 1, 'only the held item is excluded');
});

t('a resonance can never be obtained without the internal spread of its traditions', (_patch, run) => {
  const m = run();
  for (const r of m.resonances) {
    const c = m.withContext(r);
    assert(Array.isArray(c.internal) && c.internal.length === c.traditions.length,
      `${r.id}: context is missing internal spread for one of its traditions`);
    assert(c.resonance && c.question, `${r.id}: context must carry the question it answers`);
  }
});

t('internal disagreement can exceed the gap a resonance reports', (_patch, run) => {
  // The neutrality mechanism, demonstrated on real data: Hindu readings of
  // q:act-and-outcome span 0.20, which is wider than the distance between the
  // Confucian and Buddhist readings the same resonance relates. "One tradition
  // against another" is not a sentence this data supports.
  const m = run();
  const hindu = m.internalSpread('q:act-and-outcome', 'hindu');
  const conf = m.forQuestion('q:act-and-outcome').find((p) => p.tradition === 'confucian');
  const budd = m.forQuestion('q:act-and-outcome').find((p) => p.tradition === 'buddhist');
  assert(hindu.range > Math.abs(conf.value - budd.value),
    'expected the within-tradition spread to exceed the cross-tradition gap on this question');
});

t('a resonance below the evidence floor is not displayable', (patch, run) => {
  patch('data/positions/positions.json', (ps) => {
    ps.find((p) => p.id === 'pos:quran.2-1.ibn-kathir').confidence = EVIDENCE_FLOOR - 0.1;
    return ps;
  });
  const m = run();
  const c = m.withContext(m.resonances.find((r) => r.id === 'res:naming.daodejing-quran'));
  assert(c.displayable === false, 'below the floor a resonance is not shown at all, not shown faintly');
});

t('a reader profile reports positions, never an affiliation', (_patch, run) => {
  const m = run();
  const reader = JSON.parse(readFileSync('data/profiles/example-reader.local.json', 'utf8'));
  const rows = m.profile(reader);
  assert(rows.length > 0, 'profile should produce rows');
  const json = JSON.stringify(rows);
  for (const banned of ['affiliation', 'belongs_to', 'match_percent', 'religion', 'your_tradition'])
    assert(!json.includes(banned), `profile output must never contain "${banned}"`);
  for (const row of rows) {
    assert(row.nearest?.length, 'every row must name what is near');
    assert(row.farthest, 'every row must also name what is far — the map is not a flattery machine');
    assert(row.steelman, 'every row must offer the strongest reading against the reader');
  }
});

t('the steelman is never the reader\'s own nearest position', (_patch, run) => {
  const m = run();
  const reader = JSON.parse(readFileSync('data/profiles/example-reader.local.json', 'utf8'));
  for (const row of m.profile(reader))
    assert(row.steelman.position.id !== row.nearest[0].position.id,
      `${row.question.id}: the reading offered against the reader must not be the one they already hold`);
});

console.log(failed ? `\n${failed} resonance test(s) failed` : `\nall resonance tests pass`);
process.exit(failed ? 1 : 0);
