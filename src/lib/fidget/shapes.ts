import { VOXEL_MIN } from "./constants";
import type { Cell } from "./types";

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

export function buildCube(size: number): Cell[] {
  const cells: Cell[] = [];
  const half = (size - 1) / 2;
  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      for (let z = 0; z < size; z++) {
        cells.push({ gx: x - half, gy: y - half, gz: z - half });
      }
    }
  }
  return cells;
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
