/**
 * Voxel budget for ~£200 phones (2026): Snapdragon 6 / Dimensity 6300 class.
 * One InstancedMesh draw call. ~250 PBD particles + 7 constraint iterations
 * stays well under a 16ms frame. 216 is a classic neodymium cube (6³);
 * a rounded lump lands ~240-300.
 */
/** Gun easter-egg shape's minimum voxel count (see shapes.ts buildGun). */
export const VOXEL_MIN = 220;

/** Floaty mode's default shape: a solid cube, CUBE_SIZE balls to an edge. */
export const CUBE_SIZE = 8;

export const VOXEL_SPACING = 0.24;
export const BALL_RADIUS = VOXEL_SPACING * 0.52;

export const SOLVER_ITERATIONS = 7;
export const BOND_STIFFNESS = 0.78;
/** Minimum center-to-center separation enforced between any two magnets. */
export const PACKING_DIST = VOXEL_SPACING * 0.9;

/** A bond snaps once its ends drift this far apart. */
export const BOND_BREAK_DIST = VOXEL_SPACING * 2.55;
/** A broken bond is eligible to reform once its ends drift back this close. */
export const BOND_REFORM_DIST = VOXEL_SPACING * 1.18;
/** Seconds a broken bond refuses to reform, however close its ends drift back. */
export const BOND_REFORM_DELAY = 10;

/**
 * Single threshold for every binary "is this particle currently under your
 * finger at all" decision — grab-follow integration, per-particle idle-clock
 * reset, drag-resistance scope, magnet-pull eligibility, the containment
 * clamp exemption, and bond-break protection. One knob instead of a
 * patchwork of near-identical magic numbers scattered through the solver.
 */
export const HELD_EPS = 0.02;

/** Resistance while you're actively dragging — the "clay pulling back" feel. */
export const DRAG_RESISTANCE = 0.055;

/**
 * Magnetic homing for anything you're NOT holding. This is a hard-range,
 * constant-speed pull, not a spring: outside MAGNET_RANGE a piece holds its
 * position forever (out of the magnet's reach); inside it, once MAGNET_DELAY
 * seconds pass with no interaction, it creeps home at exactly MAGNET_SPEED
 * world units per second.
 */
export const MAGNET_DELAY = 5;
export const MAGNET_RANGE = 10 * VOXEL_SPACING;
export const MAGNET_SPEED = 1 * VOXEL_SPACING;

/**
 * Single world-space sphere the whole simulation lives inside. Replaces the
 * old two-mechanism containment (a hard world-radius clamp in physics.ts,
 * plus a *separate* screen-projection clamp in engine.ts) — the latter had
 * to invert a camera projection every frame to find "off-screen", which is
 * numerically unstable at grazing angles and was the source of a hard-to-
 * reproduce "particles teleport to random positions" bug. A single
 * world-space radius needs no projection math at all: it's stable by
 * construction, and it's the only place containment happens now.
 */
export const PLAY_RADIUS = 3.4;

export const GRAB_RADIUS = 0.62;

/**
 * On-screen magnet size. There's no web API for a device's true physical
 * DPI (deliberately — browsers don't expose it), so this is a camera-zoom
 * approximation rather than a calibrated millimeter size: closer camera =
 * bigger-looking magnets. "medium" is the distance the app shipped with.
 */
export const CAMERA_DIST_BASE = 4.35;
export const MAGNET_SIZE_SCALE: Record<"small" | "medium" | "large", number> = {
  small: 1.4,
  medium: 1,
  large: 0.65,
};

/** World-space bias applied to the camera's look target so the clump sits
 * left of center, leaving open space on the right to pull chunks into. */
export const CLUMP_SCREEN_OFFSET = 1.1;

export const GUN_UNLOCK_TAPS = 7;

/**
 * Gravity-mode play areas (Trough, Plane). Both are enclosed boxes: the
 * clump falls, bounces off the floor/walls, and stays inside — no magnetic
 * homing or auto-orbit spin, those are floaty-mode-only concepts.
 */
export const GRAVITY = 6; // world units / s^2, tuned for a snappy but readable fall
export const BOUNCE = 0.22; // fraction of impact speed reflected off a wall/floor

export const TROUGH_WIDTH_BALLS = 8;
export const TROUGH_HEIGHT_BALLS = 8;
export const TROUGH_LENGTH_BALLS = 48;

export const PLANE_SIZE_BALLS = 64;
export const PLANE_HEIGHT_BALLS = 16; // walls only, open top
