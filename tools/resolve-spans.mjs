#!/usr/bin/env node
// Fills span.start / span.end from prefix + exact, in Unicode CODEPOINT offsets
// measured against the NFC-normalised stored text of the origin edition's unit.
//
// Spans are authored by quoting text, not by counting characters. Offsets are
// derived. See docs/01-anchoring.md.

import { readFileSync, writeFileSync } from 'node:fs';

const cps = (s) => [...s];
const units = JSON.parse(readFileSync('data/editions/text-units.json', 'utf8'));
const interps = JSON.parse(readFileSync('data/interpretations/interpretations.json', 'utf8'));

const unitFor = (edition, cr) => units.find((u) => u.edition === edition && u.cr === cr);

let changed = 0;
for (const it of interps) {
  const span = it.anchor?.span;
  if (!span) continue;
  const unit = unitFor(span.origin, it.anchor.cr);
  if (!unit) throw new Error(`${it.id}: no text unit for ${span.origin} @ ${it.anchor.cr}`);

  const text = cps(unit.text.normalize('NFC'));
  const exact = cps(span.exact.normalize('NFC'));
  const prefix = cps((span.prefix ?? '').normalize('NFC'));

  // Locate `exact` after `prefix`. The prefix is what disambiguates a fragment
  // that occurs more than once in the unit.
  const at = (hay, needle, from) => {
    outer: for (let i = from; i + needle.length <= hay.length; i++) {
      for (let j = 0; j < needle.length; j++) if (hay[i + j] !== needle[j]) continue outer;
      return i;
    }
    return -1;
  };

  const pAt = prefix.length ? at(text, prefix, 0) : 0;
  if (pAt < 0) throw new Error(`${it.id}: prefix not found in ${span.origin} ${it.anchor.cr}`);
  const start = at(text, exact, pAt + prefix.length);
  if (start < 0) throw new Error(`${it.id}: exact text not found after prefix in ${span.origin} ${it.anchor.cr}`);

  const end = start + exact.length;
  if (span.start !== start || span.end !== end) {
    span.start = start;
    span.end = end;
    changed++;
  }
}

writeFileSync('data/interpretations/interpretations.json', JSON.stringify(interps, null, 2) + '\n');
console.log(`resolve-spans: ${changed} span(s) updated`);
