#!/usr/bin/env node
// Checks the ingested edition against the rules it was ingested under.
//
// The failure this guards against is not a crash. It is a Bible that is one
// verse out somewhere in the middle: every reference after the shift points at
// the wrong words, every annotation anchored to it lands on the wrong text, and
// nothing anywhere reports an error.

import { readFileSync } from 'node:fs';
import { BIBLE_DIR, bookFiles, loadBook, bookUnits, bookDigest, sha256 } from './corpus.mjs';

let failures = 0;
const ok = (label, cond, detail = '') => {
  if (!cond) { failures++; console.error(`  FAIL  ${label}${detail ? ' — ' + detail : ''}`); }
  else console.log(`  ok    ${label}`);
};

const index = JSON.parse(readFileSync(`${BIBLE_DIR}/index.json`, 'utf8'));
const files = bookFiles();

ok('all 66 books are present', files.length === 66, `${files.length} files`);

let total = 0;
let digestsGood = true, contiguous = true, textGood = true;
const seen = new Set();
let collision = '';

for (const f of files) {
  const book = loadBook(f);
  if (bookDigest(book) !== book.provenance.sha256) { digestsGood = false; console.error(`    ${f}`); }
  if (book.chapters.length !== book.book.chapters) contiguous = false;

  let n = 0;
  for (const u of bookUnits(book)) {
    n++;
    if (!u.text.trim() || u.text !== u.text.normalize('NFC')) textGood = false;
    if (u.provenance.sha256 !== sha256(u.text)) textGood = false;
    if (seen.has(u.cr)) collision ||= u.cr;
    seen.add(u.cr);
  }
  if (n !== book.book.units) contiguous = false;
  total += n;
}

ok('every book file matches its own checksum', digestsGood,
  'a stored digest disagrees with the text it covers');
ok('every book reports the number of units it holds', contiguous);
ok('no two units share a canonical reference', !collision, collision);
ok('every unit is NFC and carries its own checksum', textGood);

// 31,102 is the verse count of the King James canon. A change here is either a
// different edition or a broken ingest, and both need a person to look.
ok('the edition holds the canonical 31,102 verses', total === 31102, String(total));
ok('the index agrees with the books on disk', index.units === total && index.books.length === files.length);

// The sample units that predate the ingestion were typed by hand. Where the two
// overlap they must agree, character for character.
const samples = JSON.parse(readFileSync('data/editions/text-units.json', 'utf8'));
const list = samples.text_units ?? samples;
const byCr = new Map();
for (const f of files) for (const u of bookUnits(loadBook(f))) byCr.set(u.cr, u);
let mismatch = '';
for (const s of list) {
  if (s.edition !== 'ed:bible.en.kjv') continue;
  const ingested = byCr.get(s.cr);
  if (ingested && ingested.text !== s.text) mismatch ||= s.cr;
}
ok('the hand-entered samples agree with the ingested text', !mismatch, mismatch);

console.log(failures ? `\n  ${failures} problem(s) in the ingested corpus.\n` : `\n  ${total} units verified structurally.\n`);
process.exit(failures ? 1 : 0);
