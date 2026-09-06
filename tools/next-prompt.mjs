#!/usr/bin/env node
// Closes the loop: team evaluations of a UI build become the prompt for the
// next iteration.
//
//   prompt to LLM ─▶ UI build ─▶ team evaluation ─▶ compiled prompt ─┐
//        ▲                                                            │
//        └────────────────────────────────────────────────────────────┘
//
// The value is not in restating what people wrote. It is in attaching each
// finding to the FILES THAT OWN IT and to the BUILD IT WAS SEEN ON, so the next
// iteration starts from a located problem rather than an impression.
//
//   node tools/next-prompt.mjs            compile open findings
//   node tools/next-prompt.mjs --all      include addressed and wontfix

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { versionInfo } from './version.mjs';

const RECORD = /```json record\s*\n([\s\S]*?)```/;

export const AREAS = {
  'text-pane': {
    owns: ['tools/build-reader.mjs → renderText()', 'data/editions/text-units.json', 'docs/01-anchoring.md'],
    note: 'Span highlighting, edition stacking, RTL, the unverified badge.',
  },
  'layer-stack': {
    owns: ['tools/build-reader.mjs → renderStack(), renderGlosses()', 'data/layers/layers.json', 'docs/02-layers.md'],
    note: 'Layer toggles, machine-layer distinctness, canonical weight display.',
  },
  'contestation-slider': {
    owns: ['tools/build-reader.mjs → visible()', 'tools/salience.mjs', 'docs/06-salience.md'],
    note: 'The diversity floor lives here. Changing it can silence a minority reading — check tools/test-salience.mjs before touching.',
  },
  'director-lens': {
    owns: ['tools/build-reader.mjs → renderDirector()', 'data/layers/layers.json → direction', 'docs/12-reader-prototype.md'],
    note: 'Conflicts come from the fork graph, never from wording. Keep it that way.',
  },
  studio: {
    owns: ['tools/prompt-compiler.mjs', 'tools/build-reader.mjs → renderStudio()', 'docs/13-studio-compiler.md'],
    note: 'The refusal to merge contending readings is the point of this module, not a limitation to fix.',
  },
  'status-page': {
    owns: ['tools/build-status.mjs', 'docs/14-loop.md'],
    note: 'Generated from repo state. Never hand-maintain a number here.',
  },
  general: {
    owns: ['README.md', 'docs/'],
    note: '',
  },
};

const SEVERITIES = ['blocker', 'major', 'minor', 'note'];
const VERDICTS = ['ship', 'iterate', 'block'];
const STATUSES = ['open', 'addressed', 'wontfix'];

export function loadEvaluations(root = '.') {
  const dir = join(root, 'evaluations');
  const evals = [];
  const problems = [];

  if (existsSync(dir)) {
    for (const f of readdirSync(dir).sort()) {
      if (!f.endsWith('.md') || f === 'TEMPLATE.md' || f === 'README.md') continue;
      const raw = readFileSync(join(dir, f), 'utf8');
      const m = raw.match(RECORD);
      if (!m) { problems.push(`${f}: no \`\`\`json record block`); continue; }
      let rec;
      try { rec = JSON.parse(m[1]); } catch (e) { problems.push(`${f}: record is not valid JSON — ${e.message}`); continue; }
      rec._file = `evaluations/${f}`;
      rec._prose = raw.slice(m.index + m[0].length).trim();
      evals.push(rec);
    }
  }

  for (const e of evals) {
    const at = (msg) => problems.push(`${e._file}: ${msg}`);
    if (!/^eval:\d{3,}$/.test(e.id ?? '')) at(`id "${e.id}" must look like eval:001`);
    if (!e.build) at('no build id — a finding that names no build cannot be reproduced');
    if (!e.reviewer) at('no reviewer — findings are attributed to a person, not a role');
    if (!VERDICTS.includes(e.verdict)) at(`verdict must be one of ${VERDICTS.join(', ')}`);
    if (!STATUSES.includes(e.status)) at(`status must be one of ${STATUSES.join(', ')}`);
    for (const f of e.findings ?? []) {
      if (!SEVERITIES.includes(f.severity)) at(`severity "${f.severity}" is not one of ${SEVERITIES.join(', ')}`);
      if (!AREAS[f.area]) at(`area "${f.area}" is not a known area (${Object.keys(AREAS).join(', ')})`);
      // Both halves are required. "It feels wrong" is not a finding.
      if (!f.observed) at('a finding with no `observed` cannot be acted on');
      if (!f.expected) at('a finding with no `expected` is a complaint, not a finding');
    }
  }

  return { evals, problems };
}

export function compilePrompt(root = '.', { all = false } = {}) {
  const { evals, problems } = loadEvaluations(root);
  const v = versionInfo(root);
  const wanted = all ? evals : evals.filter((e) => e.status === 'open');

  const findings = [];
  for (const e of wanted)
    for (const f of e.findings ?? [])
      findings.push({ ...f, from: e.reviewer, build: e.build, ui: e.ui, file: e._file, stale: e.build !== v.build });

  findings.sort((a, b) => SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity));

  const areasTouched = [...new Set(findings.map((f) => f.area))];
  const stale = findings.filter((f) => f.stale);

  const lines = [];
  lines.push(`# Next iteration — compiled from ${wanted.length} evaluation(s), ${findings.length} finding(s)`);
  lines.push('');
  lines.push(`Current build: **${v.build}** (${v.branch}${v.dirty ? ', uncommitted changes' : ''})`);
  lines.push('');

  if (!findings.length) {
    lines.push('No open findings. The loop is idle — the next move is a UI build put in front of a');
    lines.push('team member, not a code change.');
    return { text: lines.join('\n'), findings, problems, version: v };
  }

  if (stale.length) {
    lines.push(`> **${stale.length} finding(s) were written against an older build.** They may already be`);
    lines.push('> fixed. Reproduce each on the current build before changing anything — a fix for a');
    lines.push('> problem that no longer exists is a new bug.');
    lines.push('');
  }

  for (const sev of SEVERITIES) {
    const group = findings.filter((f) => f.severity === sev);
    if (!group.length) continue;
    lines.push(`## ${sev} (${group.length})`);
    lines.push('');
    for (const f of group) {
      lines.push(`### ${f.area}${f.anchor ? ` @ ${f.anchor}` : ''}`);
      lines.push(`- **observed:** ${f.observed}`);
      lines.push(`- **expected:** ${f.expected}`);
      lines.push(`- reported by ${f.from} on ${f.ui} ${f.build}${f.stale ? ' — **stale**' : ''} (${f.file})`);
      lines.push('');
    }
  }

  lines.push('## Where these live');
  lines.push('');
  for (const a of areasTouched) {
    lines.push(`**${a}**`);
    for (const o of AREAS[a].owns) lines.push(`- \`${o}\``);
    if (AREAS[a].note) lines.push(`- _${AREAS[a].note}_`);
    lines.push('');
  }

  // Constraints travel with the prompt. An iteration prompt that omits them is
  // how a guardrail gets removed by accident three cycles later.
  lines.push('## Constraints that hold regardless of what the findings ask for');
  lines.push('');
  lines.push('- The base text is never rewritten or occluded by a layer.');
  lines.push('- Machine-authored content never occupies the register of the tradition, and is never on by default.');
  lines.push('- The diversity floor stands: above slider zero, a reading from outside the leading stance is always carried.');
  lines.push('- Director-lens conflicts come from the fork graph, never from string matching.');
  lines.push('- The prompt compiler does not merge contending readings.');
  lines.push('- Corpus hard blocks run before generation and have no user override.');
  lines.push('- Unverified text units are never presented as scripture.');
  lines.push('');
  lines.push('`npm test` must pass. If a finding requires breaking one of the above, say so and stop —');
  lines.push('that is a decision for the project lead, not an implementation detail.');

  return { text: lines.join('\n'), findings, problems, version: v };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const r = compilePrompt('.', { all: process.argv.includes('--all') });
  if (r.problems.length) {
    console.error(`EVALUATION RECORDS INVALID — ${r.problems.length} problem(s)\n`);
    for (const p of r.problems) console.error('  ' + p);
    process.exit(1);
  }
  console.log(r.text);
}
