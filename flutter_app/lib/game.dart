import 'dart:math';
import 'dart:ui' as ui;

import 'package:flutter_scene/scene.dart';
import 'package:vector_math/vector_math.dart' as vm;

import 'physics/shapes.dart';
import 'physics/sim_state.dart';
import 'physics/solver.dart';
import 'physics/tuning.dart' as tuning;

/// Owns the scene, the simulation, and per-frame/pointer logic. Pure Dart
/// (no Flutter import) per flutter_scene's imperative pattern — the widget
/// layer (`main.dart`) is a thin shell that forwards ticks and gestures in.
class Game {
  final Scene scene = Scene();
  final PerspectiveCamera camera = PerspectiveCamera(
    fovRadiansY: 40 * vm.degrees2Radians,
    fovNear: 0.05,
    fovFar: 30,
  );

  late final SimState sim;
  late final InstancedMesh ballMesh;

  double _camYaw = 0.35;
  final double _camPitch = 0.18;

  /// True while a pointer is actively grabbing something — pauses the idle
  /// auto-orbit, same as the web prototype's "floaty" mode.
  bool interacting = false;

  final List<int> _grabIndices = [];
  final List<double> _grabWeights = [];
  final List<vm.Vector3> _grabOffsets = [];

  Future<void> load() async {
    await Scene.initializeStaticResources();

    final rest = buildCubeRest(tuning.cubeSize);
    final n = tuning.cubeSize * tuning.cubeSize * tuning.cubeSize;
    sim = SimState(n: n, rest: rest, bonds: buildBonds(rest, n));

    final geometry = SphereGeometry(radius: tuning.ballRadius, segments: 12, rings: 8);
    final material = PhysicallyBasedMaterial()
      ..baseColorFactor = vm.Vector4(1, 1, 1, 1)
      ..metallicFactor = 1.0
      ..roughnessFactor = 0.1;

    ballMesh = InstancedMesh(geometry: geometry, material: material);
    for (var i = 0; i < sim.n; i++) {
      final i3 = i * 3;
      ballMesh.addInstance(
        vm.Matrix4.translation(vm.Vector3(sim.pos[i3], sim.pos[i3 + 1], sim.pos[i3 + 2])),
      );
    }
    scene.add(Node()..addComponent(InstancedMeshComponent(ballMesh)));

    _placeCamera();
  }

  void tick(double dt) {
    if (!interacting) _camYaw += dt * 0.12;
    _placeCamera();

    stepPhysics(sim, dt);

    // The instance list handed in is unmodifiable (can't reassign an
    // element), but each Matrix4 is a mutable object — mutate its
    // translation in place instead of replacing it.
    ballMesh.updateInstanceTransforms((transforms) {
      for (var i = 0; i < sim.n; i++) {
        final i3 = i * 3;
        transforms[i].setTranslationRaw(sim.pos[i3], sim.pos[i3 + 1], sim.pos[i3 + 2]);
      }
    });
  }

  void _placeCamera() {
    final dist = tuning.cameraDistBase;
    final x = sin(_camYaw) * cos(_camPitch) * dist;
    final y = sin(_camPitch) * dist;
    final z = cos(_camYaw) * cos(_camPitch) * dist;
    camera.position = vm.Vector3(x, y, z);
    camera.target = vm.Vector3.zero();
  }

  // --- Pointer / grab handling -----------------------------------------

  void onPointerDown(ui.Offset screenPos, ui.Size viewSize) {
    interacting = true;
    final ray = camera.screenPointToRay(screenPos, viewSize);
    final dir = ray.direction.normalized();
    final hit = _closestToRay(ray.origin, dir);
    if (hit == null) return;

    final point = vm.Vector3(sim.pos[hit * 3], sim.pos[hit * 3 + 1], sim.pos[hit * 3 + 2]);
    _collectGrab(point);
  }

  void onPointerMove(ui.Offset screenPos, ui.Size viewSize) {
    if (_grabIndices.isEmpty) return;
    final ray = camera.screenPointToRay(screenPos, viewSize);
    final planePoint = _intersectOriginPlane(ray.origin, ray.direction.normalized());

    for (var k = 0; k < _grabIndices.length; k++) {
      final i = _grabIndices[k];
      final offset = _grabOffsets[k];
      sim.grabWeight[i] = _grabWeights[k];
      sim.grabTarget[i * 3] = planePoint.x + offset.x;
      sim.grabTarget[i * 3 + 1] = planePoint.y + offset.y;
      sim.grabTarget[i * 3 + 2] = planePoint.z + offset.z;
    }
  }

  void onPointerUp() {
    for (final i in _grabIndices) {
      sim.grabWeight[i] = 0;
    }
    _grabIndices.clear();
    _grabWeights.clear();
    _grabOffsets.clear();
    interacting = false;
  }

  /// Nearest particle to the ray, within [maxPerp] of it perpendicularly,
  /// and only considering particles the ray travels toward (not behind the
  /// camera).
  int? _closestToRay(vm.Vector3 origin, vm.Vector3 dir, {double maxPerp = 0.5}) {
    int? best;
    var bestPerp = maxPerp;
    for (var i = 0; i < sim.n; i++) {
      final i3 = i * 3;
      final px = sim.pos[i3] - origin.x;
      final py = sim.pos[i3 + 1] - origin.y;
      final pz = sim.pos[i3 + 2] - origin.z;
      final along = px * dir.x + py * dir.y + pz * dir.z;
      if (along < 0) continue;
      final qx = px - dir.x * along;
      final qy = py - dir.y * along;
      final qz = pz - dir.z * along;
      final perp = sqrt(qx * qx + qy * qy + qz * qz);
      if (perp < bestPerp) {
        bestPerp = perp;
        best = i;
      }
    }
    return best;
  }

  /// Collects every particle within `grabRadius` of [point], each weighted
  /// by distance falloff, and remembers its offset from [point] so the
  /// whole cluster keeps its shape while following the pointer.
  void _collectGrab(vm.Vector3 point) {
    _grabIndices.clear();
    _grabWeights.clear();
    _grabOffsets.clear();
    final radius = tuning.defaultTuning.grabRadius;
    for (var i = 0; i < sim.n; i++) {
      final i3 = i * 3;
      final dx = sim.pos[i3] - point.x;
      final dy = sim.pos[i3 + 1] - point.y;
      final dz = sim.pos[i3 + 2] - point.z;
      final d = sqrt(dx * dx + dy * dy + dz * dz);
      if (d > radius) continue;
      _grabIndices.add(i);
      _grabWeights.add(1 - d / radius);
      _grabOffsets.add(vm.Vector3(dx, dy, dz));
    }
  }

  /// Where a ray crosses the plane through the world origin facing the
  /// camera — the same fixed drag plane the web prototype used, which
  /// works because the clump always sits near the origin.
  vm.Vector3 _intersectOriginPlane(vm.Vector3 origin, vm.Vector3 dir) {
    final normal = camera.forward;
    final denom = normal.dot(dir);
    if (denom.abs() < 1e-6) return origin;
    final t = -origin.dot(normal) / denom;
    return origin + dir * t;
  }
}
