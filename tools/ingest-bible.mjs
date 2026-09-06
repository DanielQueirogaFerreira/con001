#!/usr/bin/env node
// Ingests a complete King James Version into the corpus.
//
//   node tools/ingest-bible.mjs            # all 66 books
//   node tools/ingest-bible.mjs --book JHN # one, for a quick check
//
// docs/09-ingestion.md is the rule this implements: sacred source text is never
// hand-entered. Text arrives from a machine-readable edition, is normalised to
// NFC once on the way in, is split by the reference system the edition asserts,
// and every unit carries the sha256 of its own characters.
//
// What this tool CANNOT do is mark a unit verified. That step is a curator
// reading the text against the printed edition and signing for it; a program
// fetching a file has not done it, and saying otherwise would make the flag
// worthless everywhere it appears. Every unit here lands `verified: false`,
// with a source line that distinguishes machine ingestion from the older
// hand-entered samples — the distinction that decides whether a reader may be
// shown the text as scripture.

import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

// filename in the source repository → USFM book code → display name.
// USFM codes are the reference system this work's CR grammar asserts
// (`bible:BOOK.chapter.verse`), so they are written down, never derived from
// the book's name.
const BOOKS = [
  ['Genesis', 'GEN'], ['Exodus', 'EXO'], ['Leviticus', 'LEV'], ['Numbers', 'NUM'],
  ['Deuteronomy', 'DEU'], ['Joshua', 'JOS'], ['Judges', 'JDG'], ['Ruth', 'RUT'],
  ['1Samuel', '1SA'], ['2Samuel', '2SA'], ['1Kings', '1KI'], ['2Kings', '2KI'],
  ['1Chronicles', '1CH'], ['2Chronicles', '2CH'], ['Ezra', 'EZR'], ['Nehemiah', 'NEH'],
  ['Esther', 'EST'], ['Job', 'JOB'], ['Psalms', 'PSA'], ['Proverbs', 'PRO'],
  ['Ecclesiastes', 'ECC'], ['SongofSolomon', 'SNG'], ['Isaiah', 'ISA'], ['Jeremiah', 'JER'],
  ['Lamentations', 'LAM'], ['Ezekiel', 'EZK'], ['Daniel', 'DAN'], ['Hosea', 'HOS'],
  ['Joel', 'JOL'], ['Amos', 'AMO'], ['Obadiah', 'OBA'], ['Jonah', 'JON'],
  ['Micah', 'MIC'], ['Nahum', 'NAM'], ['Habakkuk', 'HAB'], ['Zephaniah', 'ZEP'],
  ['Haggai', 'HAG'], ['Zechariah', 'ZEC'], ['Malachi', 'MAL'],
  ['Matthew', 'MAT'], ['Mark', 'MRK'], ['Luke', 'LUK'], ['John', 'JHN'],
  ['Acts', 'ACT'], ['Romans', 'ROM'], ['1Corinthians', '1CO'], ['2Corinthians', '2CO'],
  ['Galatians', 'GAL'], ['Ephesians', 'EPH'], ['Philippians', 'PHP'], ['Colossians', 'COL'],
  ['1Thessalonians', '1TH'], ['2Thessalonians', '2TH'], ['1Timothy', '1TI'], ['2Timothy', '2TI'],
  ['Titus', 'TIT'], ['Philemon', 'PHM'], ['Hebrews', 'HEB'], ['James', 'JAS'],
  ['1Peter', '1PE'], ['2Peter', '2PE'], ['1John', '1JN'], ['2John', '2JN'],
  ['3John', '3JN'], ['Jude', 'JUD'], ['Revelation', 'REV'],
];

const BASE = 'https://raw.githubusercontent.com/aruljohn/Bible-kjv/master';
const RETRIEVED = new Date().toISOString().slice(0, 10);
const SOURCE = `King James Version via github.com/aruljohn/Bible-kjv, retrieved ${RETRIEVED}`;
const OUT = 'data/editions/bible-kjv';

const only = (() => {
  const i = process.argv.indexOf('--book');
  return i >= 0 ? process.argv[i + 1] : null;
})();

const sha256 = (text) => createHash('sha256').update(text, 'utf8').digest('hex');

mkdirSync(OUT, { recursive: true });

let totalUnits = 0;
const index = [];

for (const [file, usfm] of BOOKS) {
  if (only && only !== usfm) continue;

  const res = await fetch(`${BASE}/${file}.json`);
  if (!res.ok) {
    console.error(`${usfm}: ${res.status} fetching ${file}.json`);
    process.exit(1);
  }
  const book = await res.json();

  // Chapter and verse numbers are stored as POSITION, not as fields: a book is
  // an array of chapters, each an array of verses. Written out per unit they
  // would be a third of the file. That is only safe while numbering is exactly
  // 1..n with nothing missing, so it is checked here rather than assumed — a
  // KJV chapter is contiguous, and a source that is not will stop the ingest
  // instead of quietly shifting every verse in the book by one.
  const chapters = [];
  book.chapters.forEach((chapter, ci) => {
    if (Number(chapter.chapter) !== ci + 1)
      throw new Error(`${usfm}: chapter ${chapter.chapter} is at position ${ci + 1}`);
    chapter.verses.forEach((verse, vi) => {
      if (Number(verse.verse) !== vi + 1)
        throw new Error(`${usfm} ${chapter.chapter}: verse ${verse.verse} is at position ${vi + 1}`);
    });
    // Normalisation happens once, here, on the way in. The stored string is
    // what span offsets are measured against, so it is never touched again.
    chapters.push(chapter.verses.map((v) => v.text.normalize('NFC')));
  });

  const count = chapters.reduce((n, c) => n + c.length, 0);

  // One checksum over the whole book, not 31,102 copies of the same field.
  // Per-unit checksums are computed on expansion (tools/corpus.mjs), from this
  // text, so every TextUnit still carries its own — while what actually needs
  // protecting on disk, the file, is covered by one digest that changes if any
  // character in any verse does.
  writeFileSync(`${OUT}/${usfm}.json`, JSON.stringify({
    type: 'BookOfEdition',
    edition: 'ed:bible.en.kjv',
    book: { usfm, name: book.book, chapters: chapters.length, units: count },
    provenance: { source: SOURCE, verified: false, sha256: sha256(JSON.stringify(chapters)) },
    chapters,
  }) + '\n');

  index.push({ usfm, name: book.book, chapters: chapters.length, units: count });
  totalUnits += count;
  const units = { length: count };
  process.stdout.write(`  ${usfm.padEnd(4)} ${String(book.book).padEnd(18)} ${String(units.length).padStart(5)} units\n`);
}

if (!only) {
  writeFileSync(`${OUT}/index.json`, JSON.stringify({
    edition: 'ed:bible.en.kjv',
    source: SOURCE,
    books: index,
    units: totalUnits,
  }, null, 1) + '\n');
}

console.log(`\n  ${index.length} book(s), ${totalUnits} units → ${OUT}/`);
console.log('  Every unit is verified: false. A curator signs for the text, not this tool.\n');
