#!/usr/bin/env node
// Dependency-free validator for the con001 data model.
//
// Two passes:
//   1. Schema    — the JSON Schema subset actually used by schema/*.json
//   2. Integrity — the checks a schema cannot express: span offsets really do
//      select the quoted text, references resolve, machine provenance is
//      complete, letter spans do not split combining marks.
//
// Usage: node tools/validate.mjs

import { readFileSync, readdirSync } from 'node:fs';

const read = (p) => JSON.parse(readFileSync(p, 'utf8'));
const cps = (s) => [...s];

/* ------------------------------------------------------------------ schema */

const schemas = new Map();
for (const f of readdirSync('schema')) {
  const s = read(`schema/${f}`);
  schemas.set(s.$id, s);
}
const deref = (s) => (s && s.$ref ? deref(schemas.get(s.$ref)) : s);

function check(schema, value, path, errs) {
  schema = deref(schema);
  if (!schema) return;

  if (schema.const !== undefined && value !== schema.const)
    errs.push(`${path}: expected const ${JSON.stringify(schema.const)}, got ${JSON.stringify(value)}`);

  if (schema.enum && !schema.enum.includes(value))
    errs.push(`${path}: ${JSON.stringify(value)} not in [${schema.enum.join(', ')}]`);

  if (schema.type) {
    const types = [].concat(schema.type);
    const actual = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
    const ok = types.some((t) =>
      t === 'integer' ? Number.isInteger(value)
      : t === 'number' ? typeof value === 'number'
      : t === actual);
    if (!ok) {
      errs.push(`${path}: expected ${types.join('|')}, got ${actual}`);
      return;
    }
  }

  if (typeof value === 'string') {
    if (schema.pattern && !new RegExp(schema.pattern, 'u').test(value))
      errs.push(`${path}: ${JSON.stringify(value)} does not match the declared pattern`);
    if (schema.minLength !== undefined && cps(value).length < schema.minLength)
      errs.push(`${path}: shorter than minLength ${schema.minLength}`);
  }

  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum)
      errs.push(`${path}: below minimum ${schema.minimum}`);
    if (schema.maximum !== undefined && value > schema.maximum)
      errs.push(`${path}: above maximum ${schema.maximum}`);
  }

  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems)
      errs.push(`${path}: fewer than minItems ${schema.minItems}`);
    if (schema.items) value.forEach((v, i) => check(schema.items, v, `${path}[${i}]`, errs));
  }

  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const r of schema.required ?? [])
      if (!(r in value)) errs.push(`${path}: missing required property "${r}"`);

    if (schema.minProperties !== undefined && Object.keys(value).length < schema.minProperties)
      errs.push(`${path}: fewer than minProperties ${schema.minProperties}`);

    const props = schema.properties ?? {};
    for (const [k, v] of Object.entries(value)) {
      if (k in props) check(props[k], v, `${path}.${k}`, errs);
      else if (schema.additionalProperties === false) errs.push(`${path}: unexpected property "${k}"`);
      else if (schema.additionalProperties && typeof schema.additionalProperties === 'object')
        check(schema.additionalProperties, v, `${path}.${k}`, errs);
      if (schema.propertyNames?.pattern && !new RegExp(schema.propertyNames.pattern, 'u').test(k))
        errs.push(`${path}: key "${k}" does not match the declared propertyNames pattern`);
    }
  }

  for (const sub of schema.allOf ?? []) {
    if (sub.if) {
      const condErrs = [];
      check(sub.if, value, path, condErrs);
      if (condErrs.length === 0 && sub.then) check(sub.then, value, path, errs);
    } else {
      check(sub, value, path, errs);
    }
  }
}

/* -------------------------------------------------------------------- data */

const S = (n) => `https://con001.dev/schema/${n}.schema.json`;
const works = read('data/works/works.json');
const editions = read('data/editions/editions.json');
const units = read('data/editions/text-units.json');
const layers = read('data/layers/layers.json');
const interps = read('data/interpretations/interpretations.json');
const lenses = read('data/lenses/lenses.json');
const rends = read('data/renditions/renditions.json');

const errs = [];
const sets = [
  ['work', works, 'data/works/works.json'],
  ['edition', editions, 'data/editions/editions.json'],
  ['text-unit', units, 'data/editions/text-units.json'],
  ['layer', layers, 'data/layers/layers.json'],
  ['interpretation', interps, 'data/interpretations/interpretations.json'],
  ['lens', lenses, 'data/lenses/lenses.json'],
  ['rendition', rends, 'data/renditions/renditions.json'],
];
for (const [name, docs, file] of sets)
  docs.forEach((d, i) => check(schemas.get(S(name)), d, `${file}[${i}]`, errs));

/* --------------------------------------------------------------- integrity */

const idsOf = (xs) => new Set(xs.map((x) => x.id));
const workIds = idsOf(works);
const edIds = idsOf(editions);
const layerIds = idsOf(layers);
const interpIds = idsOf(interps);
const lensIds = idsOf(lenses);
const unitKey = (e, cr) => `${e} ${cr}`;
const unitMap = new Map(units.map((u) => [unitKey(u.edition, u.cr), u]));

const I = (m) => errs.push(`integrity: ${m}`);

for (const e of editions) if (!workIds.has(e.work)) I(`${e.id} references unknown work ${e.work}`);
for (const u of units) if (!edIds.has(u.edition)) I(`text unit ${u.cr} references unknown edition ${u.edition}`);
for (const l of layers) if (!workIds.has(l.work)) I(`${l.id} references unknown work ${l.work}`);

for (const it of interps) {
  if (!layerIds.has(it.layer)) I(`${it.id} references unknown layer ${it.layer}`);
  for (const p of it.derived_from ?? [])
    if (!interpIds.has(p)) I(`${it.id} references unknown parent ${p} (a fork must never detach from its parent)`);

  // An anchor with no Canonical Reference is already rejected by the schema
  // pass; skip it here rather than crashing, so the whole report is produced.
  if (!it.anchor?.cr) continue;

  // The CR must be well formed for the work it addresses.
  const prefix = it.anchor.cr.split(':')[0];
  const work = works.find((w) => w.cr_grammar.split(':')[0] === prefix);
  if (!work) I(`${it.id}: CR "${it.anchor.cr}" belongs to no configured work`);
  else if (!new RegExp(work.cr_pattern).test(it.anchor.cr))
    I(`${it.id}: CR "${it.anchor.cr}" does not match the ${work.id} reference grammar`);

  const span = it.anchor.span;
  if (!span) continue;

  if (!edIds.has(span.origin)) {
    I(`${it.id}: span origin ${span.origin} is unknown`);
    continue;
  }
  const unit = unitMap.get(unitKey(span.origin, it.anchor.cr));
  if (!unit) {
    I(`${it.id}: no text unit for ${span.origin} at ${it.anchor.cr}`);
    continue;
  }

  // The check that matters: do the stored offsets actually select the quoted text?
  const norm = unit.text.normalize('NFC');
  const text = cps(norm);
  const sliced = text.slice(span.start, span.end).join('');
  if (sliced.normalize('NFC') !== span.exact.normalize('NFC'))
    I(`${it.id}: offsets ${span.start}-${span.end} select ${JSON.stringify(sliced)}, but exact is ${JSON.stringify(span.exact)}`);

  // Letter and word spans must not split a grapheme cluster. A consonant cut
  // from its combining marks renders as mojibake and, in Hebrew and Arabic,
  // damages the text itself. See docs/01-anchoring.md.
  if (span.grapheme_aligned !== false) {
    const lang = editions.find((e) => e.id === span.origin)?.language ?? 'en';
    const bounds = new Set([0, text.length]);
    for (const seg of new Intl.Segmenter(lang, { granularity: 'grapheme' }).segment(norm))
      bounds.add(cps(norm.slice(0, seg.index)).length + cps(seg.segment).length);
    if (!bounds.has(span.start) || !bounds.has(span.end))
      I(`${it.id}: span ${span.start}-${span.end} is not grapheme aligned in ${span.origin} (it would split a letter from its combining marks)`);
  }
}

// Machine-authored content is fenced. See docs/02-layers.md.
for (const l of layers)
  if (l.kind === 'machine' && l.default_in_stack)
    I(`${l.id}: a machine layer must never sit in the default stack`);

for (const it of interps) {
  const layer = layers.find((l) => l.id === it.layer);
  if (it.author.type === 'model' && layer?.kind !== 'machine')
    I(`${it.id}: model-authored but filed under a "${layer?.kind}" layer — machine content cannot occupy the register of the tradition`);
  if (layer?.kind === 'machine' && it.author.type !== 'model')
    I(`${it.id}: sits in a machine layer but is not model-authored`);
  if (it.visibility === 'public' && !it.author.display)
    I(`${it.id}: public interpretations require an attribution`);
}

for (const le of lenses) {
  if (!workIds.has(le.work)) I(`${le.id} references unknown work ${le.work}`);
  for (const e of le.editions) if (!edIds.has(e)) I(`${le.id} references unknown edition ${e}`);
  for (const l of le.layers) if (!layerIds.has(l)) I(`${le.id} references unknown layer ${l}`);
}

for (const r of rends) {
  if (r.lens && !lensIds.has(r.lens)) I(`${r.id} references unknown lens ${r.lens}`);
  if (r.medium === 'audio' && r.policy.decision !== 'blocked')
    I(`${r.id}: synthetic recitation is never generated`);
  if (r.policy.decision === 'allowed' && !r.provenance_embedded)
    I(`${r.id}: an allowed rendition must carry embedded provenance`);
}

/* ------------------------------------------------------------------ report */

if (errs.length) {
  console.error(`FAIL — ${errs.length} problem(s)\n`);
  for (const e of errs) console.error('  ' + e);
  process.exit(1);
}

const counts = sets.map(([n, d]) => `${d.length} ${n}`).join(', ');
const spanned = interps.filter((i) => i.anchor.span).length;
const letters = interps.filter((i) => i.anchor.granularity === 'letter').length;
console.log(`OK — ${counts}`);
console.log(`     ${spanned} spans verified against edition text, ${letters} of them at letter granularity`);
