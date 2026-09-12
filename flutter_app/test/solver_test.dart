import 'dart:math';

import 'package:flutter_test/flutter_test.dart';
import 'package:clump/physics/shapes.dart';
import 'package:clump/physics/sim_state.dart';
import 'package:clump/physics/solver.dart';
import 'package:clump/physics/tuning.dart';

SimState buildTestCube(int size) {
  final rest = buildCubeRest(size);
  final n = size * size * size;
  final bonds = buildBonds(rest, n);
  return SimState(n: n, rest: rest, bonds: bonds);
}

bool allFinite(SimState s) {
  for (final v in s.pos) {
    if (v.isNaN || v.isInfinite) return false;
  }
  return true;
}

double distFromRest(SimState s, int i) {
  final i3 = i * 3;
  final dx = s.pos[i3] - s.rest[i3];
  final dy = s.pos[i3 + 1] - s.rest[i3 + 1];
  final dz = s.pos[i3 + 2] - s.rest[i3 + 2];
  return sqrt(dx * dx + dy * dy + dz * dz);
}

void main() {
  test('buildCubeRest produces the right particle count and spacing', () {
    final rest = buildCubeRest(4);
    expect(rest.length, 4 * 4 * 4 * 3);
    // buildCubeRest iterates x outer, y middle, z fastest, so consecutive
    // indices are neighbors along Z; index `size*size` steps one along X.
    // Tolerance is float32-scale (Float32List storage), not float64.
    final dz = rest[1 * 3 + 2] - rest[0 * 3 + 2];
    expect(dz, closeTo(voxelSpacing, 1e-6));
    final dx = rest[16 * 3] - rest[0 * 3];
    expect(dx, closeTo(voxelSpacing, 1e-6));
  });

  test('buildBonds connects a cube into a single fully-bonded lattice', () {
    final size = 4;
    final rest = buildCubeRest(size);
    final bonds = buildBonds(rest, size * size * size);
    expect(bonds, isNotEmpty);
    // A corner particle (6-connected + 12-face-diagonal neighborhood
    // trimmed by the cube's edge) should have at least 3 bonds (its 3
    // axis-aligned neighbors) and no more than 7 (3 face + edge-diagonals
    // available at a corner).
    final corner = 0; // (0,0,0)
    final cornerBonds = bonds.where((b) => b.a == corner || b.b == corner);
    expect(cornerBonds.length, greaterThanOrEqualTo(3));
  });

  test('an undisturbed cube stays put and numerically stable', () {
    final s = buildTestCube(4);
    for (var i = 0; i < 120; i++) {
      stepPhysics(s, 1 / 60);
    }
    expect(allFinite(s), isTrue);
    // Nothing was ever touched, so every particle should still be
    // essentially at its rest position.
    for (var i = 0; i < s.n; i++) {
      expect(distFromRest(s, i), lessThan(0.02));
    }
  });

  test('grabbing a particle eases it toward the grab target', () {
    final s = buildTestCube(4);
    const target = 1.0;
    s.grabWeight[0] = 1.0;
    s.grabTarget[0] = s.rest[0] + target;
    s.grabTarget[1] = s.rest[1];
    s.grabTarget[2] = s.rest[2];

    for (var i = 0; i < 90; i++) {
      stepPhysics(s, 1 / 60);
    }

    expect(allFinite(s), isTrue);
    expect(s.pos[0], closeTo(s.rest[0] + target, 0.05));
  });

  test('a bond stretched past bondBreakDist snaps, and reforms once close again', () {
    final s = buildTestCube(3);
    final bond = s.bonds.first;
    expect(bond.live, isTrue);

    // Directly separate the two ends well beyond the break distance and
    // pin them there (grab both) so the solver can't just pull them back
    // together before the break check runs.
    for (final idx in [bond.a, bond.b]) {
      s.grabWeight[idx] = 1.0;
    }
    final farApart = bondBreakDist * 3;
    s.grabTarget[bond.a * 3] = s.rest[bond.a * 3] - farApart / 2;
    s.grabTarget[bond.b * 3] = s.rest[bond.b * 3] + farApart / 2;

    for (var i = 0; i < 30; i++) {
      stepPhysics(s, 1 / 60);
    }
    expect(bond.live, isFalse, reason: 'bond should snap once stretched past bondBreakDist');

    // Release the grab and let them drift back via magnetic homing; once
    // close enough the bond should reform.
    s.grabWeight[bond.a] = 0;
    s.grabWeight[bond.b] = 0;
    for (var i = 0; i < 600; i++) {
      stepPhysics(s, 1 / 60);
    }
    expect(allFinite(s), isTrue);
    expect(bond.live, isTrue, reason: 'bond should reform once its ends drift back close');
  });

  test('an idle detached particle magnetically homes back to its rest slot', () {
    final s = buildTestCube(4);
    // Nudge one particle off its rest slot, within magnetRange, and leave
    // it alone (idle) so homing should kick in after magnetDelay.
    final offset = magnetRange * 0.5;
    s.pos[0] += offset;
    s.prev[0] += offset;

    final before = distFromRest(s, 0);
    expect(before, greaterThan(0.01));

    // Advance well past magnetDelay seconds of idle time.
    final steps = ((magnetDelay + 5) * 60).round();
    for (var i = 0; i < steps; i++) {
      stepPhysics(s, 1 / 60);
    }

    expect(allFinite(s), isTrue);
    expect(distFromRest(s, 0), lessThan(before), reason: 'should have crept back toward rest');
  });
}
