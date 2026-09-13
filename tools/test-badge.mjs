#!/usr/bin/env node
// The build badge. Small, shown on every page, and broken twice already — once rendering
// `2026-09-12T06:06:33ZZ`, once showing no milliseconds at all. Both were visible on every
// screen in the product and neither was visible to anything that ran.

import { isoMs, age, badgeHtml, AGE_SCALES } from './badge.mjs';

let failures = 0;
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };
const t = (name, fn) => {
  try { fn(); console.log(`  ok    ${name}`); }
  catch (e) { failures++; console.error(`  FAIL  ${name}\n        ${e.message}`); }
};

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

t('every timestamp ends in exactly one Z, whatever went in', () => {
  // The `+00:00` form is what git hands back, the `Z` form is what a fallback clock hands
  // back, and the second one produced ZZ for as long as the badge existed.
  for (const input of [
    '2026-09-12T06:06:33+00:00',
    '2026-09-12T06:06:33Z',
    '2026-09-12T06:06:33.456Z',
    '2026-09-12T06:06:33-03:00',
    new Date(1789193193000),
  ]) {
    const out = isoMs(input);
    assert(ISO.test(out), `"${input}" rendered as "${out}"`);
    assert(!out.includes('ZZ'), `"${input}" produced a double Z`);
  }
});

t('the milliseconds are always there, even when the source has none', () => {
  assert(isoMs('2026-09-12T06:06:33+00:00').endsWith('.000Z'),
    'a whole-second stamp must still show its milliseconds');
  assert(isoMs('2026-09-12T06:06:33.456Z').endsWith('.456Z'),
    'real milliseconds must survive');
});

t('an unparseable timestamp renders as nothing, not as "Invalid Date"', () => {
  assert(isoMs('not a date') === '', `got "${isoMs('not a date')}"`);
  assert(isoMs(undefined) === '', 'undefined must not reach the page');
});

const S = 1000, M = 60 * S, H = 60 * M, D = 24 * H;

t('age keeps two digits by changing scale', () => {
  const cases = [
    [0, '00s'], [5 * S, '05s'], [59 * S, '59s'],
    [60 * S, '01m'], [59 * M + 59 * S, '59m'],
    [60 * M, '01h'], [23 * H, '23h'],
    [24 * H, '01d'], [6 * D, '06d'],
    [7 * D, '01w'], [27 * D, '03w'],
    [45 * D, '01M'], [300 * D, '09M'],
    [400 * D, '01y'], [4000 * D, '10y'],
  ];
  for (const [ms, want] of cases) {
    const got = age(ms);
    assert(got === want, `${ms}ms → ${got}, expected ${want}`);
  }
});

t('age is three characters at every scale a deployment reaches', () => {
  // The line must not reflow as a build gets older, which is the whole reason for scaling.
  for (let ms = 0; ms < 40 * 365 * D; ms = Math.ceil(ms * 1.05) + 997) {
    const got = age(ms);
    assert(got.length === 3, `${ms}ms rendered as "${got}", which is ${got.length} characters`);
  }
});

t('age never runs backwards or reports a negative', () => {
  assert(age(-5000) === '00s', `a clock behind the build gave ${age(-5000)}`);
  assert(age(NaN) === '00s', 'a missing build time must not render NaN');
  let previous = -1;
  for (const [, size] of AGE_SCALES) {
    assert(size > previous, 'the scales must be ordered smallest first');
    previous = size;
  }
});

t('the badge carries the build as an epoch, for the live age to count from', () => {
  const html = badgeHtml({ short: '0.1.0a1·abc1234', built: '2026-09-12T06:06:33+00:00', area: 'reader' });
  assert(html.includes('data-built="1789193193000"'), 'the epoch must be in the markup');
  assert(html.includes('2026-09-12T06:06:33.000Z'), 'the readable stamp must be there too');
  assert(!html.includes('ZZ'), 'the rendered badge contains a double Z');
  assert(html.includes('id="ohBadgeAge"') && html.includes('id="ohBadgeNow"'),
    'the live fields must exist for the script to fill');
});

t('a badge with no usable build time still renders', () => {
  const html = badgeHtml({ short: 'dev', built: '', area: 'reader' });
  assert(html.includes('data-built=""'), 'an unknown build time must be empty, not NaN');
  assert(!html.includes('NaN') && !html.includes('Invalid'), 'the page must not show NaN');
});

console.log(failures ? `\n  ${failures} failure(s)\n` : '\n  badge: all checks pass\n');
process.exit(failures ? 1 : 0);
