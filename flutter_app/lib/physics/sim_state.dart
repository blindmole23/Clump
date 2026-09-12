import 'dart:typed_data';

/// A magnetic bond between two particles, holding at [restLength] while
/// [live], eligible to reform once [cooldown] drops to zero and the ends
/// drift back within `bondReformDist`.
class Bond {
  final int a;
  final int b;
  final double restLength;
  bool live;
  double cooldown;

  Bond({
    required this.a,
    required this.b,
    required this.restLength,
    this.live = true,
    this.cooldown = 0,
  });
}

/// All per-particle simulation data, as flat typed arrays (3 floats per
/// particle for every positional field) so the solver's hot loops stay
/// allocation-free.
class SimState {
  final int n;
  final Float32List pos;
  final Float32List prev;
  final Float32List rest;
  final Float32List grabWeight;
  final Float32List grabTarget;
  final Float32List idleFor;
  final List<Bond> bonds;

  SimState({required this.n, required Float32List rest, required this.bonds})
      : pos = Float32List.fromList(rest),
        prev = Float32List.fromList(rest),
        rest = rest,
        grabWeight = Float32List(n),
        grabTarget = Float32List.fromList(rest),
        idleFor = Float32List(n);
}
