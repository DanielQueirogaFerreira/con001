#!/usr/bin/env node
// Reads advisory/rfc/*.md and answers one question: is this claim cleared, and
// by whom? See advisory/README.md.
//
// A claim never carries its own approval. It carries a REFERENCE to a record
// anyone can open and read. An approval you cannot read is not an approval.
//
//   node tools/advisory.mjs                       report
//   node tools/advisory.mjs --verify-signatures   also check the recorded commits

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

export const CREDENTIAL_TYPES = ['orcid', 'institution', 'monastic', 'clerical', 'community'];
export const DECISIONS = ['approve', 'approve-with-changes', 'object'];
const PLACEHOLDER = /pending|tbd|todo|placeholder/i;

// One markdown file per RFC: the human argument is the document, the
// machine-readable record is a fenced ```json record block. One file, so the
// two cannot drift apart.
const RECORD = /```json record\s*\n([\s\S]*?)```/;

export function loadAdvisory(root = '.') {
  const dir = join(root, 'advisory/rfc');
  const rfcs = [];
  const problems = [];

  if (existsSync(dir)) {
    for (const f of readdirSync(dir).sort()) {
      if (!f.endsWith('.md') || f === 'TEMPLATE.md') continue;
      const raw = readFileSync(join(dir, f), 'utf8');
      const m = raw.match(RECORD);
      if (!m) { problems.push(`${f}: no \`\`\`json record block`); continue; }
      let rec;
      try { rec = JSON.parse(m[1]); } catch (e) { problems.push(`${f}: record is not valid JSON — ${e.message}`); continue; }
      rec._file = `advisory/rfc/${f}`;
      rfcs.push(rec);
    }
  }

  const byId = new Map(rfcs.map((r) => [r.id, r]));

  for (const r of rfcs) {
    const at = (m) => problems.push(`${r._file}: ${m}`);
    if (!/^rfc:\d{3,}$/.test(r.id ?? '')) at(`id "${r.id}" must look like rfc:001`);
    if (!Array.isArray(r.targets) || !r.targets.length) at('no targets — an RFC must say what it clears');
    if (!Array.isArray(r.seats_required) || !r.seats_required.length) at('no seats_required');
    if (!['open', 'approved', 'rejected', 'withdrawn'].includes(r.status)) at(`bad status "${r.status}"`);

    for (const s of r.signoffs ?? []) {
      const who = s.reviewer ?? '(unnamed)';
      if (!s.reviewer || PLACEHOLDER.test(s.reviewer)) at(`sign-off by "${who}": reviewer must be a named person`);
      if (!r.seats_required.includes(s.seat)) at(`sign-off by ${who}: seat "${s.seat}" is not required by this RFC`);
      if (!DECISIONS.includes(s.decision)) at(`sign-off by ${who}: decision must be one of ${DECISIONS.join(', ')}`);
      const c = s.credential ?? {};
      if (!CREDENTIAL_TYPES.includes(c.type)) at(`sign-off by ${who}: credential.type must be one of ${CREDENTIAL_TYPES.join(', ')}`);
      if (!c.value || PLACEHOLDER.test(c.value)) at(`sign-off by ${who}: credential.value is empty or a placeholder`);
      // A credential nobody checked is a claim in a text field, not a credential.
      if (!c.verified_by || PLACEHOLDER.test(c.verified_by)) at(`sign-off by ${who}: credential was not verified by anyone`);
      if (!c.verified_on) at(`sign-off by ${who}: credential has no verification date`);
      if (!/^[0-9a-f]{7,40}$/.test(s.commit ?? '')) at(`sign-off by ${who}: no commit SHA recorded`);
      if (!s.fingerprint || PLACEHOLDER.test(s.fingerprint)) at(`sign-off by ${who}: no signing key fingerprint recorded`);
    }

    // status: approved is a CLAIM about the sign-offs, and must be true.
    if (r.status === 'approved') {
      const v = seatsSatisfied(r);
      if (!v.ok) at(`status is "approved" but ${v.why}`);
    }
  }

  // Which seats have cleared, and does an objection stand?
  function seatsSatisfied(r) {
    const objections = (r.signoffs ?? []).filter((s) => s.decision === 'object');
    if (objections.length)
      return { ok: false, why: `an objection stands from ${objections.map((o) => o.reviewer).join(', ')}` };
    const cleared = new Set(
      (r.signoffs ?? []).filter((s) => s.decision !== 'object').map((s) => s.seat)
    );
    const missing = r.seats_required.filter((s) => !cleared.has(s));
    if (missing.length) return { ok: false, why: `seat(s) not filled: ${missing.join(', ')}` };
    return { ok: true };
  }

  // The gate. `ref` is whatever appeared in reviewed_by / signed_off_by.
  function clearance(ref, targetId, seatsNeeded = []) {
    if (typeof ref !== 'string' || PLACEHOLDER.test(ref))
      return { ok: false, why: `"${ref}" is a placeholder, not a sign-off` };
    const r = byId.get(ref);
    if (!r) return { ok: false, why: `"${ref}" does not name an RFC in advisory/rfc/` };
    if (r.status !== 'approved') return { ok: false, why: `${ref} is "${r.status}", not approved` };
    if (!r.targets.includes(targetId)) return { ok: false, why: `${ref} does not cover ${targetId}` };
    const missing = seatsNeeded.filter((s) => !r.seats_required.includes(s));
    if (missing.length) return { ok: false, why: `${ref} does not carry the ${missing.join(' + ')} seat(s)` };
    const v = seatsSatisfied(r);
    if (!v.ok) return { ok: false, why: `${ref}: ${v.why}` };
    return { ok: true, rfc: r };
  }

  // Signature checking needs the reviewer's public key in the local keyring.
  // Where it cannot verify, it says so and never silently passes.
  function verifySignatures(root2 = root) {
    const out = [];
    for (const r of rfcs)
      for (const s of r.signoffs ?? []) {
        let state = 'unverified', detail = '';
        try {
          execFileSync('git', ['verify-commit', s.commit], { cwd: root2, stdio: ['ignore', 'pipe', 'pipe'] });
          state = 'good';
        } catch (e) {
          const err = `${e.stderr ?? ''}`;
          detail = /not found|bad object|unknown revision/i.test(err)
            ? 'commit not in this repository'
            : 'no valid signature, or the signing key is not in this keyring';
        }
        out.push({ rfc: r.id, reviewer: s.reviewer, commit: s.commit, state, detail });
      }
    return out;
  }

  return { rfcs, byId, problems, clearance, seatsSatisfied, verifySignatures };
}

/* ------------------------------------------------------------------ report */

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const a = loadAdvisory('.');
  console.log('\nADVISORY RECORDS\n');
  if (!a.rfcs.length) console.log('  none');
  for (const r of a.rfcs) {
    const v = a.seatsSatisfied(r);
    console.log(`  ${r.id}  ${r.status.toUpperCase().padEnd(10)} ${r.title}`);
    console.log(`         seats: ${r.seats_required.join(' + ')} — ${v.ok ? 'all cleared' : v.why}`);
    console.log(`         covers: ${r.targets.join(', ')}`);
    console.log(`         ${r._file}\n`);
  }

  if (process.argv.includes('--verify-signatures')) {
    const sigs = a.verifySignatures();
    console.log('SIGNATURES\n');
    if (!sigs.length) console.log('  no sign-offs recorded yet\n');
    for (const s of sigs)
      console.log(`  ${s.state.padEnd(11)} ${s.rfc}  ${s.reviewer}  ${s.commit}${s.detail ? ' — ' + s.detail : ''}`);
    console.log('');
  }

  if (a.problems.length) {
    console.error(`ADVISORY RECORDS INVALID — ${a.problems.length} problem(s)\n`);
    for (const p of a.problems) console.error('  ' + p);
    process.exit(1);
  }
  console.log(`  ${a.rfcs.length} RFC(s), ${a.rfcs.filter((r) => r.status === 'approved').length} approved\n`);
}
