#!/usr/bin/env node
// Certifies a DEPLOYED site is actually gated.
//
//   node tools/verify-live.mjs https://con001.<subdomain>.workers.dev
//
// tools/preflight.mjs checks the configuration before a deploy. This checks the
// running thing afterwards, because the failure that matters here is silent:
// if `run_worker_first` is dropped or ignored, the asset server answers before
// the Worker, every page becomes public, the deploy still succeeds, and nothing
// anywhere reports an error. The only way to know is to ask the live site for a
// page without credentials and see what it hands back.

const base = (process.argv[2] ?? '').replace(/\/$/, '');
if (!/^https:\/\//.test(base)) {
  console.error('Usage: node tools/verify-live.mjs https://your-worker.workers.dev');
  console.error('       (https only — a session cookie is Secure and will not travel over http)');
  process.exit(1);
}

const findings = [];
const check = (label, ok, detail = '') => {
  findings.push({ label, ok, detail });
  return ok;
};

const get = (path, init = {}) =>
  fetch(base + path, { redirect: 'manual', ...init }).catch((e) => ({ error: e.message }));

console.log(`\nVERIFYING ${base}\n`);

// 1. The gate. An unauthenticated request for the site root must not return a page.
const root = await get('/');
if (root.error) {
  console.error(`  could not reach the site: ${root.error}\n`);
  process.exit(1);
}
check('the root redirects an unauthenticated visitor', root.status === 303 || root.status === 302,
  `got ${root.status}`);
check('it redirects to the login page', (root.headers?.get('Location') ?? '') === '/login',
  root.headers?.get('Location') ?? 'no Location header');

// 2. THE test. Named assets must not be reachable by going straight at them —
// this is what fails if the Worker is not running first.
for (const asset of ['/reader.html', '/status.html', '/console.html', '/index.html']) {
  const res = await get(asset);
  const leaked = res.status === 200;
  check(`${asset} is not served without a session`, !leaked,
    leaked ? 'SERVED — the gate is not in front of the assets' : `got ${res.status}`);
  if (leaked) {
    const body = await res.text().catch(() => '');
    if (/Open Hermeneutics/.test(body))
      check(`${asset} content is exposed`, false, 'the page body came back in full');
  }
}

// 3. The login page must exist and be a login page.
const login = await get('/login');
const loginBody = login.status === 200 ? await login.text() : '';
check('the login page is served', login.status === 200, `got ${login.status}`);
check('the login page asks for credentials', /name="password"/.test(loginBody));
check('there is no self-registration link', !/\/(register|signup)\b/.test(loginBody));

// 4. Security headers on a response the public can actually reach.
const headers = login.headers ?? new Headers();
check('X-Frame-Options is DENY', headers.get('X-Frame-Options') === 'DENY',
  headers.get('X-Frame-Options') ?? 'absent');
check('X-Content-Type-Options is nosniff', headers.get('X-Content-Type-Options') === 'nosniff',
  headers.get('X-Content-Type-Options') ?? 'absent');
check('Referrer-Policy is no-referrer', headers.get('Referrer-Policy') === 'no-referrer',
  headers.get('Referrer-Policy') ?? 'absent');
const csp = headers.get('Content-Security-Policy') ?? '';
check('the CSP names no remote origin', csp.length > 0 && !/https?:/.test(csp),
  csp ? 'a remote origin appears in the policy' : 'absent');

// 5. A wrong password must be refused, and must not say which half was wrong.
const bad = await get('/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ email: 'nobody@example.invalid', password: 'not the password' }),
});
check('a bad sign-in is refused', bad.status === 401, `got ${bad.status}`);
const badBody = bad.status ? await bad.text().catch(() => '') : '';
check('the refusal does not reveal whether the account exists',
  !/no account|unknown user|not found|no such/i.test(badBody));
check('a failed sign-in sets no session cookie', !bad.headers?.get('Set-Cookie'));

// 6. Liveness, which is allowed to be public and must give nothing away.
const health = await get('/healthz');
check('/healthz responds', health.status === 200, `got ${health.status}`);
const healthBody = health.status === 200 ? await health.text().catch(() => '') : '';
check('/healthz leaks nothing', healthBody.trim() === 'ok', JSON.stringify(healthBody.slice(0, 40)));

const pad = Math.max(...findings.map((f) => f.label.length));
for (const f of findings)
  console.log(`  ${f.ok ? 'ok  ' : 'FAIL'}  ${f.label.padEnd(pad)}${!f.ok && f.detail ? '  — ' + f.detail : ''}`);

const bad_ = findings.filter((f) => !f.ok);
if (bad_.length) {
  console.error(`\n  ${bad_.length} of ${findings.length} checks failed. This deployment is NOT certified.\n`);
  process.exit(1);
}
console.log(`\n  ${findings.length} checks passed. The deployment is gated.\n`);
