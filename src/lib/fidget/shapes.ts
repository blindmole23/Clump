import { TARGET_VOXELS, VOXEL_MAX, VOXEL_MIN } from "./constants";
import type { Cell } from "./types";

function hash3(x: number, y: number, z: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

function unique(cells: Cell[]): Cell[] {
  const seen = new Set<string>();
  const out: Cell[] = [];
  for (const c of cells) {
    const k = `${c.gx}|${c.gy}|${c.gz}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(c);
  }
  return out;
}

function center(cells: Cell[]): Cell[] {
  if (cells.length === 0) return cells;
  let sx = 0,
    sy = 0,
    sz = 0;
  for (const c of cells) {
    sx += c.gx;
    sy += c.gy;
    sz += c.gz;
  }
  const n = cells.length;
  const cx = sx / n;
  const cy = sy / n;
  const cz = sz / n;
  return cells.map((c) => ({
    gx: c.gx - cx,
    gy: c.gy - cy,
    gz: c.gz - cz,
  }));
}

function addBox(
  cells: Cell[],
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  z0: number,
  z1: number,
) {
  for (let gx = x0; gx <= x1; gx++) {
    for (let gy = y0; gy <= y1; gy++) {
      for (let gz = z0; gz <= z1; gz++) {
        cells.push({ gx, gy, gz });
      }
    }
  }
}

function generateLump(thresh: number): Cell[] {
  const cells: Cell[] = [];
  const R = 5;
  for (let gx = -R; gx <= R; gx++) {
    for (let gy = -R; gy <= R; gy++) {
      for (let gz = -R; gz <= R; gz++) {
        const fx = gx * 1.0;
        const fy = gy * 1.08;
        const fz = gz * 0.96;
        const d2 = fx * fx + fy * fy + fz * fz;
        const n = (hash3(gx, gy, gz) - 0.5) * 3.2;
        const bump =
          Math.sin(gx * 1.3 + gz * 0.7) * Math.cos(gy * 1.1) * 1.4;
        if (d2 < thresh + n + bump) cells.push({ gx, gy, gz });
      }
    }
  }
  return unique(cells);
}

export function buildLump(): Cell[] {
  let thresh = 16.2;
  let cells = generateLump(thresh);
  for (let i = 0; i < 12; i++) {
    if (cells.length < VOXEL_MIN) thresh += 1.1;
    else if (cells.length > VOXEL_MAX) thresh -= 1.1;
    else break;
    cells = generateLump(thresh);
  }
  if (cells.length > VOXEL_MAX) {
    cells.sort(
      (a, b) =>
        a.gx * a.gx + a.gy * a.gy + a.gz * a.gz -
        (b.gx * b.gx + b.gy * b.gy + b.gz * b.gz),
    );
    cells = cells.slice(0, TARGET_VOXELS);
  }
  return center(cells);
}

export function buildGun(): Cell[] {
  const cells: Cell[] = [];
  addBox(cells, -1, 1, 1, 3, -3, 3);
  addBox(cells, -1, 1, 2, 3, 4, 10);
  addBox(cells, 0, 0, 1, 1, 4, 8);
  addBox(cells, -1, 1, -4, 0, -2, 1);
  addBox(cells, -1, 1, -6, -4, -3, 0);
  addBox(cells, 0, 0, -1, 0, 2, 3);
  addBox(cells, 0, 0, -2, -1, 2, 4);
  addBox(cells, 0, 0, 4, 4, -3, -2);
  addBox(cells, 0, 0, 4, 4, 10, 10);
  addBox(cells, -1, 1, 1, 2, -4, -3);
  addBox(cells, 0, 0, 3, 3, 9, 10);
  addBox(cells, -1, 1, -5, -1, -1, 1);
  addBox(cells, 0, 0, 0, 1, 3, 4);
  addBox(cells, -1, 1, 2, 2, 11, 11);
  let out = unique(cells);
  if (out.length < VOXEL_MIN) {
    addBox(cells, -1, 1, 1, 3, 3, 5);
    addBox(cells, -1, 1, -3, 1, -2, 0);
    out = unique(cells);
  }
  return center(out);
}

export function cellsToRest(
  cells: Cell[],
  spacing: number,
): Float32Array {
  const rest = new Float32Array(cells.length * 3);
  for (let i = 0; i < cells.length; i++) {
    rest[i * 3] = cells[i]!.gx * spacing;
    rest[i * 3 + 1] = cells[i]!.gy * spacing;
    rest[i * 3 + 2] = cells[i]!.gz * spacing;
  }
  return rest;
}
