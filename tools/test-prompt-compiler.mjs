#!/usr/bin/env node
// Tests for the Studio prompt compiler.
//
// Usage: node tools/test-prompt-compiler.mjs

import { readFileSync } from 'node:fs';
import { compile, oppositionsAt } from './prompt-compiler.mjs';

const read = (p) => JSON.parse(readFileSync(p, 'utf8'));
const layers = read('data/layers/layers.json');
const interps = read('data/interpretations/interpretations.json');
const L = (id) => layers.find((l) => l.id === id);

let failed = 0;
const t = (name, fn) => {
  try { fn(); console.log(`ok    ${name}`); }
  catch (e) { console.error(`FAIL  ${name}\n      ${e.message}`); failed++; }
};
const assert = (c, m) => { if (!c) throw new Error(m); };

const GITA = ['layer:gita.shankara', 'layer:gita.tilak', 'layer:gita.gandhi'].map(L);
const ops = oppositionsAt(interps, 'gita:2.47');

t('contending readings are never merged into one payload', () => {
  const r = compile({ anchor: 'gita:2.47', lenses: GITA, oppositions: ops });
  assert(r.decision === 'compiled', r.decision);
  assert(r.contending === true, 'Śaṅkara, Tilak and Gandhi are in recorded opposition');
  assert(r.payloads.length > 1, `expected one payload per faction, got ${r.payloads.length}`);
  for (const p of r.payloads) {
    const authors = p.lenses.map((id) => L(id).author.display);
    for (const o of ops)
      assert(!(p.lenses.includes(o.from) && p.lenses.includes(o.to)),
        `payload merged opposed lenses: ${authors.join(' + ')}`);
  }
});

t('a single reading compiles to exactly one payload', () => {
  const r = compile({ anchor: 'gita:2.47', lenses: [L('layer:gita.shankara')], oppositions: ops });
  assert(r.payloads.length === 1 && r.contending === false, 'one lens, one payload');
});

t('the opposition comes from the fork graph, not from wording', () => {
  assert(ops.length >= 2, `expected rebuttals at gita:2.47, found ${ops.length}`);
  const r = compile({ anchor: 'gita:2.47', lenses: GITA, oppositions: [] });
  assert(r.payloads.length === 1,
    'with no recorded opposition the same three lenses merge — so the split is driven by data, not by text similarity');
});

t('a motif one active lens excludes is dropped from the positive prompt', () => {
  const a = { id: 'layer:x', author: { display: 'A' }, direction: { register: 'kinetic', motifs: ['the battle rendered as spectacle'], avoid: [] } };
  const b = { id: 'layer:y', author: { display: 'B' }, direction: { register: 'kinetic', motifs: ['stillness'], avoid: ['the battle rendered as spectacle'] } };
  const r = compile({ anchor: 'gita:2.47', lenses: [a, b] });
  const p = r.payloads[0];
  assert(p.dropped_from_positive.includes('the battle rendered as spectacle'), 'the excluded motif must be dropped');
  assert(!p.positive.includes('battle rendered as spectacle'), 'and must not survive in the positive prompt');
  assert(p.negative.includes('the battle rendered as spectacle'), 'and must appear in the negative prompt');
});

t('figural blocks add locked negatives that the caller cannot drop', () => {
  const r = compile({ anchor: 'quran:2:1', lenses: [L('layer:quran.ibn-kathir')] });
  assert(r.blocks.some((b) => b.rule === 'no-figural-depiction'), 'the block must be reported');
  const p = r.payloads[0];
  assert(p.locked_negative.length > 0, 'locked negatives must be present');
  for (const n of p.locked_negative)
    assert(p.negative.includes(n), `locked negative "${n}" must be in the negative prompt`);
  assert(/calligraph|geometr|flat-on/i.test(p.camera + p.positive),
    'the Qur’ān directive should compile to a calligraphic register');
});

t('a corpus with generation blocked yields no prompt at all', () => {
  const r = compile({ anchor: 'quran:2:1', lenses: [L('layer:quran.ibn-kathir')], policy: { generation: 'blocked' } });
  assert(r.decision === 'blocked' && r.payloads.length === 0,
    'a prompt you will not run should not be composed');
  assert(r.blocks.length > 0 && r.note.includes('names the rule'), 'the refusal must name its rule');
});

t('compilation is deterministic', () => {
  const one = compile({ anchor: 'gita:2.47', lenses: GITA, oppositions: ops });
  const two = compile({ anchor: 'gita:2.47', lenses: GITA, oppositions: ops });
  assert(JSON.stringify(one) === JSON.stringify(two), 'same inputs must compile identically');
  assert(one.payloads.every((p) => /^pl:[0-9a-f]{8}$/.test(p.id)), 'each payload carries a stable id');
});

t('every payload carries its lenses and its anchor', () => {
  const r = compile({ anchor: 'gita:2.47', lenses: GITA, oppositions: ops });
  for (const p of r.payloads) {
    assert(p.anchor === 'gita:2.47', 'anchor must travel with the payload');
    assert(p.lenses.length > 0, 'lenses must travel with the payload');
    assert(p.positive.includes('read through'), 'the subject line must name the reading, not the text alone');
  }
});

t('no lens with a direction means nothing is compiled', () => {
  const r = compile({ anchor: 'gita:2.47', lenses: [] });
  assert(r.decision === 'nothing-to-compile' && r.payloads.length === 0, r.decision);
});

t('every directing layer in the corpus compiles', () => {
  for (const l of layers.filter((x) => x.direction)) {
    const r = compile({ anchor: 'test:1', lenses: [l] });
    assert(r.payloads.length === 1, `${l.id} failed to compile`);
    const p = r.payloads[0];
    assert(p.aspect && p.camera && p.lighting, `${l.id} produced an incomplete camera spec`);
  }
});

console.log(failed ? `\n${failed} prompt-compiler test(s) failed` : `\nall prompt-compiler tests pass`);
process.exit(failed ? 1 : 0);
