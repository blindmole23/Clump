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

/** World-space bias applied to the camera's look target so the clump sits
 * left of center, leaving open space on the right to pull chunks into. */
export const CLUMP_SCREEN_OFFSET = 1.1;

export const GUN_UNLOCK_TAPS = 7;
