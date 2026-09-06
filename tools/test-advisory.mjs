#!/usr/bin/env node
// Tests for the advisory sign-off gate. See advisory/README.md.
//
// NOTE ON THE FIXTURES BELOW. The approved-path tests build an RFC with
// invented reviewers, in a scratch directory, inside this test file. They are
// never written into advisory/ and never reach the corpus. Fabricating a named
// scholar with an ORCID approving a doctrinal claim is exactly the failure this
// project exists to prevent — so the demonstration lives here, where it is
// obviously a fixture, and the real RFC 001 stays open with zero sign-offs.
//
// Usage: node tools/test-advisory.mjs

import { cpSync, mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadAdvisory } from './advisory.mjs';
import { map } from './resonance.mjs';

let failed = 0;
const t = (name, fn) => {
  const dir = mkdtempSync(join(tmpdir(), 'con001-adv-'));
  try {
    cpSync('data', join(dir, 'data'), { recursive: true });
    cpSync('advisory', join(dir, 'advisory'), { recursive: true });
    fn({
      dir,
      // Write an RFC into the scratch copy.
      rfc: (name2, record, body = '# fixture\n') =>
        writeFileSync(join(dir, 'advisory/rfc', name2),
          '```json record\n' + JSON.stringify(record, null, 2) + '\n```\n\n' + body),
      patch: (file, f) => {
        const p = join(dir, file);
        writeFileSync(p, JSON.stringify(f(JSON.parse(readFileSync(p, 'utf8'))), null, 2));
      },
      adv: () => loadAdvisory(dir),
      res: () => map(dir),
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

// A complete, well-formed sign-off. Invented for testing only.
const signoff = (seat, reviewer) => ({
  reviewer,
  seat,
  credential: {
    type: 'institution',
    value: 'FIXTURE — not a real post',
    verified_by: 'fixture curator',
    verified_on: '2026-09-06',
  },
  decision: 'approve',
  date: '2026-09-06',
  commit: '0123456789abcdef0123456789abcdef01234567',
  fingerprint: 'FIXTURE-KEY-0000',
});

const APPROVED = {
  id: 'rfc:900',
  title: 'fixture',
  question: 'q:abiding-self',
  consequence_tier: 'high',
  targets: ['res:self.upanishad-dhammapada', 'pos:upanishad.ish1.shankara', 'pos:dhp.279.buddhaghosa'],
  seats_required: ['hindu', 'buddhist'],
  status: 'approved',
  opened: '2026-09-06',
  signoffs: [signoff('hindu', 'Fixture Reviewer A'), signoff('buddhist', 'Fixture Reviewer B')],
};

/* ------------------------------------------------- the real record is honest */

t('the committed RFC 001 is open with no invented sign-offs', () => {
  const a = loadAdvisory('.');
  assert(!a.problems.length, 'advisory records must parse: ' + a.problems.join('; '));
  const r = a.byId.get('rfc:001');
  assert(r, 'rfc:001 must exist');
  assert(r.status === 'open', `rfc:001 must be open, is "${r.status}"`);
  assert((r.signoffs ?? []).length === 0,
    'rfc:001 must carry no sign-offs — no scholar approval may be fabricated to unblock a build');
});

/* --------------------------------------------------------- what is refused */

t('a placeholder is not a sign-off', ({ patch, res }) => {
  patch('data/positions/positions.json', (ps) => {
    ps.find((p) => p.id === 'pos:upanishad.ish1.shankara').reviewed_by = ['advisory:hindu (pending)'];
    return ps;
  });
  const f = res().audit().find((x) => x.id === 'pos:upanishad.ish1.shankara');
  assert(/placeholder/.test(f.message), 'expected a placeholder rejection, got: ' + f.message);
});

t('a reference to an RFC that does not exist is refused', ({ adv }) => {
  const c = adv().clearance('rfc:404', 'res:self.upanishad-dhammapada', ['hindu']);
  assert(!c.ok && /does not name an RFC/.test(c.why), c.why);
});

t('an open RFC does not clear anything', ({ adv }) => {
  const c = adv().clearance('rfc:001', 'res:self.upanishad-dhammapada', ['hindu', 'buddhist']);
  assert(!c.ok && /not approved/.test(c.why), c.why);
});

t('an approved RFC does not clear a claim it does not cover', ({ rfc, adv }) => {
  rfc('900-fixture.md', APPROVED);
  const c = adv().clearance('rfc:900', 'res:naming.daodejing-quran', ['daoist']);
  assert(!c.ok && /does not cover/.test(c.why), c.why);
});

t('an approved RFC missing a required seat does not clear the claim', ({ rfc, adv }) => {
  rfc('900-fixture.md', { ...APPROVED, seats_required: ['hindu'], signoffs: [signoff('hindu', 'Fixture Reviewer A')] });
  const c = adv().clearance('rfc:900', 'res:self.upanishad-dhammapada', ['hindu', 'buddhist']);
  assert(!c.ok && /does not carry the buddhist seat/.test(c.why), c.why);
});

t('a standing objection blocks approval', ({ rfc, adv }) => {
  rfc('900-fixture.md', {
    ...APPROVED,
    signoffs: [signoff('hindu', 'Fixture Reviewer A'), { ...signoff('buddhist', 'Fixture Reviewer B'), decision: 'object' }],
  });
  const a = adv();
  assert(a.problems.some((p) => /objection stands/.test(p)),
    'an RFC marked approved over a standing objection must be rejected as invalid');
});

t('a sign-off with an unverified credential is refused', ({ rfc, adv }) => {
  const bad = signoff('hindu', 'Fixture Reviewer A');
  delete bad.credential.verified_by;
  rfc('900-fixture.md', { ...APPROVED, signoffs: [bad, signoff('buddhist', 'Fixture Reviewer B')] });
  assert(adv().problems.some((p) => /was not verified by anyone/.test(p)),
    'a credential nobody checked is a claim in a text field, not a credential');
});

t('a sign-off with no commit or fingerprint is refused', ({ rfc, adv }) => {
  const bad = { ...signoff('hindu', 'Fixture Reviewer A'), commit: '', fingerprint: '' };
  rfc('900-fixture.md', { ...APPROVED, signoffs: [bad, signoff('buddhist', 'Fixture Reviewer B')] });
  const p = adv().problems.join(' | ');
  assert(/no commit SHA/.test(p) && /no signing key fingerprint/.test(p), p);
});

t('an unparseable record is a structural error, not a warning', ({ dir, res }) => {
  writeFileSync(join(dir, 'advisory/rfc/902-broken.md'), '```json record\n{ not json\n```\n');
  const errs = res().audit().filter((f) => f.severity === 'error' && f.code === 'bad-record');
  assert(errs.length, 'a review system nobody can parse is worse than none');
});

/* ------------------------------------------------------- what does clear it */

t('an approved RFC with both seats clears the claim and releases the build', ({ rfc, patch, res }) => {
  rfc('900-fixture.md', APPROVED);
  patch('data/positions/positions.json', (ps) => {
    for (const id of ['pos:upanishad.ish1.shankara', 'pos:dhp.279.buddhaghosa'])
      ps.find((p) => p.id === id).reviewed_by = ['rfc:900'];
    return ps;
  });
  patch('data/resonances/resonances.json', (rs) => {
    const r = rs.find((x) => x.id === 'res:self.upanishad-dhammapada');
    r.review = { required_from: ['advisory:hindu', 'advisory:buddhist'], signed_off_by: ['rfc:900'], status: 'published' };
    return rs;
  });
  const m = res();
  const strict = m.audit({ strict: true });
  assert(!strict.length, 'nothing should be held once the RFC clears it: ' +
    strict.map((f) => `${f.id}: ${f.message}`).join('; '));
  assert(m.productionSet().held.length === 0, 'the production set should carry everything');
});

/* -------------------------------------------------------------- signatures */

t('signature verification never silently passes', () => {
  const a = loadAdvisory('.');
  for (const s of a.verifySignatures())
    assert(s.state !== 'good' || s.detail === '',
      'a signature reported good must have been actually verified');
});

console.log(failed ? `\n${failed} advisory test(s) failed` : `\nall advisory tests pass`);
process.exit(failed ? 1 : 0);
