export type ToolId = "hand" | "spike" | "trowel" | "loop" | "needle" | "gun";

export type ShapeId = "lump" | "gun";

export type MagnetSize = "small" | "medium" | "large";

/**
 * Floaty: zero-g, magnetic homing, auto-orbit camera (the original mode).
 * Trough: real gravity, enclosed 8-wide x 48-long box, no homing/spin.
 * Plane: real gravity, enclosed 64x64 open-top floor, no homing/spin.
 */
export type Mode = "floaty" | "trough" | "plane";

export type ModeInfo = { id: Mode; label: string };

export const MODES: ModeInfo[] = [
  { id: "floaty", label: "Floaty" },
  { id: "trough", label: "Trough" },
  { id: "plane", label: "Plane" },
];

export type Cell = {
  gx: number;
  gy: number;
  gz: number;
};

export type FidgetState = {
  n: number;
  pos: Float32Array;
  prev: Float32Array;
  rest: Float32Array;
  pulse: Float32Array;
  strain: Float32Array;
  grabWeight: Float32Array;
  grabTarget: Float32Array;
  baseColor: Float32Array;
  /** Seconds since this particle was last grabbed — per-particle so one
   * group's idle clock is never reset by touching a different group. */
  idleFor: Float32Array;
  bonds: Bond[];
};

export type Bond = {
  a: number;
  b: number;
  rest: number;
  live: number;
  /** Seconds left before a broken bond is eligible to reform, regardless of distance. */
  cooldown: number;
};

export type Tool = {
  id: ToolId;
  label: string;
  hint: string;
};

export const TOOLS: Tool[] = [
  { id: "hand", label: "Hand", hint: "Tap, push, pinch-stretch" },
  { id: "spike", label: "Spike", hint: "Punch a hole, split the mass" },
  { id: "trowel", label: "Trowel", hint: "Flatten and smear" },
  { id: "loop", label: "Loop", hint: "Scoop a pocket" },
  { id: "needle", label: "Needle", hint: "Pull a single magnet" },
];
