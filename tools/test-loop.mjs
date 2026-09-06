#!/usr/bin/env node
// Tests for versioning and the evaluation loop. See docs/14-loop.md.
//
// Usage: node tools/test-loop.mjs

import { cpSync, mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compilePrompt, loadEvaluations, AREAS } from './next-prompt.mjs';
import { versionInfo } from './version.mjs';

let failed = 0;
const t = (name, fn) => {
  const dir = mkdtempSync(join(tmpdir(), 'con001-loop-'));
  try {
    cpSync('package.json', join(dir, 'package.json'));
    mkdirSync(join(dir, 'evaluations'), { recursive: true });
    fn({
      dir,
      evaluation: (file, record, prose = '# fixture\n') =>
        writeFileSync(join(dir, 'evaluations', file),
          '```json record\n' + JSON.stringify(record, null, 2) + '\n```\n\n' + prose),
    });
    console.log(`ok    ${name}`);
  } catch (e) {
    console.error(`FAIL  ${name}\n      ${e.message}`);
    failed++;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};
const assert = (c, m) => { if (!c) throw new Error(m); };

const FINDING = {
  severity: 'major',
  area: 'contestation-slider',
  observed: 'At slider 0 on gita:2.47 only Śaṅkara is shown.',
  expected: 'The diversity floor should carry one dissenting reading.',
  anchor: 'gita:2.47',
};
const EVAL = (over) => ({
  id: 'eval:001',
  ui: 'reader',
  build: '0.1.0-alpha.1+abc1234',
  reviewer: 'Fixture Reviewer',
  date: '2026-09-06',
  verdict: 'iterate',
  status: 'open',
  findings: [FINDING],
  ...over,
});

/* ---------------------------------------------------------------- version */

t('the build id changes with the commit and flags a dirty tree', () => {
  const v = versionInfo('.');
  assert(v.build.startsWith(v.version + '+'), `build id should embed the version, got ${v.build}`);
  assert(v.sha && v.sha.length >= 4, 'build id must carry a commit sha');
  assert(v.dirty === v.build.endsWith('.dirty'),
    'a dirty tree must be visible in the build id — an evaluation against it cannot be reproduced');
});

t('every built artefact can be traced to a build id', () => {
  for (const f of ['web/reader.html', 'web/status.html'])
    if (existsSync(f)) {
      const html = readFileSync(f, 'utf8');
      assert(/\d+\.\d+\.\d+/.test(html) || /built/i.test(html), `${f} carries no build stamp`);
    }
});

/* ------------------------------------------------------------- the record */

t('a finding with no `expected` is rejected as a complaint, not a finding', ({ dir, evaluation }) => {
  evaluation('001-x.md', EVAL({ findings: [{ ...FINDING, expected: '' }] }));
  const { problems } = loadEvaluations(dir);
  assert(problems.some((p) => /complaint, not a finding/.test(p)), problems.join('; '));
});

t('a finding with no `observed` is rejected', ({ dir, evaluation }) => {
  evaluation('001-x.md', EVAL({ findings: [{ ...FINDING, observed: '' }] }));
  assert(loadEvaluations(dir).problems.some((p) => /no `observed`/.test(p)));
});

t('an evaluation naming no build is rejected', ({ dir, evaluation }) => {
  evaluation('001-x.md', EVAL({ build: '' }));
  const { problems } = loadEvaluations(dir);
  assert(problems.some((p) => /cannot be reproduced/.test(p)),
    'a finding that names no build cannot be located in time');
});

t('an unknown area is rejected', ({ dir, evaluation }) => {
  evaluation('001-x.md', EVAL({ findings: [{ ...FINDING, area: 'vibes' }] }));
  assert(loadEvaluations(dir).problems.some((p) => /is not a known area/.test(p)));
});

t('every area maps to files that own it', () => {
  for (const [name, a] of Object.entries(AREAS))
    assert(Array.isArray(a.owns) && a.owns.length,
      `area "${name}" owns no files — the prompt could not say where to look`);
});

/* ------------------------------------------------------- compiled prompt */

t('an empty queue compiles to "the loop is idle", not to busywork', ({ dir }) => {
  const r = compilePrompt(dir);
  assert(!r.findings.length && /loop is idle/.test(r.text), r.text.slice(0, 120));
  assert(/not a code change/.test(r.text), 'an idle loop should say what the next move actually is');
});

t('findings compile grouped by severity, worst first', ({ dir, evaluation }) => {
  evaluation('001-x.md', EVAL({
    findings: [
      { ...FINDING, severity: 'note' },
      { ...FINDING, severity: 'blocker' },
      { ...FINDING, severity: 'minor' },
    ],
  }));
  const r = compilePrompt(dir);
  assert(r.findings.length === 3, `expected 3 findings, got ${r.findings.length}`);
  assert(r.text.indexOf('## blocker') < r.text.indexOf('## minor'), 'blockers must come first');
  assert(r.text.indexOf('## minor') < r.text.indexOf('## note'), 'severity order must hold');
});

t('a finding against an older build is marked stale', ({ dir, evaluation }) => {
  evaluation('001-x.md', EVAL({ build: '0.0.1+old' }));
  const r = compilePrompt(dir);
  assert(/were written against an older build/.test(r.text), 'stale findings must be flagged');
  assert(/no longer exists is a new bug/.test(r.text), 'and the reason must be stated');
  assert(r.findings[0].stale === true, 'the finding record must carry the stale flag');
});

t('addressed evaluations are excluded unless --all is asked for', ({ dir, evaluation }) => {
  evaluation('001-x.md', EVAL({ status: 'addressed' }));
  assert(compilePrompt(dir).findings.length === 0, 'addressed findings should not re-enter the queue');
  assert(compilePrompt(dir, { all: true }).findings.length === 1, '--all should include them');
});

t('the compiled prompt names the files that own each area', ({ dir, evaluation }) => {
  evaluation('001-x.md', EVAL({}));
  const r = compilePrompt(dir);
  for (const owned of AREAS['contestation-slider'].owns)
    assert(r.text.includes(owned), `prompt should point at ${owned}`);
});

t('the compiled prompt carries the constraints that must survive the change', ({ dir, evaluation }) => {
  evaluation('001-x.md', EVAL({}));
  const text = compilePrompt(dir).text;
  for (const rule of [
    'never rewritten or occluded',
    'never on by default',
    'diversity floor stands',
    'fork graph, never from string matching',
    'does not merge contending readings',
    'no user override',
    'never presented as scripture',
  ]) assert(text.includes(rule), `the prompt must carry: "${rule}"`);
  assert(/npm test.*must pass/s.test(text), 'the prompt must require the suite to pass');
  assert(/decision for the project lead/.test(text),
    'breaking a guardrail must escalate, not be treated as an implementation detail');
});

console.log(failed ? `\n${failed} loop test(s) failed` : `\nall loop tests pass`);
process.exit(failed ? 1 : 0);
