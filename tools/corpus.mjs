// Expands a stored book of an edition into TextUnits.
//
// Books are stored compactly — chapter and verse numbers are position, and one
// provenance block covers the file — because 31,102 copies of the same source
// string and type name is three quarters of a Bible. The canonical form is
// still the TextUnit; this is the one place that turns one into the other, so
// nothing downstream has to know how the file is shaped.

import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';

export const sha256 = (text) => createHash('sha256').update(text, 'utf8').digest('hex');

export const BIBLE_DIR = 'data/editions/bible-kjv';

export const loadBook = (path) => JSON.parse(readFileSync(path, 'utf8'));

export const bookFiles = (dir = BIBLE_DIR) =>
  readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'index.json').map((f) => `${dir}/${f}`);

/** The digest the file claims, recomputed. A single character changes it. */
export const bookDigest = (book) => sha256(JSON.stringify(book.chapters));

/**
 * TextUnits, in reading order. Each carries its own sha256, computed here from
 * the stored text — so a unit satisfies the same contract as a hand-curated one
 * (docs/09-ingestion.md) without the file repeating the field 31,102 times.
 */
export function* bookUnits(book) {
  const { usfm } = book.book;
  for (let c = 0; c < book.chapters.length; c++) {
    for (let v = 0; v < book.chapters[c].length; v++) {
      const text = book.chapters[c][v];
      yield {
        type: 'TextUnit',
        edition: book.edition,
        cr: `bible:${usfm}.${c + 1}.${v + 1}`,
        label: `${c + 1}:${v + 1}`,
        text,
        provenance: { ...book.provenance, sha256: sha256(text) },
      };
    }
  }
}

/** Every unit of every stored book, for tools that want the whole edition. */
export function* allUnits(dir = BIBLE_DIR) {
  for (const f of bookFiles(dir)) yield* bookUnits(loadBook(f));
}
