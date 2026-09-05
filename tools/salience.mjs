#!/usr/bin/env node
// Salience and contestation over the interpretation corpus.
//
// Two independent measures, computed separately and never blended into one
// number (see docs/06-salience.md):
//
//   POPULARITY   — how much a reading is actually read. Log-damped so a
//                  runaway passage cannot flatten everything beneath it, and
//                  normalised WITHIN a work, never across traditions.
//
//   CONTESTATION — how much the received tradition disagrees at this anchor.
//                  Normalised entropy over the canonically-weighted spread of
//                  stances, plus the density of explicit rebuttals in the fork
//                  graph. Personal and machine layers are excluded by
//                  construction: they must not be able to manufacture the
//                  appearance of a live dispute.
//
// The point of keeping them apart is that they rank differently. The most-read
// passage in a corpus is usually one nobody argues about.
//
// Usage: node tools/salience.mjs

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export function analyse(root = '.') {
const read = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'));

const works = read('data/works/works.json');
const layers = read('data/layers/layers.json');
const interps = read('data/interpretations/interpretations.json');
const engagement = read('data/salience/engagement.json');

const layerOf = new Map(layers.map((l) => [l.id, l]));
const workOfCr = (cr) => works.find((w) => w.cr_grammar.split(':')[0] === cr.split(':')[0]);

/* --------------------------------------------------------------- popularity */

// Reads dominate the count, but a save or a fork is a much stronger signal of
// value than a glance, so they are weighted up rather than counted alike.
const rawScore = (e) => (e ? e.reads + 6 * e.saves + 25 * e.forks + 10 * e.shares : 0);

const popularity = new Map();
for (const w of works) {
  const inWork = interps.filter((i) => workOfCr(i.anchor.cr)?.id === w.id);
  const scored = inWork.map((i) => [i.id, Math.log1p(rawScore(engagement.interpretations[i.id]))]);
  const max = Math.max(0, ...scored.map(([, s]) => s));
  for (const [id, s] of scored) popularity.set(id, max > 0 ? s / max : 0);
}

/* ------------------------------------------------------------- contestation */

// Stances available across a whole work set the entropy ceiling, so that units
// of the same work are comparable to each other.
const stanceOf = (i) => {
  const l = layerOf.get(i.layer);
  return l?.stance ?? l?.kind ?? 'unknown';
};
const countsAsTradition = (i) => {
  const l = layerOf.get(i.layer);
  return l && l.kind !== 'personal' && l.kind !== 'machine' && (l.canonical?.weight ?? 0) > 0;
};

const stancesPerWork = new Map();
for (const w of works) {
  const set = new Set(
    interps.filter((i) => workOfCr(i.anchor.cr)?.id === w.id && countsAsTradition(i)).map(stanceOf)
  );
  stancesPerWork.set(w.id, Math.max(set.size, 1));
}

const byCr = new Map();
for (const i of interps) {
  if (!byCr.has(i.anchor.cr)) byCr.set(i.anchor.cr, []);
  byCr.get(i.anchor.cr).push(i);
}

const REBUTTING = new Set(['rebuts', 'questions']);

function contestation(cr) {
  const all = byCr.get(cr) ?? [];
  const voices = all.filter(countsAsTradition);
  const work = workOfCr(cr);

  const mass = new Map();
  let total = 0;
  for (const i of voices) {
    const w = layerOf.get(i.layer).canonical.weight;
    mass.set(stanceOf(i), (mass.get(stanceOf(i)) ?? 0) + w);
    total += w;
  }

  let H = 0;
  if (total > 0)
    for (const m of mass.values()) {
      const p = m / total;
      if (p > 0) H -= p * Math.log(p);
    }
  const ceiling = Math.log(stancesPerWork.get(work?.id) ?? 1);
  const spread = ceiling > 0 ? Math.min(1, H / ceiling) : 0;

  // An explicit rebuttal aimed at another reading of the SAME anchor is much
  // stronger evidence of live dispute than mere plurality of stances.
  const here = new Set(all.map((i) => i.id));
  const rebuttals = voices.filter(
    (i) => REBUTTING.has(i.relation) && (i.derived_from ?? []).some((p) => here.has(p))
  ).length;
  const density = voices.length ? Math.min(1, rebuttals / Math.max(1, voices.length - 1)) : 0;

  return {
    cr,
    work: work?.id ?? '?',
    voices: voices.length,
    stances: mass.size,
    spread,
    rebuttals,
    density,
    index: 0.6 * spread + 0.4 * density,
  };
}

/* ------------------------------------------------------- long-tail guarantee */

// Ordering readings by popularity alone collapses every anchor into its
// majority reading. The floor: whatever the ranking says, the surface must
// always carry a reading from outside the leading stance. This reports where
// that injection is needed. See docs/06-salience.md.
function diversityFloor(cr, topN = 2) {
  const all = (byCr.get(cr) ?? []).filter(countsAsTradition);
  if (all.length < 2) return null;
  const ranked = [...all].sort((a, b) => (popularity.get(b.id) ?? 0) - (popularity.get(a.id) ?? 0));
  const top = ranked.slice(0, topN);
  const leading = stanceOf(top[0]);
  if (top.some((i) => stanceOf(i) !== leading)) return null;
  const rescued = ranked.slice(topN).find((i) => stanceOf(i) !== leading);
  return rescued ? { leading, inject: rescued.id, stance: stanceOf(rescued) } : null;
}

return { works, layers, interps, byCr, popularity, contestation, diversityFloor, stanceOf, countsAsTradition };
}

/* ------------------------------------------------------------------ report */

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
const { works, interps, byCr, popularity, contestation, diversityFloor } = analyse('.');

const pct = (n) => (n * 100).toFixed(0).padStart(3) + '%';
const rows = [...byCr.keys()].map(contestation);

console.log('CONTESTATION — where the tradition argues\n');
console.log('  anchor                    work              voices  stances  spread  rebut   index');
console.log('  ' + '-'.repeat(76));
for (const r of [...rows].sort((a, b) => b.index - a.index)) {
  console.log(
    `  ${r.cr.padEnd(25)} ${r.work.padEnd(17)} ${String(r.voices).padStart(6)} ` +
    `${String(r.stances).padStart(8)}  ${pct(r.spread)}   ${pct(r.density)}   ${pct(r.index)}`
  );
}

const popByCr = [...byCr.keys()]
  .map((cr) => ({ cr, pop: Math.max(0, ...(byCr.get(cr) ?? []).map((i) => popularity.get(i.id) ?? 0)) }))
  .sort((a, b) => b.pop - a.pop);

console.log('\nPOPULARITY — where the readers are\n');
console.log('  anchor                    reach   most-read reading');
console.log('  ' + '-'.repeat(76));
for (const { cr, pop } of popByCr) {
  const top = (byCr.get(cr) ?? []).sort((a, b) => (popularity.get(b.id) ?? 0) - (popularity.get(a.id) ?? 0))[0];
  console.log(`  ${cr.padEnd(25)} ${pct(pop)}   ${top.id}`);
}

const contestTop = [...rows].sort((a, b) => b.index - a.index).slice(0, 3).map((r) => r.cr);
const popTop = popByCr.slice(0, 3).map((p) => p.cr);
const overlap = contestTop.filter((cr) => popTop.includes(cr)).length;
console.log(
  `\n  Top three by contestation: ${contestTop.join(', ')}` +
  `\n  Top three by popularity:   ${popTop.join(', ')}` +
  `\n  ${overlap} of 3 in common. The most-read passage in a corpus is usually one nobody argues about,` +
  `\n  which is why the two measures are never merged into a single score.` +
  `\n  (Seed corpus is small; treat the exact figures as illustrative.)`
);

console.log('\nLONG-TAIL FLOOR — anchors where ranking alone would hide the disagreement\n');
let floors = 0;
for (const cr of byCr.keys()) {
  const f = diversityFloor(cr);
  if (!f) continue;
  floors++;
  console.log(`  ${cr}: top readings are all "${f.leading}" — surface must also carry ${f.inject} ("${f.stance}")`);
}
if (!floors) console.log('  none — every anchor already surfaces more than one stance in its top readings');

console.log(
  `\n  ${interps.length} interpretations over ${byCr.size} anchors in ${works.length} works. ` +
  `Engagement figures are synthetic seed data (data/salience/engagement.json).`
);
}
