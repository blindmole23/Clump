/**
 * Voxel budget for ~£200 phones (2026): Snapdragon 6 / Dimensity 6300 class.
 * One InstancedMesh draw call. ~250 PBD particles + 6 constraint iterations
 * stays well under a 16ms frame. 216 is a classic neodymium cube (6³);
 * a rounded lump lands ~240–300.
 */
export const TARGET_VOXELS = 260;
export const VOXEL_MIN = 220;
export const VOXEL_MAX = 320;

export const VOXEL_SPACING = 0.24;
export const VOXEL_SIZE = 0.208;

export const PBD_ITERS = 7;
export const BOND_STIFFNESS = 0.78;
export const OVERLAP = 0.9;
// Was 3.4 — pulled in 25% so chunks split off sooner.
export const MAGNET_BREAK = 2.55;
export const MAGNET_REFORM = 1.18;
/** Seconds a broken bond refuses to reform, however close its ends drift back. */
export const REFORM_DELAY = 10;

/** Resistance while you're actively dragging — the "clay pulling back" feel. */
export const HOME_ACTIVE = 0.055;

/**
 * Magnetic homing for anything you're NOT holding. This is a hard-range,
 * constant-speed pull, not a spring: outside MAGNET_RANGE_BLOCKS a piece
 * holds its position forever (out of the magnet's reach); inside it, once
 * MAGNET_DELAY seconds pass with no interaction, it creeps home at exactly
 * MAGNET_PULL_SPEED block-widths per second.
 */
export const MAGNET_DELAY = 5;
export const MAGNET_RANGE_BLOCKS = 10;
export const MAGNET_PULL_SPEED = 1;

export const GRAB_RADIUS = 0.62;
export const SCREEN_MARGIN = 0.08;

/**
 * Single threshold for every binary "is this particle currently under your
 * finger at all" decision — grab-follow integration, idle-clock reset,
 * drag-resistance scope, magnet-pull eligibility, the world-radius clamp
 * exemption, and bond-break protection. Used to be a patchwork of 0.2/0.25
 * scattered around physics.ts, which left a 0.02–0.2 gap where a loosely
 * grabbed (falloff) particle was still being visually dragged but treated
 * as fully idle everywhere else — the source of several bugs at once.
 */
export const GRAB_HELD_EPS = 0.02;

/** World-space bias applied to the camera's look target so the clump sits
 * left of center, leaving open space on the right to pull chunks into. */
export const CLUMP_SCREEN_OFFSET = 1.1;

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

export const GUN_UNLOCK_TAPS = 7;
