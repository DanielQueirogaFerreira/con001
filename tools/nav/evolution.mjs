// The scene's data side: the tree, the 3D force layout, and the two functions that decide
// what is lit and what exists at any moment of the playhead.
//
// Everything here is pure and testable without a canvas. Implements
// CODEBASE-VIEWER-SPEC.md §6.2, §6.3, §6.5, §6.6, §6.7.

/* --------------------------------------------------------------- hashing */

/** Stable across runs, so the same repository always produces the same opening shape. */
export function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/* ----------------------------------------------------------------- colour */

// Action → the ring, never the dot. These are the diff convention and are not free to move.
export const ACTION_COLOUR = { A: '#35c98b', M: '#4da3ff', D: '#f0645c' };
export const ACTION_LABEL = { A: 'added', M: 'modified', D: 'deleted' };

// File kind → the dot, never the ring. Four slots, not seven: an earlier set spent hues on
// distinctions no one could separate, and two greys sat ΔE 4.6 apart under deuteranopia —
// a migration and a README drawn as the same dot. Code is violet rather than blue because
// blue belongs to "modified".
export const FILE_KINDS = [
  { id: 'code', label: 'code', colour: '#9c6ade', hint: 'ts, js, mjs, css, html',
    match: /\.(tsx?|jsx?|mjs|cjs|css|html)$/i },
  { id: 'config', label: 'config & CI', colour: '#c87820', hint: 'yml, json, toml',
    match: /\.(ya?ml|toml|json)$/i },
  { id: 'schema', label: 'migrations', colour: '#1f9c78', hint: 'sql',
    match: /\.sql$/i },
  // Last, and matches everything left. Deliberately below the chroma floor: it is the
  // fold-in slot, not a fourth series, and reading as recessive is its job.
  { id: 'other', label: 'docs & other', colour: '#5c6672', hint: 'md, txt, everything else',
    match: null },
];

// Every regex is case-insensitive, and that is not tidiness: `Deploy.YML` fell through to
// the grey slot and a config file was drawn as a document. (Trap 8.13.)
export const kindOf = (path) => FILE_KINDS.find((k) => !k.match || k.match.test(path));

/**
 * The legend is DERIVED from the same tables the painter reads, which makes the two
 * drifting apart unrepresentable rather than merely fixed. (Trap 8.8.)
 */
export const legend = () => ({
  kinds: FILE_KINDS.map((k) => ({ label: k.label, colour: k.colour, hint: k.hint })),
  actions: Object.entries(ACTION_COLOUR).map(([a, colour]) => ({ label: ACTION_LABEL[a], colour })),
});

/* ------------------------------------------------------------------ tree */

/**
 * Two invariants, both relied on downstream:
 *   - parents always come before their children, so one forward pass positions the tree;
 *   - paths are sorted first, so the shape does not rearrange between deploys for no reason.
 */
export function buildTree(paths) {
  const nodes = [{ id: '', name: '', parent: -1, depth: 0, file: false, pathIndex: -1 }];
  const byId = new Map([['', 0]]);

  const sorted = [...paths].map((p, i) => [p, i]).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));

  for (const [path, pathIndex] of sorted) {
    const parts = path.split('/').filter(Boolean);
    let parent = 0, prefix = '';
    for (let d = 0; d < parts.length; d++) {
      const last = d === parts.length - 1;
      // Built from the joined prefix, never by string-matching a path against another:
      // `apps/web` must not match `apps/website`. (Trap 8.14.)
      prefix = prefix ? `${prefix}/${parts[d]}` : parts[d];
      let index = byId.get(prefix);
      if (index === undefined) {
        index = nodes.length;
        nodes.push({
          id: prefix, name: parts[d], parent, depth: d + 1,
          file: last, pathIndex: last ? pathIndex : -1,
        });
        byId.set(prefix, index);
      } else if (last) {
        // A path that is also a directory prefix of another: keep it addressable as a file.
        nodes[index].file = true;
        nodes[index].pathIndex = pathIndex;
      }
      parent = index;
    }
  }
  return nodes;
}

export const childrenOf = (nodes) => {
  const kids = nodes.map(() => []);
  for (let i = 1; i < nodes.length; i++) kids[nodes[i].parent].push(i);
  return kids;
};

export const directoryIndices = (nodes) =>
  nodes.map((n, i) => (n.file ? -1 : i)).filter((i) => i >= 0);

/* ---------------------------------------------------------------- layout */

export const REST = 34;
export const DEFAULT_LAYOUT = {
  spring: 0.06, repel: 900, dirRepel: 4200, damping: 0.86,
  maxStep: 12, aspect: 1, wander: 0, wanderPhase: 0,
};

/** Seed on a SPHERE. Taking the polar angle uniformly crowds the poles, and the repulsion
 *  then spends hundreds of steps undoing two dense caps. */
export function seedLayout(nodes) {
  const n = nodes.length;
  const l = {
    x: new Float64Array(n), y: new Float64Array(n), z: new Float64Array(n),
    vx: new Float64Array(n), vy: new Float64Array(n), vz: new Float64Array(n),
    wx: new Float64Array(n), wy: new Float64Array(n), wz: new Float64Array(n),
    kids: childrenOf(nodes), dirs: directoryIndices(nodes), nodes, steps: 0,
  };
  for (let i = 1; i < n; i++) {
    const h = hash(nodes[i].id);
    const theta = ((h % 3600) / 3600) * Math.PI * 2;
    const phi = Math.acos(1 - 2 * ((((h >>> 12) % 1000) + 0.5) / 1000));
    const p = nodes[i].parent;
    l.x[i] = l.x[p] + REST * Math.sin(phi) * Math.cos(theta);
    l.y[i] = l.y[p] + REST * Math.cos(phi);
    l.z[i] = l.z[p] + REST * Math.sin(phi) * Math.sin(theta);
  }
  return l;
}

export function step(l, opts = {}) {
  l.steps++;
  const o = { ...DEFAULT_LAYOUT, ...opts };
  const { nodes, kids, dirs } = l;
  const n = nodes.length;

  // 1. Take the drift back out FIRST. From here to the end the coordinates are pure
  //    physics: leaving the sway in makes the springs push back against it. (Trap 8.7.)
  for (let i = 1; i < n; i++) { l.x[i] -= l.wx[i]; l.y[i] -= l.wy[i]; l.z[i] -= l.wz[i]; }

  const fx = new Float64Array(n), fy = new Float64Array(n), fz = new Float64Array(n);

  // Split the bias evenly around 1, so the total push is unchanged and only its direction
  // is biased — otherwise the graph inflates every time the canvas gets wider. Never
  // stretch depth: correct head-on and wrong from the side is worse than merely round.
  const kx = Math.sqrt(o.aspect), ky = 1 / kx;

  // 2. Springs to the parent.
  for (let i = 1; i < n; i++) {
    const p = nodes[i].parent;
    let dx = l.x[i] - l.x[p], dy = l.y[i] - l.y[p], dz = l.z[i] - l.z[p];
    let d = Math.hypot(dx, dy, dz);
    if (d < 1e-6) {
      // The direction is undefined; pick a stable one from the hash rather than dividing
      // by zero and poisoning every later frame with NaN.
      const h = hash(nodes[i].id);
      dx = Math.cos(h % 628 / 100); dy = Math.sin(h % 628 / 100); dz = Math.cos(h % 314 / 100);
      d = Math.hypot(dx, dy, dz);
    }
    const f = (d - REST) * o.spring;
    const ux = dx / d * f, uy = dy / d * f, uz = dz / d * f;
    fx[i] -= ux; fy[i] -= uy; fz[i] -= uz;
    fx[p] += ux; fy[p] += uy; fz[p] += uz;
  }

  const repelPair = (i, j, strength) => {
    let dx = l.x[i] - l.x[j], dy = l.y[i] - l.y[j], dz = l.z[i] - l.z[j];
    let d2 = dx * dx + dy * dy + dz * dz;
    if (d2 < 1e-4) { dx = ((i * 37) % 7) - 3; dy = ((j * 17) % 7) - 3; dz = ((i + j) % 7) - 3; d2 = dx * dx + dy * dy + dz * dz || 1; }
    const d = Math.sqrt(d2);
    const f = strength / d2;
    const ux = dx / d * f * kx, uy = dy / d * f * ky, uz = dz / d * f;
    fx[i] += ux; fy[i] += uy; fz[i] += uz;
    fx[j] -= ux; fy[j] -= uy; fz[j] -= uz;
  };

  // 3. Sibling repulsion, over each parent's child list.
  for (const group of kids) {
    for (let a = 0; a < group.length; a++)
      for (let b = a + 1; b < group.length; b++) repelPair(group[a], group[b], o.repel);
  }
  // 4. Directory repulsion, same kernel at longer range, over the whole tree.
  for (let a = 0; a < dirs.length; a++)
    for (let b = a + 1; b < dirs.length; b++) repelPair(dirs[a], dirs[b], o.dirRepel);

  // 5. Integrate, damp, then clamp speed. A node pushed hard must not teleport across the
  //    graph in one frame: it would fly past everything holding it in place.
  for (let i = 1; i < n; i++) {
    l.vx[i] = (l.vx[i] + fx[i]) * o.damping;
    l.vy[i] = (l.vy[i] + fy[i]) * o.damping;
    l.vz[i] = (l.vz[i] + fz[i]) * o.damping;
    const sp = Math.hypot(l.vx[i], l.vy[i], l.vz[i]);
    if (sp > o.maxStep) { const k = o.maxStep / sp; l.vx[i] *= k; l.vy[i] *= k; l.vz[i] *= k; }
    l.x[i] += l.vx[i]; l.y[i] += l.vy[i]; l.z[i] += l.vz[i];
  }

  // 6. Pin the root. Something has to be pinned, or the whole graph slides off in whatever
  //    direction the forces happen not to cancel — indistinguishable from a bug.
  l.x[0] = l.y[0] = l.z[0] = 0;
  l.vx[0] = l.vy[0] = l.vz[0] = 0;

  // 7. Put the drift back on. A DISPLACEMENT, not a force: a force is only bounded if
  //    something pulls back, and the parent spring constrains distance, not position — the
  //    first version of this strayed 134 world units. (Trap 8.6.)
  for (let i = 1; i < n; i++) {
    const h = hash(nodes[i].id);
    // Each axis at its own rate and each node its own offset, so the graph never
    // synchronises into a single pulse — a shared phase reads as a glitch, not as life.
    const wx = o.wander * Math.sin(o.wanderPhase * 0.83 + (h & 1023) * 0.00614);
    const wy = o.wander * Math.sin(o.wanderPhase * 1.00 + ((h >>> 10) & 1023) * 0.00614);
    const wz = o.wander * Math.sin(o.wanderPhase * 1.19 + ((h >>> 20) & 1023) * 0.00614);
    l.wx[i] = wx; l.wy[i] = wy; l.wz[i] = wz;
    l.x[i] += wx; l.y[i] += wy; l.z[i] += wz;
  }
  return l;
}

export const MIN_STEPS_BEFORE_SETTLED = 90;

/**
 * AVERAGE speed per node, so the threshold means the same for forty files and four hundred.
 *
 * The step floor is not belt-and-braces. A freshly seeded layout has every velocity at
 * exactly zero, so the energy test passes on the FIRST frame — before a single force has
 * run. The auto-framing then fits the seed cloud, marks itself done, and never refits, and
 * the graph spends the rest of its life drawn at a fraction of the canvas. Measured here:
 * the scene filled about 40% of the height until this floor went in.
 */
export function hasSettled(l) {
  if (l.steps < MIN_STEPS_BEFORE_SETTLED) return false;
  const n = l.nodes.length;
  let e = 0;
  for (let i = 0; i < n; i++) e += Math.abs(l.vx[i]) + Math.abs(l.vy[i]) + Math.abs(l.vz[i]);
  return e / n < 0.05;
}

export function boundingSphere(l) {
  const n = l.nodes.length;
  let cx = 0, cy = 0, cz = 0;
  for (let i = 0; i < n; i++) { cx += l.x[i]; cy += l.y[i]; cz += l.z[i]; }
  cx /= n; cy /= n; cz /= n;
  let r = 0;
  for (let i = 0; i < n; i++) r = Math.max(r, Math.hypot(l.x[i] - cx, l.y[i] - cy, l.z[i] - cz));
  return { x: cx, y: cy, z: cz, r: Math.max(1, r) };
}

/* -------------------------------------------------------- playhead & heat */

export const SWEEP_MS = 75_000;
export const DECAY_MS = 14_000;

/**
 * Which files are lit, and how brightly. `atMs` is MILLISECONDS; the log is in unix
 * SECONDS. Mixing them puts the playhead in 1970 or the year 57000, and both look like a
 * broken animation rather than a unit error — so the conversion happens here, once, at the
 * boundary. (Trap 8.1.)
 */
export function heatAt(log, atMs, decayMs = DECAY_MS) {
  const out = new Map();
  for (const e of log.events) {
    const ms = e.t * 1000;
    if (ms > atMs) break;                 // relies on events being sorted ascending
    if (ms < atMs - decayMs) continue;
    const heat = 1 - (atMs - ms) / decayMs;
    for (const [p, action] of e.f) {
      const prev = out.get(p);
      if (!prev || heat > prev.heat) out.set(p, { heat, action, author: e.a });
    }
  }
  return out;
}

/**
 * The set of paths that exist as of the playhead. Computed BACKWARDS from HEAD: replaying
 * forwards would mean starting from the tree at the beginning of the window, which the log
 * does not record. `alive` does record HEAD, so undo everything after the playhead instead.
 */
export function livePaths(log, atMs) {
  const live = new Set();
  for (let i = 0; i < log.alive.length; i++) if (log.alive[i]) live.add(i);
  for (let i = log.events.length - 1; i >= 0; i--) {
    if (log.events[i].t * 1000 <= atMs) break;
    for (const [p, action] of log.events[i].f) {
      if (action === 'A') live.delete(p);
      else if (action === 'D') live.add(p);
    }
  }
  return live;
}

/** Index of the commit the playhead is standing on. */
export function commitIndexAt(log, atMs) {
  let lo = 0, hi = log.events.length - 1, best = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (log.events[mid].t * 1000 <= atMs) { best = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return best;
}

/**
 * The activity histogram behind the scrubber. Evenly spaced ticks would only repeat what
 * the caption says; the volume in each bucket turns the track into a map of when the work
 * actually happened.
 */
export function timelineMarks(log, startMs, endMs, buckets = 120) {
  const span = Math.max(1, endMs - startMs);
  const commits = new Int32Array(buckets), edits = new Int32Array(buckets);
  for (const e of log.events) {
    const ms = e.t * 1000;
    if (ms < startMs || ms > endMs) continue;
    // Clamped: a commit exactly at endMs indexes one past the last bucket, which in a
    // typed array is a silent no-op write — the commit simply vanishes from the strip.
    const b = Math.min(buckets - 1, Math.floor(((ms - startMs) / span) * buckets));
    commits[b]++; edits[b] += e.f.length;
  }
  const out = [];
  // Drop empty buckets rather than returning zeros: a quiet fortnight would otherwise
  // carry a hundred marks of height nothing, each one a DOM node.
  for (let b = 0; b < buckets; b++)
    if (commits[b]) out.push({ at: (b + 0.5) / buckets, commits: commits[b], edits: edits[b] });
  return out;
}
