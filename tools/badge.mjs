// The build badge: the same small readout of what you are running, in every area.
//
// Dependency-free and free of node builtins on purpose — the four built pages inline it as
// a string, and the Worker imports it directly for the pages it renders itself. One
// implementation, so two areas can never disagree about what build they are.
//
// Three lines of technical information, and no more:
//
//     version   0.1.0a1·a57e794
//     build     2026-09-12T03:21:44Z
//     now       2026-09-12T03:47:12.418Z
//
// `build` carries no milliseconds because git commit dates carry none — printing .000
// there would be precision this project does not have. `now` is a live clock and is the
// one timestamp that can honestly show milliseconds; it also gives anyone reporting a
// problem an exact instant to quote.

// The same pair of eyes the password fields use, so one icon means one thing everywhere.
export const EYE_OPEN =
  '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M1 10s3.2-5.5 9-5.5S19 10 19 10s-3.2 5.5-9 5.5S1 10 1 10z"/><circle cx="10" cy="10" r="2.6"/></svg>';
export const EYE_SHUT =
  '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M1 10s3.2-5.5 9-5.5S19 10 19 10s-3.2 5.5-9 5.5S1 10 1 10z"/><circle cx="10" cy="10" r="2.6"/><path d="M3 3l14 14"/></svg>';

/**
 * Bottom left, over the page rather than in it, so it needs its own ground: a translucent
 * scrim of the panel colour with a blur behind it keeps the text legible over whatever it
 * happens to sit on, in either theme, without drawing a box around itself.
 *
 * Every colour comes from a variable the host page defines, so the badge takes the theme it
 * lands in rather than carrying its own.
 */
export const BADGE_CSS = `
  .oh-badge { position:fixed; left:12px; bottom:12px; z-index:40; display:flex; align-items:flex-start;
              gap:7px; padding:5px 8px 5px 5px; border-radius:7px;
              font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:10.5px; line-height:1.45;
              letter-spacing:.02em; color:var(--muted,#6b6459);
              border:1px solid color-mix(in srgb, var(--line,#e3ddd2) 70%, transparent);
              background:color-mix(in srgb, var(--panel,#fffefb) 78%, transparent);
              backdrop-filter:blur(8px) saturate(1.2); -webkit-backdrop-filter:blur(8px) saturate(1.2); }
  .oh-badge button { all:unset; box-sizing:border-box; width:20px; height:20px; flex:0 0 auto;
                     display:grid; place-items:center; border-radius:5px; cursor:pointer;
                     color:var(--muted,#6b6459); }
  .oh-badge button:hover { color:var(--ink,#1d1a16); }
  .oh-badge button:focus-visible { outline:2px solid var(--accent,#7a5c3e); outline-offset:1px; }
  .oh-badge svg { width:14px; height:14px; fill:none; stroke:currentColor; stroke-width:1.6;
                  stroke-linecap:round; stroke-linejoin:round; }
  .oh-badge dl { margin:0; display:grid; grid-template-columns:auto auto; gap:0 8px; white-space:nowrap; }
  .oh-badge dt { color:color-mix(in srgb, var(--muted,#6b6459) 70%, transparent); }
  .oh-badge dd { margin:0; color:var(--ink,#1d1a16); }
  .oh-badge .v { color:var(--accent,#7a5c3e); }
  .oh-badge[data-open="false"] dl { display:none; }
  .oh-badge[data-open="false"] .short { display:block; color:var(--accent,#7a5c3e); }
  .oh-badge .short { display:none; align-self:center; }
  @media (max-width:560px) { .oh-badge { left:8px; bottom:8px; font-size:10px; } }
  @media (prefers-reduced-transparency: reduce) {
    .oh-badge { background:var(--panel,#fffefb); backdrop-filter:none; }
  }
`;

const esc = (s) => String(s).replace(/[&<>"]/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** `built` is an ISO string; the seconds are all git gives, so that is all this shows. */
export const badgeHtml = ({ short, built, area }) => `
<div class="oh-badge" id="ohBadge" data-open="true" title="${esc(area)} · ${esc(short)} · built ${esc(built)}">
  <button type="button" id="ohBadgeEye" aria-controls="ohBadgeBody" aria-expanded="true"
          aria-label="Hide build details">${EYE_OPEN}</button>
  <span class="short">${esc(short)}</span>
  <dl id="ohBadgeBody">
    <dt>area</dt><dd>${esc(area)}</dd>
    <dt>version</dt><dd class="v">${esc(short)}</dd>
    <dt>build</dt><dd>${esc(String(built).replace(/\.\d+Z?$/, '').replace(/\+00:00$/, '') + 'Z')}</dd>
    <dt>now</dt><dd id="ohBadgeNow">—</dd>
  </dl>
</div>`;

/**
 * The collapsed choice is shared by every badge on the page and remembered across areas:
 * two badges disagreeing about whether they are collapsed would be the clearest possible
 * sign the control means nothing, and one that re-expands on every navigation is one you
 * have to dismiss over and over.
 */
export const BADGE_SCRIPT = `
(() => {
  const KEY = 'oh-badge-open';
  const badge = document.getElementById('ohBadge');
  if (!badge) return;
  const eye = document.getElementById('ohBadgeEye');
  const now = document.getElementById('ohBadgeNow');
  const OPEN = ${JSON.stringify(EYE_OPEN)}, SHUT = ${JSON.stringify(EYE_SHUT)};

  const apply = (open) => {
    badge.dataset.open = String(open);
    eye.setAttribute('aria-expanded', String(open));
    eye.setAttribute('aria-label', open ? 'Hide build details' : 'Show build details');
    eye.innerHTML = open ? OPEN : SHUT;
  };

  let open = true;
  try { const s = localStorage.getItem(KEY); if (s !== null) open = s === '1'; } catch {}
  apply(open);

  eye.addEventListener('click', () => {
    open = !open;
    apply(open);
    try { localStorage.setItem(KEY, open ? '1' : '0'); } catch {}
  });

  // Ten times a second: enough for the milliseconds to move, far below anything a person
  // reads, and it stops entirely while the badge is collapsed.
  const tick = () => { if (badge.dataset.open === 'true' && now) now.textContent = new Date().toISOString(); };
  tick();
  setInterval(tick, 100);
})();
`;
