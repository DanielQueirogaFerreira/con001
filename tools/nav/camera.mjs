// The camera: a quaternion trackball, a matrix-free projection, and the two clamps that
// make "you cannot get lost" a guarantee rather than a hope.
//
// Written from scratch rather than on a 3D library, per the spec: what is needed is one
// projection and a camera that turns, which is small enough to read and — the part that
// matters here — testable without a GPU or a canvas.
//
// Implements CODEBASE-VIEWER-SPEC.md §6.1.

/* ------------------------------------------------------------- quaternions */

export const quatFromAxisAngle = (axis, angle) => {
  const h = angle / 2, s = Math.sin(h);
  return { x: axis.x * s, y: axis.y * s, z: axis.z * s, w: Math.cos(h) };
};

export const quatMul = (a, b) => ({
  w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
  y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
  z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
});

/**
 * Renormalise EVERY frame. A thousand small multiplications drift off the unit sphere, and
 * a non-unit quaternion scales the whole scene a little more with every frame of dragging —
 * which looks like a zoom nobody asked for. (Trap 8.2.)
 */
export const quatNormalize = (q) => {
  const n = Math.hypot(q.x, q.y, q.z, q.w) || 1;
  return { x: q.x / n, y: q.y / n, z: q.z / n, w: q.w / n };
};

export const IDENTITY = { x: 0, y: 0, z: 0, w: 1 };

/** v' = v + w·t + q.xyz × t, where t = 2·(q.xyz × v). No matrices anywhere. */
export function rotate(q, v) {
  const tx = 2 * (q.y * v.z - q.z * v.y);
  const ty = 2 * (q.z * v.x - q.x * v.z);
  const tz = 2 * (q.x * v.y - q.y * v.x);
  return {
    x: v.x + q.w * tx + q.y * tz - q.z * ty,
    y: v.y + q.w * ty + q.z * tx - q.x * tz,
    z: v.z + q.w * tz + q.x * ty - q.y * tx,
  };
}

export const basis = (cam) => ({
  right: rotate(cam.orientation, { x: 1, y: 0, z: 0 }),
  up: rotate(cam.orientation, { x: 0, y: 1, z: 0 }),
  forward: rotate(cam.orientation, { x: 0, y: 0, z: -1 }),
});

export function eyeOf(cam) {
  const { forward } = basis(cam);
  return {
    x: cam.target.x - forward.x * cam.distance,
    y: cam.target.y - forward.y * cam.distance,
    z: cam.target.z - forward.z * cam.distance,
  };
}

/* -------------------------------------------------------------- the camera */

export const MIN_DISTANCE = 40;
export const MAX_DISTANCE = 12000;
export const clampDistance = (d) => Math.min(MAX_DISTANCE, Math.max(MIN_DISTANCE, d));

export const DEFAULT_CAMERA = {
  // Not identity. A graph first seen face-on looks flat, and the whole point of this view
  // is that it is not — a slight three-quarter angle shows the depth immediately.
  orientation: quatNormalize(quatMul(
    quatFromAxisAngle({ x: 0, y: 1, z: 0 }, 0.6),
    quatFromAxisAngle({ x: 1, y: 0, z: 0 }, -0.32))),
  distance: 900,
  target: { x: 0, y: 0, z: 0 },
  fov: Math.PI / 4,
};

// The three named views re-orient someone who is lost WITHOUT moving the orbit centre, so
// they do not also throw away the thing that was centred.
export const VIEWS = {
  front: IDENTITY,
  side: quatFromAxisAngle({ x: 0, y: 1, z: 0 }, Math.PI / 2),
  top: quatFromAxisAngle({ x: 1, y: 0, z: 0 }, -Math.PI / 2),
};

/**
 * Post-multiply by rotations about the camera's OWN axes: orientation × yaw × pitch.
 * Pre-multiplying applies the rotation in world space and reintroduces exactly the pole
 * the quaternion was chosen to avoid.
 */
export function orbit(cam, dxPx, dyPx, speed = 0.005) {
  const yaw = quatFromAxisAngle({ x: 0, y: 1, z: 0 }, dxPx * speed);
  // Negated: drag down tips the top of the graph toward you.
  const pitch = quatFromAxisAngle({ x: 1, y: 0, z: 0 }, -dyPx * speed);
  return { ...cam, orientation: quatNormalize(quatMul(quatMul(cam.orientation, yaw), pitch)) };
}

/** Panning moves the TARGET, not the eye — that is what makes it feel like moving the object. */
export function pan(cam, dxPx, dyPx, h) {
  const { right, up } = basis(cam);
  // Scaled by distance, or it is unusably slow zoomed out and jumps across the graph in.
  const perPixel = (2 * Math.tan(cam.fov / 2) * cam.distance) / Math.max(1, h);
  return {
    ...cam,
    target: {
      x: cam.target.x + right.x * -dxPx * perPixel + up.x * dyPx * perPixel,
      y: cam.target.y + right.y * -dxPx * perPixel + up.y * dyPx * perPixel,
      z: cam.target.z + right.z * -dxPx * perPixel + up.z * dyPx * perPixel,
    },
  };
}

/** Multiplicative, so every wheel notch feels the same at any distance. */
export const zoom = (cam, notches) =>
  ({ ...cam, distance: clampDistance(cam.distance * Math.pow(1.12, notches)) });

export const NEAR = 1;

/**
 * The `visible: false` branch is not defensive tidiness. Projecting a point behind the eye
 * divides by roughly zero and throws it to infinity — or worse, mirrors it into the visible
 * half where it looks like a real node in the wrong place.
 */
export function project(p, cam, w, h) {
  const { right, up, forward } = basis(cam);
  const eye = eyeOf(cam);
  const vx = p.x - eye.x, vy = p.y - eye.y, vz = p.z - eye.z;
  const depth = vx * forward.x + vy * forward.y + vz * forward.z;
  if (!(depth > NEAR)) return { x: 0, y: 0, depth, scale: 0, visible: false };
  const sx = vx * right.x + vy * right.y + vz * right.z;
  const sy = vx * up.x + vy * up.y + vz * up.z;
  const scale = (h / 2) / Math.tan(cam.fov / 2) / depth;
  // Screen y grows downward; the camera's up axis grows up.
  return { x: w / 2 + sx * scale, y: h / 2 - sy * scale, depth, scale, visible: true };
}

/**
 * Fit the bounding SPHERE, not a box. The camera can be anywhere, and a box fitted from
 * one angle crops from another.
 */
export function frameSphere(cam, centre, radius, w, h, margin = 1.02) {
  const r = Math.max(1, radius) * margin;
  const vFov = cam.fov;
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * (Math.max(1, w) / Math.max(1, h)));
  return {
    ...cam,
    target: { ...centre },
    distance: clampDistance(Math.max(r / Math.sin(vFov / 2), r / Math.sin(hFov / 2))),
  };
}

/**
 * Keep the orbit centre inside the bounding sphere. Free and unbounded are not the same
 * thing: panning has no natural end, and a few seconds of it puts the centre out in empty
 * space with the graph off screen and no cue for which way to drag back. The radius is
 * exactly the bounding radius — an earlier 2.2× allowance still lost the graph. (Trap 8.4.)
 */
export function clampTarget(cam, centre, maxDistance) {
  const dx = cam.target.x - centre.x, dy = cam.target.y - centre.y, dz = cam.target.z - centre.z;
  const d = Math.hypot(dx, dy, dz);
  const max = Math.max(1, maxDistance);
  if (d <= max) return cam;
  const k = max / d;
  return { ...cam, target: { x: centre.x + dx * k, y: centre.y + dy * k, z: centre.z + dz * k } };
}

/** Look at a node without changing how far away or which way up you are. */
export const focusOn = (cam, point) => ({ ...cam, target: { ...point } });
