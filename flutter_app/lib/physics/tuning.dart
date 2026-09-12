/// Physics/visual tuning constants carried over from the original web
/// (TanStack + Three.js) prototype's `src/lib/fidget/constants.ts`.
///
/// These are the numeric values only — the PBD solver itself is rebuilt
/// fresh in Dart for this project, not translated line-by-line. Keeping the
/// same names and comments as the web version so the two stay easy to
/// cross-reference while this port is in progress.
library;

/// Voxel budget for ~£200 phones (2026): Snapdragon 6 / Dimensity 6300 class.
/// ~250 PBD particles + 7 constraint iterations stays well under a 16ms
/// frame. 216 is a classic neodymium cube (6³); a rounded lump lands
/// ~240-300.
/// Gun easter-egg shape's minimum voxel count.
const int voxelMin = 220;

/// Floaty mode's default shape: a solid cube, [cubeSize] balls to an edge.
const int cubeSize = 8;

const double voxelSpacing = 0.24;
const double ballRadius = voxelSpacing * 0.52;

const int solverIterations = 7;
const double bondStiffness = 0.78;

/// Minimum center-to-center separation enforced between any two magnets.
const double packingDist = voxelSpacing * 0.9;

/// A bond snaps once its ends drift this far apart.
const double bondBreakDist = voxelSpacing * 2.55;

/// A broken bond is eligible to reform once its ends drift back this close.
const double bondReformDist = voxelSpacing * 1.18;

/// Seconds a broken bond refuses to reform, however close its ends drift
/// back.
const double bondReformDelay = 10;

/// Single threshold for every binary "is this particle currently under your
/// finger at all" decision — grab-follow integration, per-particle idle-clock
/// reset, drag-resistance scope, magnet-pull eligibility, the containment
/// clamp exemption, and bond-break protection. One knob instead of a
/// patchwork of near-identical magic numbers scattered through the solver.
const double heldEps = 0.02;

/// Resistance while you're actively dragging — the "clay pulling back" feel.
const double dragResistance = 0.055;

/// Magnetic homing for anything you're NOT holding. This is a hard-range,
/// constant-speed pull, not a spring: outside [magnetRange] a piece holds its
/// position forever (out of the magnet's reach); inside it, once
/// [magnetDelay] seconds pass with no interaction, it creeps home at exactly
/// [magnetSpeed] world units per second.
const double magnetDelay = 5;
const double magnetRange = 10 * voxelSpacing;
const double magnetSpeed = 1 * voxelSpacing;

/// Single world-space sphere the whole simulation lives inside.
const double playRadius = 3.4;

const double grabRadius = 0.62;

/// Spike: punches a hard-edged cylindrical hole clean through the clump —
/// about 3 balls wide — rather than a soft radial impulse.
const double holeRadius = voxelSpacing * 1.5;

/// Trowel: a 12-ball-long flat blade edge (like a credit card) that cuts
/// clean through the clump, rather than a circular smear.
const double scrapeHalfLength = voxelSpacing * 6;
const double scrapeThickness = voxelSpacing * 1.1;

/// Continuous camera zoom (wheel/pinch), applied as a multiplier on top of
/// the magnet-size-derived base distance. 1 is the untouched default.
const double zoomMin = 0.4;
const double zoomMax = 2.6;

/// On-screen magnet size. There's no reliable cross-platform API for a
/// device's true physical DPI, so this is a camera-zoom approximation
/// rather than a calibrated millimeter size: closer camera = bigger-looking
/// magnets. "medium" is the distance the app shipped with.
const double cameraDistBase = 4.35;

enum MagnetSize { small, medium, large }

const Map<MagnetSize, double> magnetSizeScale = {
  MagnetSize.small: 1.4,
  MagnetSize.medium: 1,
  MagnetSize.large: 0.65,
};

/// World-space bias applied to the camera's look target so the clump sits
/// left of center, leaving open space on the right to pull chunks into.
const double clumpScreenOffset = 1.1;

const int gunUnlockTaps = 7;

/// Gravity-mode play areas (Trough, Plane). Both are enclosed boxes: the
/// clump falls, bounces off the floor/walls, and stays inside — no magnetic
/// homing or auto-orbit spin, those are floaty-mode-only concepts.
const double gravity = 6; // world units / s^2, tuned for a snappy but readable fall
const double bounce = 0.22; // fraction of impact speed reflected off a wall/floor

const int troughWidthBalls = 8;
const int troughHeightBalls = 8;
const int troughLengthBalls = 48;

const int planeSizeBalls = 64;
const int planeHeightBalls = 16; // walls only, open top

enum GravityLevel { low, medium, high }

/// Gravity strength multiplier for Trough/Plane, set in Settings alongside
/// magnet size. Low is the original tuned feel; Medium/High scale it up.
const Map<GravityLevel, double> gravityScale = {
  GravityLevel.low: 1,
  GravityLevel.medium: 1.33,
  GravityLevel.high: 2,
};

/// Every live-tunable magnetic/physics parameter, exposed via a Dev panel
/// (mirrors web's `types.ts` `Tuning`/`TUNING_FIELDS`).
class Tuning {
  final double bondStiffness;
  final double packingDist;
  final int solverIterations;
  final double bondBreakDist;
  final double bondReformDist;
  final double bondReformDelay;
  final double magnetDelay;
  final double magnetRange;
  final double magnetSpeed;
  final double dragResistance;
  final double heldEps;
  final double grabRadius;

  const Tuning({
    required this.bondStiffness,
    required this.packingDist,
    required this.solverIterations,
    required this.bondBreakDist,
    required this.bondReformDist,
    required this.bondReformDelay,
    required this.magnetDelay,
    required this.magnetRange,
    required this.magnetSpeed,
    required this.dragResistance,
    required this.heldEps,
    required this.grabRadius,
  });

  Tuning copyWith({
    double? bondStiffness,
    double? packingDist,
    int? solverIterations,
    double? bondBreakDist,
    double? bondReformDist,
    double? bondReformDelay,
    double? magnetDelay,
    double? magnetRange,
    double? magnetSpeed,
    double? dragResistance,
    double? heldEps,
    double? grabRadius,
  }) {
    return Tuning(
      bondStiffness: bondStiffness ?? this.bondStiffness,
      packingDist: packingDist ?? this.packingDist,
      solverIterations: solverIterations ?? this.solverIterations,
      bondBreakDist: bondBreakDist ?? this.bondBreakDist,
      bondReformDist: bondReformDist ?? this.bondReformDist,
      bondReformDelay: bondReformDelay ?? this.bondReformDelay,
      magnetDelay: magnetDelay ?? this.magnetDelay,
      magnetRange: magnetRange ?? this.magnetRange,
      magnetSpeed: magnetSpeed ?? this.magnetSpeed,
      dragResistance: dragResistance ?? this.dragResistance,
      heldEps: heldEps ?? this.heldEps,
      grabRadius: grabRadius ?? this.grabRadius,
    );
  }
}

/// The live-tunable values above, gathered into one object. This is the
/// "factory reset" a future Dev panel's Reset button would restore.
const Tuning defaultTuning = Tuning(
  bondStiffness: bondStiffness,
  packingDist: packingDist,
  solverIterations: solverIterations,
  bondBreakDist: bondBreakDist,
  bondReformDist: bondReformDist,
  bondReformDelay: bondReformDelay,
  magnetDelay: magnetDelay,
  magnetRange: magnetRange,
  magnetSpeed: magnetSpeed,
  dragResistance: dragResistance,
  heldEps: heldEps,
  grabRadius: grabRadius,
);
