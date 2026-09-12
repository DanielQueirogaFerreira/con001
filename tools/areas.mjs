// Every area of the site, in one list, with the clearance each one needs.
//
// Dependency-free and free of node builtins: the built pages inline it, and the Worker
// imports it for the pages it renders itself. One list, so an area cannot exist without
// appearing in the navigation — which is how /account and /evolution came to be reachable
// only by someone who already knew the path.

/**
 * CLEARANCE. There is exactly one level today and saying otherwise would be a fiction:
 * the gate admits a person or it does not, and everyone admitted can reach everything.
 * No administrator tier exists — /account administers YOUR OWN access and nobody else's,
 * which is why it is listed as a member area rather than an admin one.
 *
 * When roles arrive they belong here, in the same table the navigation is drawn from, so a
 * new level cannot be granted somewhere and forgotten in the menu.
 */
export const CLEARANCE = {
  public: { id: 'public', label: 'public', note: 'reachable without signing in' },
  member: { id: 'member', label: 'member', note: 'requires a session' },
};

export const AREAS = [
  { path: '/', name: 'Reader', what: 'the seven works, layered readings, the Studio', clearance: 'member' },
  { path: '/evolution', name: 'Codebase Navigator', what: 'this repository as a scene you fly through', clearance: 'member', id: '501' },
  { path: '/status', name: 'Build status', what: 'what is shipped, held, and unfinished', clearance: 'member' },
  { path: '/console', name: 'Console', what: 'the reader and the status page in one screen', clearance: 'member' },
  { path: '/account', name: 'Account & access', what: 'change your password, sign out every session', clearance: 'member' },
];

// Named so they are not mistaken for oversights: these are open by design, and each one
// gives away nothing about who has an account.
export const PUBLIC_PATHS = [
  { path: '/login', name: 'Sign in' },
  { path: '/reset', name: 'Reset a password' },
  { path: '/healthz', name: 'Liveness', what: 'answers "ok" and nothing else' },
];

const esc = (s) => String(s).replace(/[&<>"]/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export const AREAS_CSS = `
  .oh-areas { display:flex; flex-wrap:wrap; gap:6px 10px; align-items:baseline; font-size:12px; }
  .oh-areas a, .oh-areas span.here { display:inline-flex; align-items:baseline; gap:5px;
      padding:3px 8px; border-radius:6px; border:1px solid var(--line,#e3ddd2);
      text-decoration:none; color:var(--accent,#7a5c3e); white-space:nowrap; }
  .oh-areas span.here { color:var(--ink,#1d1a16); border-color:var(--accent,#7a5c3e);
      background:color-mix(in srgb, var(--accent,#7a5c3e) 9%, transparent); }
  .oh-areas a:hover { border-color:var(--accent,#7a5c3e); }
  .oh-areas em { font-style:normal; font-size:9.5px; letter-spacing:.06em; text-transform:uppercase;
                 color:var(--muted,#6b6459); }
`;

/**
 * The row that appears in every area. The area you are in is marked and not a link — a
 * menu whose current entry is clickable makes you check whether you went anywhere.
 */
export const areasNav = (current) => `
<nav class="oh-areas" aria-label="Areas">
  ${AREAS.map((a) => (a.path === current
    ? `<span class="here" aria-current="page">${esc(a.name)}<em>${esc(a.clearance)}</em></span>`
    : `<a href="${esc(a.path)}">${esc(a.name)}<em>${esc(a.clearance)}</em></a>`)).join('\n  ')}
</nav>`;

/** The fuller table, for the status page, where the question is what exists at all. */
export const areasTable = (signedInAs = null) => `
<table>
  <tr><th>Area</th><th>Path</th><th>Clearance</th><th>What it is</th></tr>
  ${AREAS.map((a) => `<tr>
    <td data-label="Area"><a href="${esc(a.path)}"><strong>${esc(a.name)}</strong></a>${
      a.id ? ` <span class="dim mono">${esc(a.id)}</span>` : ''}</td>
    <td class="mono" data-label="Path">${esc(a.path)}</td>
    <td data-label="Clearance"><span class="pill s-done">${esc(CLEARANCE[a.clearance].label)}</span></td>
    <td class="dim" data-label="What it is">${esc(a.what)}</td></tr>`).join('\n  ')}
  ${PUBLIC_PATHS.map((a) => `<tr>
    <td data-label="Area">${esc(a.name)}</td>
    <td class="mono" data-label="Path">${esc(a.path)}</td>
    <td data-label="Clearance"><span class="pill s-idle">${esc(CLEARANCE.public.label)}</span></td>
    <td class="dim" data-label="What it is">${esc(a.what ?? 'part of the gate')}</td></tr>`).join('\n  ')}
</table>
<div class="note">
  <strong>One clearance level exists.</strong> The gate admits a person or it does not, and
  everyone admitted can reach every member area — including <span class="mono">/account</span>,
  which administers your own access and nobody else's. There is no administrator tier, and
  this page will say so until there is one.${
    signedInAs ? ` Signed in as <span class="mono">${esc(signedInAs)}</span>, clearance <strong>member</strong>.` : ''}
</div>`;
