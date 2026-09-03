export type ToolId = "hand" | "spike" | "trowel" | "loop" | "needle" | "gun";

export type ShapeId = "lump" | "gun";

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
  bonds: Bond[];
};

export type Bond = {
  a: number;
  b: number;
  rest: number;
  live: number;
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
  { id: "needle", label: "Needle", hint: "Fine split" },
];
