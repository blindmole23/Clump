import {
  BOND_STIFFNESS,
  GRAB_HELD_EPS,
  HOME_ACTIVE,
  MAGNET_BREAK,
  MAGNET_DELAY,
  MAGNET_PULL_SPEED,
  MAGNET_RANGE_BLOCKS,
  MAGNET_REFORM,
  OVERLAP,
  PBD_ITERS,
  REFORM_DELAY,
  VOXEL_SPACING,
} from "./constants";
import type { Bond, FidgetState } from "./types";

const TMP = {
  nx: 0,
  ny: 0,
  nz: 0,
};

export function buildBonds(rest: Float32Array, n: number): Bond[] {
  const bonds: Bond[] = [];
  const bucket = new Map<string, number>();
  const q = VOXEL_SPACING;
  const key = (x: number, y: number, z: number) =>
    `${Math.round(x / q)}|${Math.round(y / q)}|${Math.round(z / q)}`;

  for (let i = 0; i < n; i++) {
    bucket.set(key(rest[i * 3]!, rest[i * 3 + 1]!, rest[i * 3 + 2]!), i);
  }

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
      if (j == null || j <= i) continue;
      const rx = rest[j * 3]! - x;
      const ry = rest[j * 3 + 1]! - y;
      const rz = rest[j * 3 + 2]! - z;
      const restLen = Math.hypot(rx, ry, rz);
      bonds.push({ a: i, b: j, rest: restLen, live: 1, cooldown: 0 });
    }
  }
  return bonds;
}

export function createState(rest: Float32Array): FidgetState {
  const n = rest.length / 3;
  const pos = new Float32Array(rest);
  const prev = new Float32Array(rest);
  const grabTarget = new Float32Array(rest);
  const grabWeight = new Float32Array(n);
  const pulse = new Float32Array(n);
  const strain = new Float32Array(n);
  const baseColor = new Float32Array(n * 3);
  const idleFor = new Float32Array(n);

  const clay = [
    [0.78, 0.42, 0.24],
    [0.7, 0.36, 0.2],
    [0.82, 0.5, 0.3],
    [0.64, 0.34, 0.22],
    [0.74, 0.46, 0.28],
    [0.6, 0.32, 0.2],
  ];
  for (let i = 0; i < n; i++) {
    const c = clay[i % clay.length]!;
    const jitter = ((i * 17) % 9) / 90;
    baseColor[i * 3] = c[0]! + jitter;
    baseColor[i * 3 + 1] = c[1]! + jitter * 0.4;
    baseColor[i * 3 + 2] = c[2]!;
  }

  return {
    n,
    pos,
    prev,
    rest,
    pulse,
    strain,
    grabWeight,
    grabTarget,
    baseColor,
    idleFor,
    bonds: buildBonds(rest, n),
  };
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

export type StepParams = {
  dt: number;
  interacting: boolean;
  worldRadius: number;
  reducedMotion: boolean;
};

export type StepResult = {
  /** How many bonds reformed this step (drives the "click" sound). */
  snaps: number;
  /** True when more than one connected group of magnets currently exists. */
  hasDetached: boolean;
};

export function stepPhysics(state: FidgetState, p: StepParams): StepResult {
  const {
    n,
    pos,
    prev,
    rest,
    grabWeight,
    grabTarget,
    pulse,
    strain,
    bonds,
    idleFor,
  } = state;
  const dt = p.dt;
  const spacing = VOXEL_SPACING;
  // The "clay" resistance spring only runs while you're actively dragging.
  // Idle homing is handled separately below as a hard-range, constant-speed
  // magnetic pull instead of a spring, so it never applies here.
  const home = p.interacting ? HOME_ACTIVE : 0;
  const friction = p.interacting ? 0.14 : 0.22;
  const damp = Math.pow(1 - friction, dt * 60);

  for (let i = 0; i < n; i++) {
    const i3 = i * 3;
    const gx = grabWeight[i]!;
    if (gx > 0.02) {
      const t = 1 - Math.pow(1 - Math.min(1, gx), dt * 28);
      pos[i3] = pos[i3]! + (grabTarget[i3]! - pos[i3]!) * t;
      pos[i3 + 1] = pos[i3 + 1]! + (grabTarget[i3 + 1]! - pos[i3 + 1]!) * t;
      pos[i3 + 2] = pos[i3 + 2]! + (grabTarget[i3 + 2]! - pos[i3 + 2]!) * t;
    } else {
      let vx = (pos[i3]! - prev[i3]!) * damp;
      let vy = (pos[i3 + 1]! - prev[i3 + 1]!) * damp;
      let vz = (pos[i3 + 2]! - prev[i3 + 2]!) * damp;
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
    idleFor[i] = grabWeight[i]! > GRAB_HELD_EPS ? 0 : idleFor[i]! + dt;
  }

  // Which particles are in the same connected group as anything currently
  // grabbed, however loosely — the drag-resistance spring below must only
  // ever touch material actually attached to what you're dragging, never
  // an unrelated group sitting elsewhere that happens to also be ungrabbed.
  const preClusters = computeClusters(bonds, n);
  const inHeldGroup = new Uint8Array(n);
  for (const members of preClusters) {
    let held = false;
    for (const i of members) {
      if (grabWeight[i]! > GRAB_HELD_EPS) {
        held = true;
        break;
      }
    }
    if (held) for (const i of members) inHeldGroup[i] = 1;
  }

  const iters = dt > 1 / 42 ? 4 : PBD_ITERS;
  const stiff = BOND_STIFFNESS;
  const breakDist = MAGNET_BREAK * spacing;
  const reformDist = MAGNET_REFORM * spacing;
  let snaps = 0;

  for (let iter = 0; iter < iters; iter++) {
    for (let b = 0; b < bonds.length; b++) {
      const bond = bonds[b]!;
      const a3 = bond.a * 3;
      const b3 = bond.b * 3;
      let dx = pos[b3]! - pos[a3]!;
      let dy = pos[b3 + 1]! - pos[a3 + 1]!;
      let dz = pos[b3 + 2]! - pos[a3 + 2]!;
      let d = Math.hypot(dx, dy, dz);
      if (d < 1e-6) continue;

      if (bond.live) {
        // While both ends are under your finger (however loosely), the bond
        // between them must not break from ordinary drag lag — otherwise a
        // multi-block grab shears itself apart internally the moment the
        // tightly-held center outruns its loosely-held edges.
        const bothGrabbed =
          grabWeight[bond.a]! > GRAB_HELD_EPS && grabWeight[bond.b]! > GRAB_HELD_EPS;
        if (d > breakDist && !bothGrabbed) {
          bond.live = 0;
          bond.cooldown = REFORM_DELAY;
          continue;
        }
      } else {
        // Cooldown ticks once per frame, not once per PBD sub-iteration.
        if (iter === 0 && bond.cooldown > 0) {
          bond.cooldown = Math.max(0, bond.cooldown - dt);
        }
        if (bond.cooldown <= 0 && d < reformDist) {
          bond.live = 1;
          snaps++;
        } else {
          if (d < breakDist) {
            const pull = (d - bond.rest) / d * 0.12 * stiff;
            const wa = grabWeight[bond.a]! > 0.2 ? 0.15 : 0.5;
            const wb = grabWeight[bond.b]! > 0.2 ? 0.15 : 0.5;
            pos[a3] = pos[a3]! + dx * pull * wa;
            pos[a3 + 1] = pos[a3 + 1]! + dy * pull * wa;
            pos[a3 + 2] = pos[a3 + 2]! + dz * pull * wa;
            pos[b3] = pos[b3]! - dx * pull * wb;
            pos[b3 + 1] = pos[b3 + 1]! - dy * pull * wb;
            pos[b3 + 2] = pos[b3 + 2]! - dz * pull * wb;
          }
          continue;
        }
      }

      const corr = ((d - bond.rest) / d) * stiff;
      const wa = grabWeight[bond.a]! > 0.25 ? 0.08 : 0.5;
      const wb = grabWeight[bond.b]! > 0.25 ? 0.08 : 0.5;
      pos[a3] = pos[a3]! + dx * corr * wa;
      pos[a3 + 1] = pos[a3 + 1]! + dy * corr * wa;
      pos[a3 + 2] = pos[a3 + 2]! + dz * corr * wa;
      pos[b3] = pos[b3]! - dx * corr * wb;
      pos[b3 + 1] = pos[b3 + 1]! - dy * corr * wb;
      pos[b3 + 2] = pos[b3 + 2]! - dz * corr * wb;
    }

    const hk = home * (iter === iters - 1 ? 1 : 0.45);
    if (hk > 0) {
      for (let i = 0; i < n; i++) {
        // Resistance is felt only by material actually attached to whatever
        // you're dragging — never by an unrelated group elsewhere, even
        // though it's equally "not grabbed" and interacting is globally true.
        if (grabWeight[i]! > GRAB_HELD_EPS || !inHeldGroup[i]) continue;
        const i3 = i * 3;
        pos[i3] = pos[i3]! + (rest[i3]! - pos[i3]!) * hk;
        pos[i3 + 1] = pos[i3 + 1]! + (rest[i3 + 1]! - pos[i3 + 1]!) * hk;
        pos[i3 + 2] = pos[i3 + 2]! + (rest[i3 + 2]! - pos[i3 + 2]!) * hk;
      }
    }
  }

  resolveOverlaps(state, spacing * OVERLAP);

  const clusters = computeClusters(bonds, n);
  applyGroupMagneticPull(state, clusters, dt);

  const limit = p.worldRadius;
  const limit2 = limit * limit;
  for (let i = 0; i < n; i++) {
    const i3 = i * 3;
    const x = pos[i3]!;
    const y = pos[i3 + 1]!;
    const z = pos[i3 + 2]!;
    const d2 = x * x + y * y + z * z;
    // A held block must never be yanked out of your hand — only clamp what
    // isn't currently grabbed (matches the exemption the home-spring uses).
    if (d2 > limit2 && grabWeight[i]! <= GRAB_HELD_EPS) {
      const s = limit / Math.sqrt(d2);
      pos[i3] = x * s;
      pos[i3 + 1] = y * s;
      pos[i3 + 2] = z * s;
    }

    const dx = pos[i3]! - rest[i3]!;
    const dy = pos[i3 + 1]! - rest[i3 + 1]!;
    const dz = pos[i3 + 2]! - rest[i3 + 2]!;
    strain[i] = Math.min(1, Math.hypot(dx, dy, dz) / (spacing * 3.2));
  }

  return { snaps, hasDetached: clusters.length > 1 };
}

/**
 * Which connected group (by currently-live bonds) each particle belongs to.
 * Union-find over the bond graph — cheap enough to run every physics step
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
 * exact shape and position (out of magnet range, or someone in the group
 * was touched inside the last MAGNET_DELAY seconds) or rigidly translates
 * — same offset applied to every member, so the piece never deforms while
 * homing — toward closing that center's gap at MAGNET_PULL_SPEED
 * block-widths per second. Past MAGNET_RANGE_BLOCKS it holds forever.
 */
export function applyGroupMagneticPull(
  state: FidgetState,
  clusters: number[][],
  dt: number,
) {
  const { pos, rest, grabWeight, idleFor } = state;
  const rangeWorld = MAGNET_RANGE_BLOCKS * VOXEL_SPACING;
  const stepWorld = MAGNET_PULL_SPEED * VOXEL_SPACING * dt;

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
      if (grabWeight[i]! > GRAB_HELD_EPS) held = true;
      if (idleFor[i]! < minIdle) minIdle = idleFor[i]!;
      const i3 = i * 3;
      rcx += rest[i3]!;
      rcy += rest[i3 + 1]!;
      rcz += rest[i3 + 2]!;
      ccx += pos[i3]!;
      ccy += pos[i3 + 1]!;
      ccz += pos[i3 + 2]!;
    }
    if (held || minIdle < MAGNET_DELAY) continue;

    const m = members.length;
    const dx = rcx / m - ccx / m;
    const dy = rcy / m - ccy / m;
    const dz = rcz / m - ccz / m;
    const dist = Math.hypot(dx, dy, dz);
    if (dist < 1e-6 || dist > rangeWorld) continue;

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

function resolveOverlaps(state: FidgetState, minDist: number) {
  const { n, pos, grabWeight } = state;
  const cellSize = minDist;
  const buckets = new Map<number, number[]>();
  const hash = (x: number, y: number, z: number) => {
    const ix = Math.floor(x / cellSize);
    const iy = Math.floor(y / cellSize);
    const iz = Math.floor(z / cellSize);
    return ((ix * 73856093) ^ (iy * 19349663) ^ (iz * 83492791)) | 0;
  };

  for (let i = 0; i < n; i++) {
    const h = hash(pos[i * 3]!, pos[i * 3 + 1]!, pos[i * 3 + 2]!);
    let list = buckets.get(h);
    if (!list) {
      list = [];
      buckets.set(h, list);
    }
    list.push(i);
  }

  const offsets: [number, number, number][] = [];
  for (let ox = -1; ox <= 1; ox++) {
    for (let oy = -1; oy <= 1; oy++) {
      for (let oz = -1; oz <= 1; oz++) offsets.push([ox, oy, oz]);
    }
  }

  const min2 = minDist * minDist;
  for (let i = 0; i < n; i++) {
    const x = pos[i * 3]!;
    const y = pos[i * 3 + 1]!;
    const z = pos[i * 3 + 2]!;
    const ix = Math.floor(x / cellSize);
    const iy = Math.floor(y / cellSize);
    const iz = Math.floor(z / cellSize);
    for (const [ox, oy, oz] of offsets) {
      const list = buckets.get(
        ((ix + ox) * 73856093) ^ ((iy + oy) * 19349663) ^ ((iz + oz) * 83492791),
      );
      if (!list) continue;
      for (const j of list) {
        if (j <= i) continue;
        let dx = pos[j * 3]! - x;
        let dy = pos[j * 3 + 1]! - y;
        let dz = pos[j * 3 + 2]! - z;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 > min2 || d2 < 1e-10) continue;
        const d = Math.sqrt(d2);
        const push = (minDist - d) / d;
        TMP.nx = dx * push;
        TMP.ny = dy * push;
        TMP.nz = dz * push;
        const ga = grabWeight[i]! > 0.25;
        const gb = grabWeight[j]! > 0.25;
        const wa = ga && !gb ? 0 : gb && !ga ? 1 : 0.5;
        const wb = 1 - wa;
        pos[i * 3] = pos[i * 3]! - TMP.nx * wa;
        pos[i * 3 + 1] = pos[i * 3 + 1]! - TMP.ny * wa;
        pos[i * 3 + 2] = pos[i * 3 + 2]! - TMP.nz * wa;
        pos[j * 3] = pos[j * 3]! + TMP.nx * wb;
        pos[j * 3 + 1] = pos[j * 3 + 1]! + TMP.ny * wb;
        pos[j * 3 + 2] = pos[j * 3 + 2]! + TMP.nz * wb;
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

export function applyPlaneSmear(
  state: FidgetState,
  point: [number, number, number],
  normal: [number, number, number],
  smear: [number, number, number],
  radius: number,
  flatten: number,
) {
  const { n, pos, grabWeight } = state;
  const [px, py, pz] = point;
  const [nx, ny, nz] = normal;
  const [sx, sy, sz] = smear;
  for (let i = 0; i < n; i++) {
    if (grabWeight[i]! > 0.4) continue;
    const i3 = i * 3;
    const dx = pos[i3]! - px;
    const dy = pos[i3 + 1]! - py;
    const dz = pos[i3 + 2]! - pz;
    const d = Math.hypot(dx, dy, dz);
    if (d > radius) continue;
    const w = 1 - d / radius;
    const dist = dx * nx + dy * ny + dz * nz;
    pos[i3] = pos[i3]! - nx * dist * flatten * w + sx * w;
    pos[i3 + 1] = pos[i3 + 1]! - ny * dist * flatten * w + sy * w;
    pos[i3 + 2] = pos[i3 + 2]! - nz * dist * flatten * w + sz * w;
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
    if (grabWeight[i]! > 0.4) continue;
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
      const rd = d;
      const k = ((ring - rd) / rd) * 0.18 * w;
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
    point: [
      origin[0] + dir[0] * bestAlong,
      origin[1] + dir[1] * bestAlong,
      origin[2] + dir[2] * bestAlong,
    ],
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
