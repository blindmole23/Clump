import 'dart:math';
import 'dart:typed_data';

import 'sim_state.dart';
import 'tuning.dart';

/// Rest positions for a solid `size`-balls-to-an-edge cube, centered on the
/// origin, spaced [voxelSpacing] apart.
Float32List buildCubeRest(int size) {
  final n = size * size * size;
  final rest = Float32List(n * 3);
  final half = (size - 1) / 2.0;
  var i = 0;
  for (var x = 0; x < size; x++) {
    for (var y = 0; y < size; y++) {
      for (var z = 0; z < size; z++) {
        rest[i * 3] = (x - half) * voxelSpacing;
        rest[i * 3 + 1] = (y - half) * voxelSpacing;
        rest[i * 3 + 2] = (z - half) * voxelSpacing;
        i++;
      }
    }
  }
  return rest;
}

/// Connects every pair of particles whose rest positions are neighbors on
/// the voxel grid (axis-aligned and face-diagonal, out to ~1.5 grid steps)
/// into a live bond. Bucketing by rounded grid cell keeps this linear in
/// particle count instead of the naive O(n^2) all-pairs scan.
List<Bond> buildBonds(Float32List rest, int n) {
  final buckets = <int, List<int>>{};
  // One bucket per voxel-spacing step, so any neighbor within ~1.5 grid
  // steps (axis-aligned or face-diagonal) falls in an adjacent cell — the
  // -1..1 search below only needs to look one bucket in every direction.
  int cellKey(int cx, int cy, int cz) =>
      (cx * 73856093) ^ (cy * 19349663) ^ (cz * 83492791);

  // floor, not round: cube rest coordinates sit at half-integer multiples of
  // voxelSpacing, so they're solidly mid-bucket. round() ties-breaks exactly
  // at those half-integer values, and float32 noise can push two physically
  // adjacent particles to opposite sides of the tie — landing them two
  // buckets apart instead of one, and silently dropping their bond.
  int cellOf(double v) => (v / voxelSpacing).floor();

  for (var i = 0; i < n; i++) {
    final cx = cellOf(rest[i * 3]);
    final cy = cellOf(rest[i * 3 + 1]);
    final cz = cellOf(rest[i * 3 + 2]);
    buckets.putIfAbsent(cellKey(cx, cy, cz), () => []).add(i);
  }

  final bonds = <Bond>[];
  final maxDist = voxelSpacing * 1.5;
  final maxDistSq = maxDist * maxDist;
  final seen = <int>{};

  for (var i = 0; i < n; i++) {
    final ix = rest[i * 3], iy = rest[i * 3 + 1], iz = rest[i * 3 + 2];
    final cx = cellOf(ix), cy = cellOf(iy), cz = cellOf(iz);
    for (var dx = -1; dx <= 1; dx++) {
      for (var dy = -1; dy <= 1; dy++) {
        for (var dz = -1; dz <= 1; dz++) {
          final bucket = buckets[cellKey(cx + dx, cy + dy, cz + dz)];
          if (bucket == null) continue;
          for (final j in bucket) {
            if (j <= i) continue;
            final key = i * n + j;
            if (!seen.add(key)) continue;
            final ddx = rest[j * 3] - ix;
            final ddy = rest[j * 3 + 1] - iy;
            final ddz = rest[j * 3 + 2] - iz;
            final dSq = ddx * ddx + ddy * ddy + ddz * ddz;
            if (dSq > maxDistSq || dSq < 1e-10) continue;
            bonds.add(Bond(a: i, b: j, restLength: sqrt(dSq)));
          }
        }
      }
    }
  }
  return bonds;
}
