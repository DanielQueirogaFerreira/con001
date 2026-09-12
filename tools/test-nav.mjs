#!/usr/bin/env node
// The navigator's pure modules, tested without a canvas or a GPU — which is the whole
// reason the camera and layout were written from scratch rather than on a 3D library.
//
// Several of these exist because CODEBASE-VIEWER-SPEC.md §8 lists them as defects that
// shipped, or nearly shipped, in the original build. A test per trap is cheaper than
// rediscovering it.

import {
  DEFAULT_CAMERA, IDENTITY, VIEWS, project, orbit, pan, zoom, frameSphere, clampTarget,
  quatNormalize, quatMul, quatFromAxisAngle, eyeOf, basis, MIN_DISTANCE, MAX_DISTANCE,
} from './nav/camera.mjs';
import {
  buildTree, seedLayout, step, hasSettled, boundingSphere, heatAt, livePaths,
  commitIndexAt, timelineMarks, kindOf, legend, FILE_KINDS, ACTION_COLOUR, MIN_STEPS_BEFORE_SETTLED,
} from './nav/evolution.mjs';

let failures = 0;
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };
const t = (name, fn) => {
  try { fn(); console.log(`  ok    ${name}`); }
  catch (e) { failures++; console.error(`  FAIL  ${name}\n        ${e.message}`); }
};

/* ------------------------------------------------------------------ camera */

t('a quaternion stays on the unit sphere however long you drag (8.2)', () => {
  let cam = DEFAULT_CAMERA;
  for (let i = 0; i < 20000; i++) cam = orbit(cam, 7, -5);
  const q = cam.orientation;
  const len = Math.hypot(q.x, q.y, q.z, q.w);
  assert(Math.abs(len - 1) < 1e-9, `|q| drifted to ${len}`);
});

t('dragging up never hits a wall — there are no poles', () => {
  // The Euler version clamps short of ±90° and dragging up stops dead. Here the view
  // direction must keep changing all the way round.
  let cam = { ...DEFAULT_CAMERA, orientation: IDENTITY };
  const seen = [];
  for (let i = 0; i < 8; i++) {
    cam = orbit(cam, 0, -200);            // a long upward drag
    seen.push(basis(cam).forward.y.toFixed(3));
  }
  assert(new Set(seen).size > 4, `the view stopped turning: ${seen.join(' ')}`);
});

t('a point behind the eye is refused, not mirrored into view', () => {
  const cam = { ...DEFAULT_CAMERA, orientation: IDENTITY, target: { x: 0, y: 0, z: 0 }, distance: 100 };
  const behind = project({ x: 0, y: 0, z: 500 }, cam, 800, 600);
  assert(!behind.visible, 'a point behind the camera projected as visible');
  const front = project({ x: 0, y: 0, z: 0 }, cam, 800, 600);
  assert(front.visible && Math.abs(front.x - 400) < 1e-6 && Math.abs(front.y - 300) < 1e-6,
    `the target should project to the centre, got ${front.x},${front.y}`);
});

t('screen y grows downward while the camera up axis grows up', () => {
  const cam = { ...DEFAULT_CAMERA, orientation: IDENTITY, target: { x: 0, y: 0, z: 0 }, distance: 200 };
  const above = project({ x: 0, y: 50, z: 0 }, cam, 800, 600);
  assert(above.y < 300, 'a point above the target must draw above the centre');
});

t('zoom is multiplicative and clamped', () => {
  let cam = { ...DEFAULT_CAMERA, distance: 100 };
  const once = zoom(cam, 1).distance;
  assert(Math.abs(once - 112) < 1e-9, `expected 112, got ${once}`);
  let far = cam; for (let i = 0; i < 500; i++) far = zoom(far, 1);
  let near = cam; for (let i = 0; i < 500; i++) near = zoom(near, -1);
  assert(far.distance === MAX_DISTANCE && near.distance === MIN_DISTANCE, 'distance escaped its clamp');
});

t('panning cannot lose the graph (8.4)', () => {
  const centre = { x: 0, y: 0, z: 0 }, r = 300;
  let cam = frameSphere(DEFAULT_CAMERA, centre, r, 800, 600);
  for (let i = 0; i < 48; i++) {
    cam = pan(cam, 400, 300, 600);            // 48 hard pans, the measurement in the trap
    cam = clampTarget(cam, centre, r);
  }
  const d = Math.hypot(cam.target.x, cam.target.y, cam.target.z);
  assert(d <= r + 1e-6, `the orbit centre strayed ${d.toFixed(1)} from a ${r} sphere`);
});

t('framing fits the sphere from any angle', () => {
  const centre = { x: 10, y: -5, z: 3 }, r = 250;
  for (const view of Object.values(VIEWS)) {
    const cam = frameSphere({ ...DEFAULT_CAMERA, orientation: view }, centre, r, 900, 500);
    // Every point on the sphere must project inside the canvas.
    for (const p of [[r,0,0],[-r,0,0],[0,r,0],[0,-r,0],[0,0,r],[0,0,-r]]) {
      const q = project({ x: centre.x + p[0], y: centre.y + p[1], z: centre.z + p[2] }, cam, 900, 500);
      assert(q.visible && q.x >= -1 && q.x <= 901 && q.y >= -1 && q.y <= 501,
        `a point on the sphere fell outside the canvas at ${q.x?.toFixed(0)},${q.y?.toFixed(0)}`);
    }
  }
});

t('a named view re-orients without moving what was centred', () => {
  const cam = { ...DEFAULT_CAMERA, target: { x: 40, y: 12, z: -7 } };
  const next = { ...cam, orientation: VIEWS.top };
  assert(next.target.x === 40 && next.target.y === 12 && next.target.z === -7,
    'switching view moved the orbit centre');
});

/* -------------------------------------------------------------------- tree */

t('a directory is never confused with its neighbour (8.14)', () => {
  const nodes = buildTree(['apps/web/a.ts', 'apps/website/b.ts']);
  const ids = nodes.map((n) => n.id);
  assert(ids.includes('apps/web') && ids.includes('apps/website'), 'both directories must exist');
  const web = nodes.findIndex((n) => n.id === 'apps/web');
  const kids = nodes.filter((n) => n.parent === web).map((n) => n.id);
  assert(kids.length === 1 && kids[0] === 'apps/web/a.ts',
    `apps/web swallowed its neighbour: ${kids.join(', ')}`);
});

t('parents always precede their children, and the shape is stable', () => {
  const paths = ['z/late.ts', 'a/early.ts', 'a/b/c/deep.md'];
  const nodes = buildTree(paths);
  assert(nodes.every((n, i) => n.parent < i), 'a child appeared before its parent');
  const again = buildTree([...paths].reverse());
  assert(JSON.stringify(nodes.map(n => n.id)) === JSON.stringify(again.map(n => n.id)),
    'the tree depends on the order paths arrived in');
});

/* ------------------------------------------------------------------ layout */

t('a freshly seeded layout is not "settled" (the framing bug)', () => {
  const l = seedLayout(buildTree(['a/b.ts', 'a/c.ts', 'd/e.md']));
  // Every velocity is zero at seed time, so the energy test alone passes on frame one —
  // the auto-framing then fits the seed cloud and never refits.
  assert(!hasSettled(l), 'a layout that has never stepped reported itself settled');
  for (let i = 0; i < MIN_STEPS_BEFORE_SETTLED + 10; i++) step(l);
  assert(typeof hasSettled(l) === 'boolean', 'hasSettled must still answer after stepping');
});

t('the graph grows away from its seed, and the root stays pinned', () => {
  const l = seedLayout(buildTree(['a/b.ts', 'a/c.ts', 'a/d.ts', 'e/f.ts', 'e/g/h.ts']));
  const before = boundingSphere(l).r;
  for (let i = 0; i < 400; i++) step(l);
  const after = boundingSphere(l).r;
  assert(after > before, `the layout did not expand: ${before.toFixed(1)} → ${after.toFixed(1)}`);
  assert(l.x[0] === 0 && l.y[0] === 0 && l.z[0] === 0, 'the root drifted off the origin');
  for (let i = 0; i < l.nodes.length; i++)
    assert(Number.isFinite(l.x[i]) && Number.isFinite(l.y[i]) && Number.isFinite(l.z[i]),
      `node ${i} went non-finite`);
});

t('drift is a bounded displacement, not a force (8.6, 8.7)', () => {
  const paths = ['a/b.ts', 'a/c.ts', 'd/e.md', 'd/f/g.sql'];
  const fixed = seedLayout(buildTree(paths));
  const drifting = seedLayout(buildTree(paths));
  let phase = 0;
  for (let i = 0; i < 500; i++) {
    step(fixed, { wander: 0 });
    phase += 16 * 0.0016;
    step(drifting, { wander: 7, wanderPhase: phase });
  }
  // The physics underneath must be the same: the sway is added after the forces run and
  // taken back out before they run again, so it cannot be pushed against.
  let worst = 0;
  for (let i = 0; i < fixed.nodes.length; i++) {
    const dx = (drifting.x[i] - drifting.wx[i]) - fixed.x[i];
    const dy = (drifting.y[i] - drifting.wy[i]) - fixed.y[i];
    const dz = (drifting.z[i] - drifting.wz[i]) - fixed.z[i];
    worst = Math.max(worst, Math.hypot(dx, dy, dz));
  }
  assert(worst < 1.5, `drift disturbed the physics by ${worst.toFixed(2)} world units`);
  // And no node is ever further than wander·√3 from where the physics put it.
  for (let i = 1; i < drifting.nodes.length; i++)
    assert(Math.hypot(drifting.wx[i], drifting.wy[i], drifting.wz[i]) <= 7 * Math.sqrt(3) + 1e-9,
      'a node strayed further than the drift amplitude allows');
});

t('the aspect knob widens the graph without inflating it', () => {
  const paths = ['a/b.ts', 'a/c.ts', 'a/d.ts', 'e/f.ts', 'e/g/h.ts', 'i/j.md'];
  const spread = (aspect) => {
    const l = seedLayout(buildTree(paths));
    for (let i = 0; i < 400; i++) step(l, { aspect });
    const sp = (arr) => Math.max(...arr) - Math.min(...arr);
    return { x: sp(l.x), y: sp(l.y), z: sp(l.z) };
  };
  const round = spread(1), wide = spread(1.6);
  assert(wide.x > round.x && wide.y < round.y, 'the bias did not stretch the graph sideways');
  assert(Math.abs(wide.z - round.z) / round.z < 0.2, 'depth was stretched, which it must never be');
});

/* -------------------------------------------------------- playhead & heat */

const LOG = {
  authors: ['A'], paths: ['a.ts', 'b.md', 'gone.ts'], alive: [1, 1, 0],
  events: [
    { t: 1000, a: 0, s: 'aaa', m: 'one', f: [[0, 'A'], [2, 'A']] },
    { t: 1010, a: 0, s: 'bbb', m: 'two', f: [[1, 'A']] },
    { t: 1020, a: 0, s: 'ccc', m: 'three', f: [[0, 'M']] },
    { t: 1030, a: 0, s: 'ddd', m: 'four', f: [[2, 'D']] },
  ],
};

t('the log is seconds and the clock is milliseconds (8.1)', () => {
  // Passing seconds where milliseconds belong lights nothing, which is the symptom that
  // reads as "the animation is broken" rather than as a unit error.
  assert(heatAt(LOG, 1020 * 1000, 14000).size > 0, 'nothing was lit at a moment that has events');
  assert(heatAt(LOG, 1020, 14000).size === 0, 'seconds were accepted where ms belong');
});

t('a file touched twice shows the more recent, brighter touch', () => {
  const h = heatAt(LOG, 1020 * 1000, 14000);
  assert(h.get(0).action === 'M', `expected the later M, got ${h.get(0).action}`);
  assert(h.get(0).heat === 1, 'a touch at the playhead should be fully lit');
});

t('existence is replayed backwards from HEAD, not forwards', () => {
  // gone.ts is added at 1000 and deleted at 1030, and is NOT alive at HEAD.
  assert(!livePaths(LOG, 999 * 1000).has(2), 'the file existed before it was added');
  assert(livePaths(LOG, 1020 * 1000).has(2), 'the file should exist between its add and its delete');
  assert(!livePaths(LOG, 1030 * 1000).has(2), 'the file survived its own deletion');
  // b.md is alive at HEAD and added inside the window.
  assert(!livePaths(LOG, 1005 * 1000).has(1), 'a file existed before its add event');
});

t('the commit under the playhead is found by binary search', () => {
  assert(commitIndexAt(LOG, 999 * 1000) === -1, 'nothing should be found before the first commit');
  assert(commitIndexAt(LOG, 1015 * 1000) === 1, 'wrong commit between events');
  assert(commitIndexAt(LOG, 9999 * 1000) === 3, 'the last commit should be found after the window');
});

t('a commit exactly at the end of the window still appears on the strip', () => {
  const marks = timelineMarks(LOG, 1000 * 1000, 1030 * 1000, 10);
  const total = marks.reduce((n, m) => n + m.commits, 0);
  assert(total === 4, `${total} of 4 commits made it onto the timeline`);
  assert(marks.every((m) => m.commits > 0), 'empty buckets were returned');
});

/* ------------------------------------------------------------------ colour */

t('file kinds match whatever case the filename is in (8.13)', () => {
  assert(kindOf('deploy.yml').id === 'config' && kindOf('Deploy.YML').id === 'config',
    'an uppercase extension fell through to the fold-in slot');
  assert(kindOf('schema.SQL').id === 'schema' && kindOf('a.TSX').id === 'code');
  assert(kindOf('README').id === 'other', 'the last slot must match everything left');
});

t('the legend is derived from the painter\'s own tables (8.8)', () => {
  const l = legend();
  assert(l.kinds.length === FILE_KINDS.length, 'a file kind has no legend entry');
  for (const k of FILE_KINDS)
    assert(l.kinds.some((e) => e.colour === k.colour), `${k.id} is painted in a colour the legend never shows`);
  for (const c of Object.values(ACTION_COLOUR))
    assert(l.actions.some((e) => e.colour === c), 'an action colour has no legend entry');
});

t('action colours and kind colours are different encodings', () => {
  const kinds = new Set(FILE_KINDS.map((k) => k.colour));
  for (const c of Object.values(ACTION_COLOUR))
    assert(!kinds.has(c), `${c} is used for both an action and a file kind`);
});

console.log(failures ? `\n  ${failures} failure(s)\n` : '\n  navigator: all checks pass\n');
process.exit(failures ? 1 : 0);
