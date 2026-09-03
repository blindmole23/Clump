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
export const MAGNET_BREAK = 3.4;
export const MAGNET_REFORM = 1.18;

export const HOME_ACTIVE = 0.055;
export const HOME_IDLE = 0.38;
export const IDLE_AFTER = 1.15;
export const IDLE_RAMP = 3.2;

export const GRAB_RADIUS = 0.62;
export const SCREEN_MARGIN = 0.08;

export const GUN_UNLOCK_TAPS = 7;
