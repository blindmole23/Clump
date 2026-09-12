import 'dart:math';

import 'sim_state.dart';
import 'tuning.dart';

/// One position-based-dynamics step: Verlet integration, iterative bond
/// constraint solving with break/reform, sphere containment, per-particle
/// idle-clock magnetic homing, and grab-follow for whatever's currently
/// held. Mirrors the shape of the original web prototype's solver, rebuilt
/// fresh in Dart rather than translated line-for-line.
void stepPhysics(SimState s, double dt, {Tuning tuning = defaultTuning}) {
  _integrate(s, dt, tuning);
  _applyGrab(s, tuning);
  _solveBonds(s, dt, tuning);
  _containSphere(s, playRadius);
  _magneticHoming(s, dt, tuning);

  for (var i = 0; i < s.n; i++) {
    final held = s.grabWeight[i] > tuning.heldEps;
    s.idleFor[i] = held ? 0 : s.idleFor[i] + dt;
  }
}

const double _damping = 0.985;

void _integrate(SimState s, double dt, Tuning tuning) {
  final pos = s.pos, prev = s.prev, grabWeight = s.grabWeight;
  for (var i = 0; i < s.n; i++) {
    if (grabWeight[i] > tuning.heldEps) continue;
    final i3 = i * 3;
    for (var k = 0; k < 3; k++) {
      final v = (pos[i3 + k] - prev[i3 + k]) * _damping;
      prev[i3 + k] = pos[i3 + k];
      pos[i3 + k] = pos[i3 + k] + v;
    }
  }
}

void _applyGrab(SimState s, Tuning tuning) {
  final pos = s.pos, prev = s.prev, grabWeight = s.grabWeight, target = s.grabTarget;
  for (var i = 0; i < s.n; i++) {
    final w = grabWeight[i];
    if (w <= tuning.heldEps) continue;
    // The "clay pulling back" feel: the grabbed point doesn't snap straight
    // to the pointer, it eases toward it, more slowly the higher the
    // resistance and the lower this particle's falloff weight in the grab.
    final follow = (1 - tuning.dragResistance) * w;
    final i3 = i * 3;
    for (var k = 0; k < 3; k++) {
      final next = pos[i3 + k] + (target[i3 + k] - pos[i3 + k]) * follow;
      prev[i3 + k] = pos[i3 + k];
      pos[i3 + k] = next;
    }
  }
}

void _solveBonds(SimState s, double dt, Tuning tuning) {
  final pos = s.pos, grabWeight = s.grabWeight;
  final iterations = dt > 1 / 42 ? 4 : tuning.solverIterations;
  for (var iter = 0; iter < iterations; iter++) {
    for (final bond in s.bonds) {
      if (!bond.live) continue;
      final a3 = bond.a * 3, b3 = bond.b * 3;
      final dx = pos[b3] - pos[a3];
      final dy = pos[b3 + 1] - pos[a3 + 1];
      final dz = pos[b3 + 2] - pos[a3 + 2];
      final dist = sqrt(dx * dx + dy * dy + dz * dz);
      if (dist < 1e-6) continue;

      if (dist > tuning.bondBreakDist) {
        bond.live = false;
        bond.cooldown = tuning.bondReformDelay;
        continue;
      }

      final wA = grabWeight[bond.a] > tuning.heldEps ? 0.0 : 1.0;
      final wB = grabWeight[bond.b] > tuning.heldEps ? 0.0 : 1.0;
      final wSum = wA + wB;
      if (wSum == 0) continue;

      final diff = (dist - bond.restLength) / dist * tuning.bondStiffness;
      final nx = dx * diff, ny = dy * diff, nz = dz * diff;
      pos[a3] += nx * (wA / wSum);
      pos[a3 + 1] += ny * (wA / wSum);
      pos[a3 + 2] += nz * (wA / wSum);
      pos[b3] -= nx * (wB / wSum);
      pos[b3 + 1] -= ny * (wB / wSum);
      pos[b3 + 2] -= nz * (wB / wSum);
    }
  }

  // Cooldowns and reform checks, once per step (not per solver iteration).
  for (final bond in s.bonds) {
    if (bond.live) continue;
    if (bond.cooldown > 0) {
      bond.cooldown -= dt;
      continue;
    }
    final a3 = bond.a * 3, b3 = bond.b * 3;
    final dx = pos[b3] - pos[a3];
    final dy = pos[b3 + 1] - pos[a3 + 1];
    final dz = pos[b3 + 2] - pos[a3 + 2];
    final dist = sqrt(dx * dx + dy * dy + dz * dz);
    if (dist < tuning.bondReformDist) bond.live = true;
  }
}

/// Clamps every particle inside a single world-space sphere, the whole
/// simulation's one containment mechanism (mirrors PLAY_RADIUS on web).
void _containSphere(SimState s, double radius) {
  final pos = s.pos;
  for (var i = 0; i < s.n; i++) {
    final i3 = i * 3;
    final x = pos[i3], y = pos[i3 + 1], z = pos[i3 + 2];
    final d = sqrt(x * x + y * y + z * z);
    if (d <= radius || d < 1e-6) continue;
    final scale = radius / d;
    pos[i3] = x * scale;
    pos[i3 + 1] = y * scale;
    pos[i3 + 2] = z * scale;
  }
}

/// Hard-range, constant-speed homing for anything idle and not held: once
/// [Tuning.magnetDelay] seconds pass with no interaction, a particle within
/// [Tuning.magnetRange] of its rest slot creeps back at exactly
/// [Tuning.magnetSpeed] world units per second. Outside that range it holds
/// forever — this is not a spring.
void _magneticHoming(SimState s, double dt, Tuning tuning) {
  final pos = s.pos, rest = s.rest, grabWeight = s.grabWeight, idleFor = s.idleFor;
  final step = tuning.magnetSpeed * dt;
  for (var i = 0; i < s.n; i++) {
    if (grabWeight[i] > tuning.heldEps) continue;
    if (idleFor[i] < tuning.magnetDelay) continue;
    final i3 = i * 3;
    final dx = rest[i3] - pos[i3];
    final dy = rest[i3 + 1] - pos[i3 + 1];
    final dz = rest[i3 + 2] - pos[i3 + 2];
    final dist = sqrt(dx * dx + dy * dy + dz * dz);
    if (dist < 1e-6 || dist > tuning.magnetRange) continue;
    final move = min(step, dist);
    final scale = move / dist;
    pos[i3] += dx * scale;
    pos[i3 + 1] += dy * scale;
    pos[i3 + 2] += dz * scale;
  }
}
