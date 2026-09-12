import { DEFAULT_TUNING, VOXEL_SPACING } from "./constants";
import type { Bond, FidgetState, Tuning } from "./types";

// The Dev panel's sliders write here (via stepPhysics's `tuning` param,
// applied at the top of every step) rather than threading a tuning object
// through every helper function's signature individually. Safe because
// stepPhysics always runs start-to-finish before the next one begins — no
// re-entrancy, single-threaded JS.
let active: Tuning = DEFAULT_TUNING;

function isHeld(state: FidgetState, i: number): boolean {
  return state.grabWeight[i]! > active.heldEps;
}

export function buildBonds(rest: Float32Array, n: number): Bond[] {
  const bonds: Bond[] = [];
  const bucket = new Map<string, number>();
  const q = VOXEL_SPACING;
  // Round at double resolution (2x) rather than 1x. A shape with an even
  // edge length (an 8-wide cube, say) centers its grid on exact half-integer
  // multiples of the spacing — and Math.round(x/q) then sits exactly on a
  // .5 rounding knife-edge, where sub-ULP floating-point noise between the
  // additions used to look up a neighbor and the multiplication used to
  // place it can round to different integers and silently drop the bond.
  // Multiplying by 2 first turns every valid grid coordinate (integer or
  // half-integer) into an exact integer, giving a full 1.0 margin instead
  // of a knife-edge.
  const key = (x: number, y: number, z: number) =>
    `${Math.round((2 * x) / q)}|${Math.round((2 * y) / q)}|${Math.round((2 * z) / q)}`;

  for (let i = 0; i < n; i++) {
    bucket.set(key(rest[i * 3]!, rest[i * 3 + 1]!, rest[i * 3 + 2]!), i);
  }

  // Only the six forward-facing lattice directions are needed: every pair of
  // adjacent cells gets visited exactly once regardless of which one is "i".
  const dirs: [number, number, number][] = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
    [1, 1, 0],
    [1, 0, 1],
    [0, 1, 1],
  ];

  for (let i = 0; i < n; i++) {
    const x = rest[i * 3]!;
    const y = rest[i * 3 + 1]!;
    const z = rest[i * 3 + 2]!;
    for (const [dx, dy, dz] of dirs) {
      const j = bucket.get(key(x + dx * q, y + dy * q, z + dz * q));
      if (j == null) continue;
      const rx = rest[j * 3]! - x;
      const ry = rest[j * 3 + 1]! - y;
      const rz = rest[j * 3 + 2]! - z;
      bonds.push({ a: i, b: j, rest: Math.hypot(rx, ry, rz), live: 1, cooldown: 0 });
    }
  }
  return bonds;
}

const PALETTE = [
  [0.78, 0.42, 0.24],
  [0.7, 0.36, 0.2],
  [0.82, 0.5, 0.3],
  [0.64, 0.34, 0.22],
  [0.74, 0.46, 0.28],
  [0.6, 0.32, 0.2],
];

export function createState(rest: Float32Array): FidgetState {
  const n = rest.length / 3;
  const state: FidgetState = {
    n,
    pos: new Float32Array(rest),
    prev: new Float32Array(rest),
    rest,
    pulse: new Float32Array(n),
    strain: new Float32Array(n),
    grabWeight: new Float32Array(n),
    grabTarget: new Float32Array(rest),
    baseColor: new Float32Array(n * 3),
    idleFor: new Float32Array(n),
    bonds: buildBonds(rest, n),
  };
  paintPalette(state, PALETTE);
  return state;
}

function paintPalette(state: FidgetState, palette: number[][]) {
  for (let i = 0; i < state.n; i++) {
    const c = palette[i % palette.length]!;
    const jitter = ((i * 17) % 9) / 90;
    state.baseColor[i * 3] = c[0]! + jitter;
    state.baseColor[i * 3 + 1] = c[1]! + jitter * 0.4;
    state.baseColor[i * 3 + 2] = c[2]!;
  }
}

export function rematchRest(state: FidgetState, nextRest: Float32Array) {
  const n = state.n;
  const m = nextRest.length / 3;
  const newRest = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const j = i % Math.max(1, m);
    newRest[i * 3] = nextRest[j * 3]!;
    newRest[i * 3 + 1] = nextRest[j * 3 + 1]!;
    newRest[i * 3 + 2] = nextRest[j * 3 + 2]!;
  }
  state.rest.set(newRest);
  state.bonds = buildBonds(state.rest, n);
  state.idleFor.fill(0);
}

export function resetToRest(state: FidgetState) {
  state.pos.set(state.rest);
  state.prev.set(state.rest);
  state.pulse.fill(0);
  state.grabWeight.fill(0);
  state.idleFor.fill(0);
  for (const b of state.bonds) {
    b.live = 1;
    b.cooldown = 0;
  }
}

/**
 * Sphere: floaty mode's world-space play area (see PLAY_RADIUS).
 * Box: an enclosed axis-aligned box (Trough, Plane) — a floor at floorY, an
 * optional ceiling, and walls at +/-halfX and +/-halfZ. `bounce` is the
 * fraction of impact speed reflected back, so 0 is "sticks on contact" and
 * values near 1 are "keeps bouncing".
 */
export type Containment =
  | { kind: "sphere"; radius: number }
  | {
      kind: "box";
      halfX: number;
      halfZ: number;
      floorY: number;
      ceilY: number | null;
      bounce: number;
    };

export type StepParams = {
  dt: number;
  interacting: boolean;
  /** World units/s^2 applied along -Y to non-held particles. 0 = zero-g. */
  gravity: number;
  /** Idle group homing back to the main clump — a floaty-only concept. */
  magnetHoming: boolean;
  /**
   * Whether the drag-resistance spring and strain tinting pull toward the
   * shape's absolute spawn-time rest position. That's right for floaty mode,
   * where the clump always lives at the origin — but under gravity the whole
   * clump physically settles wherever it falls, so "distance from spawn
   * position" stops meaning "stretched" and starts meaning "wherever gravity
   * put it," fighting the fall instead of resisting a drag.
   */
  elasticHome: boolean;
  containment: Containment;
  /** Live-tunable bond/magnet parameters — see types.ts Tuning. */
  tuning: Tuning;
};

export type StepResult = {
  /** How many bonds reformed this step (drives the "click" sound). */
  snaps: number;
  /** True when more than one connected group of magnets currently exists. */
  hasDetached: boolean;
};

export function stepPhysics(state: FidgetState, p: StepParams): StepResult {
  active = p.tuning;
  const { n, pos, rest, strain, bonds } = state;
  const dt = p.dt;

  integrate(state, dt, p.interacting, p.gravity);

  // Which particles share a connected group with anything currently grabbed,
  // however loosely — drag resistance below must only ever touch material
  // actually attached to what you're dragging, never an unrelated group
  // sitting elsewhere that happens to also be ungrabbed right now.
  const preClusters = computeClusters(bonds, n);
  const inHeldGroup = groupMask(n, preClusters, (i) => isHeld(state, i));

  const { snaps } = solveBonds(state, dt, p.interacting && p.elasticHome, inHeldGroup);
  resolveOverlaps(state, active.packingDist);

  const clusters = computeClusters(bonds, n);
  if (p.magnetHoming) applyGroupMagneticPull(state, clusters, dt);
  applyContainment(state, p.containment);

  if (p.elasticHome) {
    const spacing = VOXEL_SPACING;
    for (let i = 0; i < n; i++) {
      const i3 = i * 3;
      const dx = pos[i3]! - rest[i3]!;
      const dy = pos[i3 + 1]! - rest[i3 + 1]!;
      const dz = pos[i3 + 2]! - rest[i3 + 2]!;
      strain[i] = Math.min(1, Math.hypot(dx, dy, dz) / (spacing * 3.2));
    }
  } else {
    strain.fill(0);
  }

  return { snaps, hasDetached: clusters.length > 1 };
}

function integrate(state: FidgetState, dt: number, interacting: boolean, gravity: number) {
  const { n, pos, prev, grabWeight, grabTarget, pulse, idleFor } = state;
  const friction = interacting ? 0.14 : 0.22;
  const damp = Math.pow(1 - friction, dt * 60);
  const gdt2 = gravity * dt * dt;
  for (let i = 0; i < n; i++) {
    const i3 = i * 3;
    if (isHeld(state, i)) {
      const t = 1 - Math.pow(1 - Math.min(1, grabWeight[i]!), dt * 28);
      pos[i3] = pos[i3]! + (grabTarget[i3]! - pos[i3]!) * t;
      pos[i3 + 1] = pos[i3 + 1]! + (grabTarget[i3 + 1]! - pos[i3 + 1]!) * t;
      pos[i3 + 2] = pos[i3 + 2]! + (grabTarget[i3 + 2]! - pos[i3 + 2]!) * t;
      // Keep prev glued to pos the whole time it's held. Otherwise prev is
      // stale from before the grab started, and the instant grabWeight drops
      // to 0 the very next integration step reads a "velocity" equal to the
      // ENTIRE grab displacement (not just one frame's worth) and flings the
      // particle off at that speed — the actual cause of released magnets
      // scattering violently instead of simply staying put.
      prev[i3] = pos[i3]!;
      prev[i3 + 1] = pos[i3 + 1]!;
      prev[i3 + 2] = pos[i3 + 2]!;
    } else {
      const vx = (pos[i3]! - prev[i3]!) * damp;
      const vy = (pos[i3 + 1]! - prev[i3 + 1]!) * damp - gdt2;
      const vz = (pos[i3 + 2]! - prev[i3 + 2]!) * damp;
      prev[i3] = pos[i3]!;
      prev[i3 + 1] = pos[i3 + 1]!;
      prev[i3 + 2] = pos[i3 + 2]!;
      pos[i3] = pos[i3]! + vx;
      pos[i3 + 1] = pos[i3 + 1]! + vy;
      pos[i3 + 2] = pos[i3 + 2]! + vz;
    }
    pulse[i] = pulse[i]! * Math.exp(-10 * dt);
    // Per-particle, not global: touching one group must never reset the
    // idle clock of an unrelated group sitting elsewhere on screen.
    idleFor[i] = isHeld(state, i) ? 0 : idleFor[i]! + dt;
  }
}

function groupMask(n: number, clusters: number[][], held: (i: number) => boolean): Uint8Array {
  const mask = new Uint8Array(n);
  for (const members of clusters) {
    if (members.some(held)) for (const i of members) mask[i] = 1;
  }
  return mask;
}

function solveBonds(
  state: FidgetState,
  dt: number,
  interacting: boolean,
  inHeldGroup: Uint8Array,
): { snaps: number } {
  const { pos, rest, bonds } = state;
  const iters = dt > 1 / 42 ? 4 : active.solverIterations;
  const stiff = active.bondStiffness;
  let snaps = 0;

  for (let iter = 0; iter < iters; iter++) {
    for (const bond of bonds) {
      const a3 = bond.a * 3;
      const b3 = bond.b * 3;
      const dx = pos[b3]! - pos[a3]!;
      const dy = pos[b3 + 1]! - pos[a3 + 1]!;
      const dz = pos[b3 + 2]! - pos[a3 + 2]!;
      const d = Math.hypot(dx, dy, dz);
      if (d < 1e-6) continue;

      if (bond.live) {
        // While both ends are under your finger (however loosely), the bond
        // between them must not break from ordinary drag lag — otherwise a
        // multi-block grab shears itself apart the moment its tightly-held
        // center outruns its loosely-held edges.
        const bothHeld = isHeld(state, bond.a) && isHeld(state, bond.b);
        if (d > active.bondBreakDist && !bothHeld) {
          bond.live = 0;
          bond.cooldown = active.bondReformDelay;
          continue;
        }
      } else {
        // Cooldown ticks once per frame, not once per solver sub-iteration.
        if (iter === 0 && bond.cooldown > 0) {
          bond.cooldown = Math.max(0, bond.cooldown - dt);
        }
        if (bond.cooldown <= 0 && d < active.bondReformDist) {
          bond.live = 1;
          snaps++;
        } else if (d < active.bondBreakDist) {
          // Still drifting near each other post-break: a gentle pull keeps
          // loose neighbors from wandering off before they're eligible to
          // reform, without the stiffness of a live bond.
          const pull = ((d - bond.rest) / d) * 0.12 * stiff;
          const wa = isHeld(state, bond.a) ? 0.15 : 0.5;
          const wb = isHeld(state, bond.b) ? 0.15 : 0.5;
          pos[a3] = pos[a3]! + dx * pull * wa;
          pos[a3 + 1] = pos[a3 + 1]! + dy * pull * wa;
          pos[a3 + 2] = pos[a3 + 2]! + dz * pull * wa;
          pos[b3] = pos[b3]! - dx * pull * wb;
          pos[b3 + 1] = pos[b3 + 1]! - dy * pull * wb;
          pos[b3 + 2] = pos[b3 + 2]! - dz * pull * wb;
          continue;
        } else {
          continue;
        }
      }

      const corr = ((d - bond.rest) / d) * stiff;
      const wa = isHeld(state, bond.a) ? 0.08 : 0.5;
      const wb = isHeld(state, bond.b) ? 0.08 : 0.5;
      pos[a3] = pos[a3]! + dx * corr * wa;
      pos[a3 + 1] = pos[a3 + 1]! + dy * corr * wa;
      pos[a3 + 2] = pos[a3 + 2]! + dz * corr * wa;
      pos[b3] = pos[b3]! - dx * corr * wb;
      pos[b3 + 1] = pos[b3 + 1]! - dy * corr * wb;
      pos[b3 + 2] = pos[b3 + 2]! - dz * corr * wb;
    }

    // The "clay" resistance spring only runs while you're actively dragging,
    // and only fades in fully on the last sub-iteration. Idle homing is a
    // completely separate, hard-range constant-speed pull (below), never a
    // spring, so it never touches this pass.
    const home = interacting ? active.dragResistance * (iter === iters - 1 ? 1 : 0.45) : 0;
    if (home > 0) {
      for (let i = 0; i < state.n; i++) {
        // Resistance is felt only by material actually attached to whatever
        // you're dragging — never by an unrelated group elsewhere, even
        // though it's equally "not grabbed" right now.
        if (isHeld(state, i) || !inHeldGroup[i]) continue;
        const i3 = i * 3;
        pos[i3] = pos[i3]! + (rest[i3]! - pos[i3]!) * home;
        pos[i3 + 1] = pos[i3 + 1]! + (rest[i3 + 1]! - pos[i3 + 1]!) * home;
        pos[i3 + 2] = pos[i3 + 2]! + (rest[i3 + 2]! - pos[i3 + 2]!) * home;
      }
    }
  }

  return { snaps };
}

/**
 * Which connected group (by currently-live bonds) each particle belongs to.
 * Union-find over the bond graph — cheap enough to run twice a physics step
 * at this particle count (a few thousand array ops for ~1500 bonds).
 */
export function computeClusters(bonds: Bond[], n: number): number[][] {
  const parent = new Int32Array(n);
  for (let i = 0; i < n; i++) parent[i] = i;
  const find = (x: number): number => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]!]!; // path halving
      x = parent[x]!;
    }
    return x;
  };
  for (const bond of bonds) {
    if (!bond.live) continue;
    const ra = find(bond.a);
    const rb = find(bond.b);
    if (ra !== rb) parent[ra] = rb;
  }
  const groups = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    let list = groups.get(root);
    if (!list) {
      list = [];
      groups.set(root, list);
    }
    list.push(i);
  }
  return [...groups.values()];
}

/**
 * Idle-only magnetic homing, done per connected group rather than per
 * particle. A pulled-off chunk is one entity: its "center" is the average
 * rest slot of whatever's still attached to it, and it either holds its
 * exact shape and position (out of magnet range, or someone in the group was
 * touched within the last MAGNET_DELAY seconds) or rigidly translates — the
 * same offset applied to every member, so the piece never deforms while
 * homing — toward closing that center's gap at MAGNET_SPEED per second. Past
 * MAGNET_RANGE it holds forever.
 */
export function applyGroupMagneticPull(state: FidgetState, clusters: number[][], dt: number) {
  const { pos, rest, idleFor } = state;
  const stepWorld = active.magnetSpeed * dt;

  for (const members of clusters) {
    let held = false;
    let minIdle = Infinity;
    let rcx = 0,
      rcy = 0,
      rcz = 0,
      ccx = 0,
      ccy = 0,
      ccz = 0;
    for (const i of members) {
      if (isHeld(state, i)) held = true;
      if (idleFor[i]! < minIdle) minIdle = idleFor[i]!;
      const i3 = i * 3;
      rcx += rest[i3]!;
      rcy += rest[i3 + 1]!;
      rcz += rest[i3 + 2]!;
      ccx += pos[i3]!;
      ccy += pos[i3 + 1]!;
      ccz += pos[i3 + 2]!;
    }
    if (held || minIdle < active.magnetDelay) continue;

    const m = members.length;
    const dx = rcx / m - ccx / m;
    const dy = rcy / m - ccy / m;
    const dz = rcz / m - ccz / m;
    const dist = Math.hypot(dx, dy, dz);
    if (dist < 1e-6 || dist > active.magnetRange) continue;

    const step = Math.min(dist, stepWorld);
    const inv = step / dist;
    const tx = dx * inv,
      ty = dy * inv,
      tz = dz * inv;
    for (const i of members) {
      const i3 = i * 3;
      pos[i3] = pos[i3]! + tx;
      pos[i3 + 1] = pos[i3 + 1]! + ty;
      pos[i3 + 2] = pos[i3 + 2]! + tz;
    }
  }
}

/**
 * The one and only containment mechanism: a world-space shape (sphere or
 * box) every particle is kept inside. No projection math, so nothing here
 * can ever be numerically unstable the way a screen-space clamp is at
 * grazing angles — it's a plain distance/bounds check.
 */
function applyContainment(state: FidgetState, c: Containment) {
  const { n, pos, prev } = state;
  if (c.kind === "sphere") {
    const limit2 = c.radius * c.radius;
    for (let i = 0; i < n; i++) {
      // A held block must never be yanked out of your hand.
      if (isHeld(state, i)) continue;
      const i3 = i * 3;
      const x = pos[i3]!;
      const y = pos[i3 + 1]!;
      const z = pos[i3 + 2]!;
      const d2 = x * x + y * y + z * z;
      if (d2 <= limit2) continue;
      const s = c.radius / Math.sqrt(d2);
      pos[i3] = x * s;
      pos[i3 + 1] = y * s;
      pos[i3 + 2] = z * s;
    }
    return;
  }

  for (let i = 0; i < n; i++) {
    if (isHeld(state, i)) continue;
    const i3 = i * 3;
    bounceAxis(pos, prev, i3, -c.halfX, c.halfX, c.bounce);
    bounceAxis(pos, prev, i3 + 1, c.floorY, c.ceilY ?? Infinity, c.bounce);
    bounceAxis(pos, prev, i3 + 2, -c.halfZ, c.halfZ, c.bounce);
  }
}

/** Clamp one axis of one particle to [lo, hi], reflecting its inferred
 * Verlet velocity (pos - prev) back by `bounce` so a wall/floor hit looks
 * like an impact rather than the particle just sticking dead in place. */
function bounceAxis(
  pos: Float32Array,
  prev: Float32Array,
  idx: number,
  lo: number,
  hi: number,
  bounce: number,
) {
  const p = pos[idx]!;
  if (p < lo) {
    const v = p - prev[idx]!;
    pos[idx] = lo;
    prev[idx] = lo + v * bounce;
  } else if (p > hi) {
    const v = p - prev[idx]!;
    pos[idx] = hi;
    prev[idx] = hi + v * bounce;
  }
}

function resolveOverlaps(state: FidgetState, minDist: number) {
  const { n, pos } = state;
  const cellSize = minDist;
  const buckets = new Map<number, number[]>();
  const hash = (ix: number, iy: number, iz: number) =>
    ((ix * 73856093) ^ (iy * 19349663) ^ (iz * 83492791)) | 0;
  const cellOf = (v: number) => Math.floor(v / cellSize);

  for (let i = 0; i < n; i++) {
    const h = hash(cellOf(pos[i * 3]!), cellOf(pos[i * 3 + 1]!), cellOf(pos[i * 3 + 2]!));
    let list = buckets.get(h);
    if (!list) {
      list = [];
      buckets.set(h, list);
    }
    list.push(i);
  }

  const offsets: [number, number, number][] = [];
  for (let ox = -1; ox <= 1; ox++)
    for (let oy = -1; oy <= 1; oy++) for (let oz = -1; oz <= 1; oz++) offsets.push([ox, oy, oz]);

  const min2 = minDist * minDist;
  for (let i = 0; i < n; i++) {
    const x = pos[i * 3]!;
    const y = pos[i * 3 + 1]!;
    const z = pos[i * 3 + 2]!;
    const ix = cellOf(x);
    const iy = cellOf(y);
    const iz = cellOf(z);
    for (const [ox, oy, oz] of offsets) {
      const list = buckets.get(hash(ix + ox, iy + oy, iz + oz));
      if (!list) continue;
      for (const j of list) {
        if (j <= i) continue;
        const dx = pos[j * 3]! - x;
        const dy = pos[j * 3 + 1]! - y;
        const dz = pos[j * 3 + 2]! - z;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 > min2 || d2 < 1e-10) continue;
        const d = Math.sqrt(d2);
        const push = (minDist - d) / d;
        const nx = dx * push;
        const ny = dy * push;
        const nz = dz * push;
        const ga = isHeld(state, i);
        const gb = isHeld(state, j);
        const wa = ga && !gb ? 0 : gb && !ga ? 1 : 0.5;
        const wb = 1 - wa;
        pos[i * 3] = pos[i * 3]! - nx * wa;
        pos[i * 3 + 1] = pos[i * 3 + 1]! - ny * wa;
        pos[i * 3 + 2] = pos[i * 3 + 2]! - nz * wa;
        pos[j * 3] = pos[j * 3]! + nx * wb;
        pos[j * 3 + 1] = pos[j * 3 + 1]! + ny * wb;
        pos[j * 3 + 2] = pos[j * 3 + 2]! + nz * wb;
      }
    }
  }
}

export function applyImpulse(
  state: FidgetState,
  origin: [number, number, number],
  dir: [number, number, number],
  radius: number,
  strength: number,
  radial = 0.45,
) {
  const { n, pos, prev, pulse } = state;
  const [ox, oy, oz] = origin;
  const [dx, dy, dz] = dir;
  for (let i = 0; i < n; i++) {
    const i3 = i * 3;
    const px = pos[i3]! - ox;
    const py = pos[i3 + 1]! - oy;
    const pz = pos[i3 + 2]! - oz;
    const along = px * dx + py * dy + pz * dz;
    if (along < -0.2) continue;
    const qx = px - dx * along;
    const qy = py - dy * along;
    const qz = pz - dz * along;
    const d = Math.hypot(qx, qy, qz);
    if (d > radius) continue;
    const w = 1 - d / radius;
    const kick = strength * w * w;
    prev[i3] = prev[i3]! - dx * kick;
    prev[i3 + 1] = prev[i3 + 1]! - dy * kick;
    prev[i3 + 2] = prev[i3 + 2]! - dz * kick;
    if (d > 1e-4 && radial) {
      const inv = (radial * kick) / d;
      prev[i3] = prev[i3]! - qx * inv;
      prev[i3 + 1] = prev[i3 + 1]! - qy * inv;
      prev[i3 + 2] = prev[i3 + 2]! - qz * inv;
    }
    pulse[i] = Math.min(1, pulse[i]! + w);
  }
}

/**
 * Punches a hard-edged cylindrical hole through the clump along a ray — a
 * binary radius cutoff, not a falloff, so the hole has a clean wall instead
 * of tapering back to full density. Any particle inside the cylinder is
 * snapped straight to just outside it (with a little residual outward
 * velocity for a "kicked clear" feel) rather than nudged proportionally, so
 * dragging the ray through the clump reads as cutting a tunnel rather than
 * denting it.
 */
export function carveHole(
  state: FidgetState,
  origin: [number, number, number],
  dir: [number, number, number],
  radius: number,
) {
  const { n, pos, prev, pulse, bonds } = state;
  const [ox, oy, oz] = origin;
  const [dx, dy, dz] = dir;
  const inHole = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const i3 = i * 3;
    const px = pos[i3]! - ox;
    const py = pos[i3 + 1]! - oy;
    const pz = pos[i3 + 2]! - oz;
    const along = px * dx + py * dy + pz * dz;
    if (along < -0.2) continue;
    const qx = px - dx * along;
    const qy = py - dy * along;
    const qz = pz - dz * along;
    const d = Math.hypot(qx, qy, qz);
    if (d >= radius) continue;
    inHole[i] = 1;
    if (d < 1e-5) continue;
    // Push well clear of the boundary, not just barely past it — the cut
    // material is severed from its neighbors below, so nothing pulls it back
    // and it needs to actually separate visibly, not just nudge aside and
    // sit flush against the tunnel wall.
    const push = (radius * 2.6 - d) / d;
    pos[i3] = pos[i3]! + qx * push;
    pos[i3 + 1] = pos[i3 + 1]! + qy * push;
    pos[i3 + 2] = pos[i3 + 2]! + qz * push;
    prev[i3] = prev[i3]! + qx * push * 0.6;
    prev[i3 + 1] = prev[i3 + 1]! + qy * push * 0.6;
    prev[i3 + 2] = prev[i3 + 2]! + qz * push * 0.6;
    pulse[i] = 1;
  }
  // "Split the mass": a cut severs connections outright. Just relocating the
  // punched-out material isn't enough — its displacement is usually well
  // under BOND_BREAK_DIST, so without this the ordinary elastic bond
  // correction would pull it right back and heal the hole within a few
  // frames instead of leaving a lasting cut.
  for (const bond of bonds) {
    if (bond.live && (inHole[bond.a] || inHole[bond.b])) {
      bond.live = 0;
      bond.cooldown = active.bondReformDelay;
    }
  }
}

/**
 * Scrapes a flat blade edge (like a credit card) across the clump: a
 * rectangular strip — `halfLength` long each way along `bladeAxis`, capped
 * to `thickness` in the perpendicular sweep direction — rather than the
 * circular area applyPlaneSmear used. `bladeAxis` and `normal` should be
 * mutually perpendicular unit vectors.
 */
export function applyLineSmear(
  state: FidgetState,
  point: [number, number, number],
  normal: [number, number, number],
  bladeAxis: [number, number, number],
  smear: [number, number, number],
  halfLength: number,
  thickness: number,
  flatten: number,
) {
  const { n, pos, grabWeight } = state;
  const [px, py, pz] = point;
  const [nx, ny, nz] = normal;
  const [bx, by, bz] = bladeAxis;
  const [sx, sy, sz] = smear;
  for (let i = 0; i < n; i++) {
    if (grabWeight[i]! > active.heldEps) continue;
    const i3 = i * 3;
    const dx = pos[i3]! - px;
    const dy = pos[i3 + 1]! - py;
    const dz = pos[i3 + 2]! - pz;
    const along = dx * bx + dy * by + dz * bz;
    if (Math.abs(along) > halfLength) continue;
    const distN = dx * nx + dy * ny + dz * nz;
    // Perpendicular in-plane distance from the blade's centerline: strip out
    // both the along-blade and along-normal components, what's left is the
    // sweep-direction offset.
    const perpX = dx - bx * along - nx * distN;
    const perpY = dy - by * along - ny * distN;
    const perpZ = dz - bz * along - nz * distN;
    const perp = Math.hypot(perpX, perpY, perpZ);
    if (perp > thickness) continue;
    const w = 1 - perp / thickness;
    pos[i3] = pos[i3]! - nx * distN * flatten * w + sx * w;
    pos[i3 + 1] = pos[i3 + 1]! - ny * distN * flatten * w + sy * w;
    pos[i3 + 2] = pos[i3 + 2]! - nz * distN * flatten * w + sz * w;
  }
}

export function applyScoop(
  state: FidgetState,
  center: [number, number, number],
  camDir: [number, number, number],
  radius: number,
  strength: number,
) {
  const { n, pos, grabWeight } = state;
  const [cx, cy, cz] = center;
  const [dx, dy, dz] = camDir;
  const ring = radius * 0.72;
  for (let i = 0; i < n; i++) {
    if (grabWeight[i]! > active.heldEps) continue;
    const i3 = i * 3;
    const px = pos[i3]! - cx;
    const py = pos[i3 + 1]! - cy;
    const pz = pos[i3 + 2]! - cz;
    const d = Math.hypot(px, py, pz);
    if (d > radius) continue;
    const w = 1 - d / radius;
    pos[i3] = pos[i3]! + dx * strength * w;
    pos[i3 + 1] = pos[i3 + 1]! + dy * strength * w;
    pos[i3 + 2] = pos[i3 + 2]! + dz * strength * w;
    if (d > 1e-4) {
      const k = ((ring - d) / d) * 0.18 * w;
      pos[i3] = pos[i3]! + px * k;
      pos[i3 + 1] = pos[i3 + 1]! + py * k;
      pos[i3 + 2] = pos[i3 + 2]! + pz * k;
    }
  }
}

export function closestToRay(
  state: FidgetState,
  origin: [number, number, number],
  dir: [number, number, number],
  maxPerp = 0.55,
): { index: number; point: [number, number, number]; along: number } | null {
  const { n, pos } = state;
  const [ox, oy, oz] = origin;
  const [dx, dy, dz] = dir;
  let best = -1;
  let bestD = maxPerp;
  let bestAlong = 0;
  for (let i = 0; i < n; i++) {
    const px = pos[i * 3]! - ox;
    const py = pos[i * 3 + 1]! - oy;
    const pz = pos[i * 3 + 2]! - oz;
    const along = px * dx + py * dy + pz * dz;
    if (along < 0) continue;
    const qx = px - dx * along;
    const qy = py - dy * along;
    const qz = pz - dz * along;
    const d = Math.hypot(qx, qy, qz);
    if (d < bestD) {
      bestD = d;
      best = i;
      bestAlong = along;
    }
  }
  if (best < 0) return null;
  return {
    index: best,
    along: bestAlong,
    point: [origin[0] + dir[0] * bestAlong, origin[1] + dir[1] * bestAlong, origin[2] + dir[2] * bestAlong],
  };
}

export function collectGrab(
  state: FidgetState,
  point: [number, number, number],
  radius: number,
): { indices: number[]; weights: number[] } {
  const { n, pos } = state;
  const indices: number[] = [];
  const weights: number[] = [];
  const [px, py, pz] = point;
  const r2 = radius * radius;
  for (let i = 0; i < n; i++) {
    const dx = pos[i * 3]! - px;
    const dy = pos[i * 3 + 1]! - py;
    const dz = pos[i * 3 + 2]! - pz;
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 > r2) continue;
    const d = Math.sqrt(d2);
    indices.push(i);
    weights.push(1 - d / radius);
  }
  return { indices, weights };
}
