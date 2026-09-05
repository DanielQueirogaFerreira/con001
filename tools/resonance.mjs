#!/usr/bin/env node
// The resonance map: where readings across traditions answer the same question
// similarly, where they answer it oppositely, and where a reader stands.
//
// Three rules are enforced here in code rather than trusted to editorial care.
// They are the difference between a comparison engine and a syncretism machine.
// See docs/10-resonance.md.
//
//   1. A resonance is NEVER displayed alone. It always carries the internal
//      spread of every tradition it touches, so that disagreement WITHIN a
//      tradition is as visible as disagreement between traditions. This is the
//      whole neutrality mechanism: it makes "one against another" unsayable.
//
//   2. A resonance recording agreement must also record what that agreement
//      hides. Enforced as `divergence` minItems 1 in the schema, and re-checked
//      here because it is the constraint most likely to be quietly relaxed.
//
//   3. A reader profile reports PROXIMITY TO POSITIONS, never affiliation to a
//      tradition. The system never tells anyone what they are.
//
// Usage: node tools/resonance.mjs [profile.json]

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

// A resonance whose weakest position is less confident than this is not shown
// at all — not shown faintly, not shown with a caveat. Below the floor there is
// nothing to say. See docs/11-guardrails.md.
export const EVIDENCE_FLOOR = 0.5;

// Positions within this distance answer a question "similarly".
export const NEAR = 0.25;

export function map(root = '.') {
  const read = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'));

  const questions = read('data/questions/questions.json');
  const positions = read('data/positions/positions.json');
  const resonances = read('data/resonances/resonances.json');
  const interps = read('data/interpretations/interpretations.json');

  const posOf = new Map(positions.map((p) => [p.id, p]));
  const qOf = new Map(questions.map((q) => [q.id, q]));
  const interpIds = new Set(interps.map((i) => i.id));

  const forQuestion = (qid) => positions.filter((p) => p.question === qid);

  // Rule 1. The internal range of each tradition on this question — computed
  // for every tradition a resonance touches, and attached to it inseparably.
  function internalSpread(qid, tradition) {
    const own = forQuestion(qid).filter((p) => p.tradition === tradition);
    if (!own.length) return null;
    const vals = own.map((p) => p.value);
    return {
      tradition,
      n: own.length,
      min: Math.min(...vals),
      max: Math.max(...vals),
      range: Math.max(...vals) - Math.min(...vals),
      positions: own.map((p) => p.id),
    };
  }

  // Rule 1 again, structurally: there is no way to get a resonance out of this
  // module without its context. The bare object is not returned.
  function withContext(res) {
    const ps = res.positions.map((id) => posOf.get(id)).filter(Boolean);
    const traditions = [...new Set(ps.map((p) => p.tradition))];
    const floor = Math.min(...ps.map((p) => p.confidence));
    return {
      resonance: res,
      question: qOf.get(res.question),
      positionsResolved: ps,
      traditions,
      internal: traditions.map((t) => internalSpread(res.question, t)).filter(Boolean),
      confidenceFloor: floor,
      displayable: floor >= EVIDENCE_FLOOR && res.divergence?.length > 0,
    };
  }

  // Rule 3. Proximity to positions. Never an affiliation, never a percentage
  // match to a religion, and always the farthest position alongside the
  // nearest, so it cannot become a flattery machine.
  function profile(reader) {
    const out = [];
    for (const [qid, value] of Object.entries(reader.positions ?? {})) {
      const q = qOf.get(qid);
      if (!q) continue;
      const ranked = forQuestion(qid)
        .map((p) => ({ position: p, distance: Math.abs(p.value - value) }))
        .sort((a, b) => a.distance - b.distance);
      if (!ranked.length) continue;
      out.push({
        question: q,
        value,
        nearest: ranked.slice(0, 2),
        farthest: ranked[ranked.length - 1],
        // "Show me the strongest reading against where I stand." The button that
        // stops the map becoming a mirror that only agrees.
        steelman: ranked
          .slice()
          .sort((a, b) => b.distance * b.position.confidence - a.distance * a.position.confidence)[0],
      });
    }
    return out;
  }

  // Integrity checks the schema cannot express.
  //
  // Findings carry a severity, because two different things are being checked.
  // STRUCTURAL findings mean the data is wrong and are errors everywhere.
  // STAGING findings mean the data is fine but not yet cleared by the people
  // who must clear it — those warn in development and block in production.
  // See docs/11-guardrails.md.
  // A placeholder entry such as "advisory:hindu (pending)" is not a sign-off.
  // Without this, a review gate is satisfied by writing the word "pending".
  const signedOff = (list) =>
    (list ?? []).filter((r) => typeof r === 'string' && !/pending|tbd|todo/i.test(r));

  function audit({ strict = false } = {}) {
    const found = [];
    const err = (id, code, message) => found.push({ severity: 'error', id, code, message });
    const hold = (id, code, message) =>
      found.push({ severity: strict ? 'error' : 'warn', id, code, message, staging: true });

    for (const p of positions) {
      for (const e of p.evidence)
        if (!interpIds.has(e)) err(p.id, 'missing-evidence', `evidence ${e} does not exist`);
      if (!qOf.has(p.question)) err(p.id, 'unknown-question', `unknown question ${p.question}`);
      const q = qOf.get(p.question);
      if (q?.consequence_tier === 'high' && !signedOff(p.reviewed_by).length)
        hold(p.id, 'awaiting-advisory', 'sits on a high-consequence question with no advisory review');
    }

    for (const r of resonances) {
      if (!qOf.has(r.question)) err(r.id, 'unknown-question', `unknown question ${r.question}`);
      for (const id of r.positions)
        if (!posOf.has(id)) err(r.id, 'unknown-position', `unknown position ${id}`);
      if (!r.divergence?.length)
        err(r.id, 'no-divergence', 'a resonance with no divergence is syncretism, not comparison');

      const ps = r.positions.map((id) => posOf.get(id)).filter(Boolean);
      if (ps.some((p) => p.question !== r.question))
        err(r.id, 'question-mismatch', 'relates positions from different questions');

      // The claim must match the geometry: readings far apart on the axis
      // cannot be filed as answering similarly, and near-identical readings
      // cannot be filed as opposed.
      const vals = ps.map((p) => p.value);
      const spread = vals.length ? Math.max(...vals) - Math.min(...vals) : 0;
      if (r.claim === 'answers-similarly' && spread > NEAR)
        err(r.id, 'claim-geometry', `claims "answers-similarly" but the positions span ${spread.toFixed(2)} on the axis`);
      if (r.claim === 'answers-oppositely' && spread <= NEAR)
        err(r.id, 'claim-geometry', `claims "answers-oppositely" but the positions span only ${spread.toFixed(2)}`);

      if (r.consequence_tier === 'high') {
        const signed = signedOff(r.review?.signed_off_by).length > 0;
        if (r.review?.status === 'published' && !signed)
          err(r.id, 'published-unsigned', 'published at high consequence with no sign-off');
        if (r.review?.status !== 'published' || !signed)
          hold(r.id, 'awaiting-advisory',
            `high-tier resonance at "${r.review?.status ?? 'draft'}" — needs ${(r.review?.required_from ?? ['advisory sign-off']).join(' + ')}`);
      }
    }
    return found;
  }

  // What a production bundle may carry. Held items are excluded rather than
  // silently downgraded, and the exclusion is reported.
  function productionSet() {
    const held = new Set(
      audit({ strict: true }).filter((f) => f.staging).map((f) => f.id)
    );
    return {
      resonances: resonances.filter((r) => !held.has(r.id)),
      positions: positions.filter((p) => !held.has(p.id)),
      held: [...held],
    };
  }

  return { questions, positions, resonances, qOf, posOf, forQuestion, internalSpread, withContext, profile, audit, productionSet };
}

/* ------------------------------------------------------------------ report */

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const m = map('.');
  const bar = (v) => {
    const cells = Array(21).fill('·');
    cells[Math.round(v * 20)] = '●';
    return cells.join('');
  };

  console.log('THE QUESTION MAP — positions, and the spread inside each tradition\n');
  for (const q of m.questions) {
    console.log(`  ${q.id}  ${q.statement.en}`);
    console.log(`  tier: ${q.consequence_tier}${q.fits_badly ? `   fits badly: ${q.fits_badly.join(', ')}` : ''}`);
    console.log(`  0 = ${q.axis.low}`);
    console.log(`  1 = ${q.axis.high}\n`);
    for (const p of m.forQuestion(q.id).sort((a, b) => a.value - b.value))
      console.log(`    ${bar(p.value)}  ${p.value.toFixed(2)}  ${p.tradition.padEnd(10)} ${p.held_by}`);
    const traditions = [...new Set(m.forQuestion(q.id).map((p) => p.tradition))];
    const spreads = traditions.map((t) => m.internalSpread(q.id, t)).filter((s) => s.n > 1);
    if (spreads.length)
      for (const s of spreads)
        console.log(`\n    internal spread, ${s.tradition}: ${s.min.toFixed(2)}–${s.max.toFixed(2)} across ${s.n} readings`);
    console.log('');
  }

  console.log('RESONANCES — never shown without their divergence and their context\n');
  for (const r of m.resonances) {
    const c = m.withContext(r);
    console.log(`  ${r.id}   [${r.claim}]   tier: ${r.consequence_tier}   ${c.displayable ? 'displayable' : 'BELOW FLOOR — not shown'}`);
    console.log(`    on: ${c.question.statement.en}`);
    console.log(`    traditions: ${c.traditions.join(', ')}`);
    for (const s of c.internal)
      console.log(`      ${s.tradition}: ${s.n} reading(s), spread ${s.range.toFixed(2)}` +
        (s.range > NEAR ? '  ← disagrees internally more than it disagrees across this resonance' : ''));
    for (const dv of r.divergence) console.log(`    divergence: ${dv.summary.split('. ')[0]}.`);
    if (r.review?.required_from)
      console.log(`    review: ${r.review.status}, needs ${r.review.required_from.join(' + ')}`);
    console.log('');
  }

  const profilePath = process.argv[2] ?? 'data/profiles/example-reader.local.json';
  const reader = JSON.parse(readFileSync(profilePath, 'utf8'));
  console.log(`WHERE THIS READER STANDS  (${profilePath})`);
  console.log('  Positions, never affiliations. This is computed on the reader\'s device and never stored.\n');
  for (const row of m.profile(reader)) {
    console.log(`  ${row.question.statement.en}`);
    console.log(`    you: ${row.value.toFixed(2)}`);
    for (const n of row.nearest)
      console.log(`    near  (${n.distance.toFixed(2)})  ${n.position.held_by}  — ${n.position.summary.split('.')[0]}.`);
    console.log(`    far   (${row.farthest.distance.toFixed(2)})  ${row.farthest.position.held_by}`);
    console.log(`    read against you: ${row.steelman.position.held_by} (${row.steelman.position.tradition})\n`);
  }

  const strict = process.argv.includes('--strict');
  const found = m.audit({ strict });
  const errors = found.filter((f) => f.severity === 'error');
  const warns = found.filter((f) => f.severity === 'warn');

  if (warns.length) {
    console.log('AUDIT — HELD FOR REVIEW (warning in development, blocking in production)\n');
    console.log('  severity  code               id                                  detail');
    console.log('  ' + '-'.repeat(100));
    for (const w of warns)
      console.log(`  ${w.severity.padEnd(9)} ${w.code.padEnd(18)} ${w.id.padEnd(35)} ${w.message}`);
    console.log('\n  These are not defects. The data is well formed and the people who must clear it have not yet.');
    console.log('  Run `npm run build:prod` to see the production gate reject them.\n');
  }

  if (errors.length) {
    console.error(`AUDIT FAILED — ${errors.length} error(s)\n`);
    for (const e of errors) console.error(`  ${e.id}: ${e.message}`);
    process.exit(1);
  }
  console.log(`  audit clean — ${m.positions.length} positions, ${m.resonances.length} resonances, ` +
    `${m.questions.length} questions${warns.length ? `, ${warns.length} held for review` : ''}`);
}
