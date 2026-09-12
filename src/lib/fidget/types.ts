export type ToolId = "hand" | "spike" | "trowel" | "loop" | "needle" | "gun";

export type ShapeId = "lump" | "gun";

export type MagnetSize = "small" | "medium" | "large";

/** Trough/Plane gravity strength, set in Settings alongside magnet size. */
export type GravityLevel = "low" | "medium" | "high";

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

/**
 * Every live-tunable magnetic/physics parameter, exposed via the Dev panel.
 * physics.ts reads all of these except grabRadius (that one's only used by
 * the engine's own Hand-tool grab collection, never inside stepPhysics).
 */
export type Tuning = {
  bondStiffness: number;
  packingDist: number;
  solverIterations: number;
  bondBreakDist: number;
  bondReformDist: number;
  bondReformDelay: number;
  magnetDelay: number;
  magnetRange: number;
  magnetSpeed: number;
  dragResistance: number;
  heldEps: number;
  grabRadius: number;
};

export type TuningField = {
  key: keyof Tuning;
  label: string;
  min: number;
  max: number;
  step: number;
  unit?: string;
};

export const TUNING_FIELDS: TuningField[] = [
  { key: "bondStiffness", label: "Bond stiffness", min: 0.1, max: 1, step: 0.01 },
  { key: "packingDist", label: "Packing distance", min: 0.05, max: 0.3, step: 0.005 },
  { key: "solverIterations", label: "Solver iterations", min: 1, max: 14, step: 1 },
  { key: "bondBreakDist", label: "Bond break distance", min: 0.24, max: 1.5, step: 0.01 },
  { key: "bondReformDist", label: "Bond reform distance", min: 0.1, max: 0.6, step: 0.01 },
  { key: "bondReformDelay", label: "Bond reform delay", min: 0, max: 30, step: 0.5, unit: "s" },
  { key: "magnetDelay", label: "Magnet delay", min: 0, max: 20, step: 0.5, unit: "s" },
  { key: "magnetRange", label: "Magnet range", min: 0, max: 6, step: 0.1 },
  { key: "magnetSpeed", label: "Magnet speed", min: 0, max: 1, step: 0.01, unit: "/s" },
  { key: "dragResistance", label: "Drag resistance", min: 0, max: 0.3, step: 0.005 },
  { key: "heldEps", label: "Held threshold", min: 0.001, max: 0.3, step: 0.001 },
  { key: "grabRadius", label: "Grab radius", min: 0.2, max: 1.5, step: 0.01 },
];
