import { _ as OVERLAP, a as playSnap, b as VOXEL_SPACING, c as unlockAudio, d as HOME_ACTIVE, f as HOME_IDLE, g as MAGNET_REFORM, h as MAGNET_BREAK, i as playReset, l as BOND_STIFFNESS, m as IDLE_RAMP, n as playGun, o as playStretch, p as IDLE_AFTER, r as playPoke, s as resumeAudioIfNeeded, u as GRAB_RADIUS, v as SCREEN_MARGIN, y as VOXEL_SIZE } from "./routes-DJq2KfuY.mjs";
import { _ as Raycaster, a as DirectionalLight, b as Vector2, c as HemisphereLight, d as MeshBasicMaterial, f as MeshPhongMaterial, g as PointLight, h as Plane, i as Color, l as InstancedMesh, m as PerspectiveCamera, n as WebGLRenderer, o as DynamicDrawUsage, p as Object3D, r as CircleGeometry, s as Fog, t as RoundedBoxGeometry, u as Mesh, v as SRGBColorSpace, x as Vector3, y as Scene } from "../_libs/three.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/engine-BMy2NqGY.js
var TMP = {
	nx: 0,
	ny: 0,
	nz: 0
};
function buildBonds(rest, n) {
	const bonds = [];
	const bucket = /* @__PURE__ */ new Map();
	const q = VOXEL_SPACING;
	const key = (x, y, z) => `${Math.round(x / q)}|${Math.round(y / q)}|${Math.round(z / q)}`;
	for (let i = 0; i < n; i++) bucket.set(key(rest[i * 3], rest[i * 3 + 1], rest[i * 3 + 2]), i);
	const dirs = [
		[
			1,
			0,
			0
		],
		[
			0,
			1,
			0
		],
		[
			0,
			0,
			1
		],
		[
			1,
			1,
			0
		],
		[
			1,
			0,
			1
		],
		[
			0,
			1,
			1
		]
	];
	for (let i = 0; i < n; i++) {
		const x = rest[i * 3];
		const y = rest[i * 3 + 1];
		const z = rest[i * 3 + 2];
		for (const [dx, dy, dz] of dirs) {
			const j = bucket.get(key(x + dx * q, y + dy * q, z + dz * q));
			if (j == null || j <= i) continue;
			const rx = rest[j * 3] - x;
			const ry = rest[j * 3 + 1] - y;
			const rz = rest[j * 3 + 2] - z;
			const restLen = Math.hypot(rx, ry, rz);
			bonds.push({
				a: i,
				b: j,
				rest: restLen,
				live: 1
			});
		}
	}
	return bonds;
}
function createState(rest) {
	const n = rest.length / 3;
	const pos = new Float32Array(rest);
	const prev = new Float32Array(rest);
	const grabTarget = new Float32Array(rest);
	const grabWeight = new Float32Array(n);
	const pulse = new Float32Array(n);
	const strain = new Float32Array(n);
	const baseColor = new Float32Array(n * 3);
	const clay = [
		[
			.78,
			.42,
			.24
		],
		[
			.7,
			.36,
			.2
		],
		[
			.82,
			.5,
			.3
		],
		[
			.64,
			.34,
			.22
		],
		[
			.74,
			.46,
			.28
		],
		[
			.6,
			.32,
			.2
		]
	];
	for (let i = 0; i < n; i++) {
		const c = clay[i % clay.length];
		const jitter = i * 17 % 9 / 90;
		baseColor[i * 3] = c[0] + jitter;
		baseColor[i * 3 + 1] = c[1] + jitter * .4;
		baseColor[i * 3 + 2] = c[2];
	}
	return {
		n,
		pos,
		prev,
		rest,
		pulse,
		strain,
		grabWeight,
		grabTarget,
		baseColor,
		bonds: buildBonds(rest, n)
	};
}
function rematchRest(state, nextRest) {
	const n = state.n;
	const used = new Uint8Array(n);
	const assigned = new Int32Array(n);
	assigned.fill(-1);
	for (let i = 0; i < n; i++) {
		const px = state.pos[i * 3];
		const py = state.pos[i * 3 + 1];
		const pz = state.pos[i * 3 + 2];
		let best = -1;
		let bestD = Infinity;
		for (let j = 0; j < n; j++) {
			if (used[j]) continue;
			const dx = nextRest[j * 3] - px;
			const dy = nextRest[j * 3 + 1] - py;
			const dz = nextRest[j * 3 + 2] - pz;
			const d = dx * dx + dy * dy + dz * dz;
			if (d < bestD) {
				bestD = d;
				best = j;
			}
		}
		if (best >= 0) {
			used[best] = 1;
			assigned[i] = best;
		}
	}
	const newRest = new Float32Array(n * 3);
	for (let i = 0; i < n; i++) {
		const j = assigned[i];
		if (j < 0) {
			newRest[i * 3] = state.pos[i * 3];
			newRest[i * 3 + 1] = state.pos[i * 3 + 1];
			newRest[i * 3 + 2] = state.pos[i * 3 + 2];
		} else {
			newRest[i * 3] = nextRest[j * 3];
			newRest[i * 3 + 1] = nextRest[j * 3 + 1];
			newRest[i * 3 + 2] = nextRest[j * 3 + 2];
		}
	}
	state.rest.set(newRest);
	state.bonds = buildBonds(state.rest, n);
}
function resetToRest(state) {
	state.pos.set(state.rest);
	state.prev.set(state.rest);
	state.pulse.fill(0);
	state.grabWeight.fill(0);
	for (const b of state.bonds) b.live = 1;
}
function stepPhysics(state, p) {
	const { n, pos, prev, rest, grabWeight, grabTarget, pulse, strain, bonds } = state;
	const dt = p.dt;
	const spacing = VOXEL_SPACING;
	const idleT = Math.max(0, p.idleFor - IDLE_AFTER);
	const idleK = p.interacting ? 0 : Math.min(1, idleT / IDLE_RAMP);
	const home = HOME_ACTIVE + (HOME_IDLE - HOME_ACTIVE) * idleK * idleK;
	const friction = p.interacting ? .14 : .22 + idleK * .45;
	const damp = Math.pow(1 - friction, dt * 60);
	for (let i = 0; i < n; i++) {
		const i3 = i * 3;
		const gx = grabWeight[i];
		if (gx > .02) {
			const t = 1 - Math.pow(1 - Math.min(1, gx), dt * 28);
			pos[i3] = pos[i3] + (grabTarget[i3] - pos[i3]) * t;
			pos[i3 + 1] = pos[i3 + 1] + (grabTarget[i3 + 1] - pos[i3 + 1]) * t;
			pos[i3 + 2] = pos[i3 + 2] + (grabTarget[i3 + 2] - pos[i3 + 2]) * t;
		} else {
			let vx = (pos[i3] - prev[i3]) * damp;
			let vy = (pos[i3 + 1] - prev[i3 + 1]) * damp;
			let vz = (pos[i3 + 2] - prev[i3 + 2]) * damp;
			prev[i3] = pos[i3];
			prev[i3 + 1] = pos[i3 + 1];
			prev[i3 + 2] = pos[i3 + 2];
			pos[i3] = pos[i3] + vx;
			pos[i3 + 1] = pos[i3 + 1] + vy;
			pos[i3 + 2] = pos[i3 + 2] + vz;
		}
		pulse[i] = pulse[i] * Math.exp(-10 * dt);
	}
	const iters = dt > 1 / 42 ? 4 : 6;
	const stiff = BOND_STIFFNESS;
	const breakDist = MAGNET_BREAK * spacing;
	const reformDist = MAGNET_REFORM * spacing;
	let snaps = 0;
	for (let iter = 0; iter < iters; iter++) {
		for (let b = 0; b < bonds.length; b++) {
			const bond = bonds[b];
			const a3 = bond.a * 3;
			const b3 = bond.b * 3;
			let dx = pos[b3] - pos[a3];
			let dy = pos[b3 + 1] - pos[a3 + 1];
			let dz = pos[b3 + 2] - pos[a3 + 2];
			let d = Math.hypot(dx, dy, dz);
			if (d < 1e-6) continue;
			if (bond.live) {
				if (d > breakDist) {
					bond.live = 0;
					continue;
				}
			} else if (d < reformDist) {
				bond.live = 1;
				snaps++;
			} else {
				if (d < breakDist) {
					const pull = (d - bond.rest) / d * .12 * stiff;
					const wa = grabWeight[bond.a] > .2 ? .15 : .5;
					const wb = grabWeight[bond.b] > .2 ? .15 : .5;
					pos[a3] = pos[a3] + dx * pull * wa;
					pos[a3 + 1] = pos[a3 + 1] + dy * pull * wa;
					pos[a3 + 2] = pos[a3 + 2] + dz * pull * wa;
					pos[b3] = pos[b3] - dx * pull * wb;
					pos[b3 + 1] = pos[b3 + 1] - dy * pull * wb;
					pos[b3 + 2] = pos[b3 + 2] - dz * pull * wb;
				}
				continue;
			}
			const corr = (d - bond.rest) / d * stiff;
			const wa = grabWeight[bond.a] > .25 ? .08 : .5;
			const wb = grabWeight[bond.b] > .25 ? .08 : .5;
			pos[a3] = pos[a3] + dx * corr * wa;
			pos[a3 + 1] = pos[a3 + 1] + dy * corr * wa;
			pos[a3 + 2] = pos[a3 + 2] + dz * corr * wa;
			pos[b3] = pos[b3] - dx * corr * wb;
			pos[b3 + 1] = pos[b3 + 1] - dy * corr * wb;
			pos[b3 + 2] = pos[b3 + 2] - dz * corr * wb;
		}
		const hk = home * (iter === iters - 1 ? 1 : .45);
		if (hk > 0) for (let i = 0; i < n; i++) {
			if (grabWeight[i] > .2) continue;
			const i3 = i * 3;
			pos[i3] = pos[i3] + (rest[i3] - pos[i3]) * hk;
			pos[i3 + 1] = pos[i3 + 1] + (rest[i3 + 1] - pos[i3 + 1]) * hk;
			pos[i3 + 2] = pos[i3 + 2] + (rest[i3 + 2] - pos[i3 + 2]) * hk;
		}
	}
	resolveOverlaps(state, spacing * OVERLAP);
	const limit = p.worldRadius;
	const limit2 = limit * limit;
	for (let i = 0; i < n; i++) {
		const i3 = i * 3;
		const x = pos[i3];
		const y = pos[i3 + 1];
		const z = pos[i3 + 2];
		const d2 = x * x + y * y + z * z;
		if (d2 > limit2) {
			const s = limit / Math.sqrt(d2);
			pos[i3] = x * s;
			pos[i3 + 1] = y * s;
			pos[i3 + 2] = z * s;
		}
		const dx = pos[i3] - rest[i3];
		const dy = pos[i3 + 1] - rest[i3 + 1];
		const dz = pos[i3 + 2] - rest[i3 + 2];
		strain[i] = Math.min(1, Math.hypot(dx, dy, dz) / (spacing * 3.2));
	}
	return snaps;
}
function resolveOverlaps(state, minDist) {
	const { n, pos, grabWeight } = state;
	const cellSize = minDist;
	const buckets = /* @__PURE__ */ new Map();
	const hash = (x, y, z) => {
		const ix = Math.floor(x / cellSize);
		const iy = Math.floor(y / cellSize);
		const iz = Math.floor(z / cellSize);
		return ix * 73856093 ^ iy * 19349663 ^ iz * 83492791 | 0;
	};
	for (let i = 0; i < n; i++) {
		const h = hash(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
		let list = buckets.get(h);
		if (!list) {
			list = [];
			buckets.set(h, list);
		}
		list.push(i);
	}
	const offsets = [];
	for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) for (let oz = -1; oz <= 1; oz++) offsets.push([
		ox,
		oy,
		oz
	]);
	const min2 = minDist * minDist;
	for (let i = 0; i < n; i++) {
		const x = pos[i * 3];
		const y = pos[i * 3 + 1];
		const z = pos[i * 3 + 2];
		const ix = Math.floor(x / cellSize);
		const iy = Math.floor(y / cellSize);
		const iz = Math.floor(z / cellSize);
		for (const [ox, oy, oz] of offsets) {
			const list = buckets.get((ix + ox) * 73856093 ^ (iy + oy) * 19349663 ^ (iz + oz) * 83492791);
			if (!list) continue;
			for (const j of list) {
				if (j <= i) continue;
				let dx = pos[j * 3] - x;
				let dy = pos[j * 3 + 1] - y;
				let dz = pos[j * 3 + 2] - z;
				const d2 = dx * dx + dy * dy + dz * dz;
				if (d2 > min2 || d2 < 1e-10) continue;
				const d = Math.sqrt(d2);
				const push = (minDist - d) / d;
				TMP.nx = dx * push;
				TMP.ny = dy * push;
				TMP.nz = dz * push;
				const ga = grabWeight[i] > .25;
				const gb = grabWeight[j] > .25;
				const wa = ga && !gb ? 0 : gb && !ga ? 1 : .5;
				const wb = 1 - wa;
				pos[i * 3] = pos[i * 3] - TMP.nx * wa;
				pos[i * 3 + 1] = pos[i * 3 + 1] - TMP.ny * wa;
				pos[i * 3 + 2] = pos[i * 3 + 2] - TMP.nz * wa;
				pos[j * 3] = pos[j * 3] + TMP.nx * wb;
				pos[j * 3 + 1] = pos[j * 3 + 1] + TMP.ny * wb;
				pos[j * 3 + 2] = pos[j * 3 + 2] + TMP.nz * wb;
			}
		}
	}
}
function applyImpulse(state, origin, dir, radius, strength, radial = .45) {
	const { n, pos, prev, pulse } = state;
	const [ox, oy, oz] = origin;
	const [dx, dy, dz] = dir;
	for (let i = 0; i < n; i++) {
		const i3 = i * 3;
		const px = pos[i3] - ox;
		const py = pos[i3 + 1] - oy;
		const pz = pos[i3 + 2] - oz;
		const along = px * dx + py * dy + pz * dz;
		if (along < -.2) continue;
		const qx = px - dx * along;
		const qy = py - dy * along;
		const qz = pz - dz * along;
		const d = Math.hypot(qx, qy, qz);
		if (d > radius) continue;
		const w = 1 - d / radius;
		const kick = strength * w * w;
		prev[i3] = prev[i3] - dx * kick;
		prev[i3 + 1] = prev[i3 + 1] - dy * kick;
		prev[i3 + 2] = prev[i3 + 2] - dz * kick;
		if (d > 1e-4 && radial) {
			const inv = radial * kick / d;
			prev[i3] = prev[i3] - qx * inv;
			prev[i3 + 1] = prev[i3 + 1] - qy * inv;
			prev[i3 + 2] = prev[i3 + 2] - qz * inv;
		}
		pulse[i] = Math.min(1, pulse[i] + w);
	}
}
function applyPlaneSmear(state, point, normal, smear, radius, flatten) {
	const { n, pos, grabWeight } = state;
	const [px, py, pz] = point;
	const [nx, ny, nz] = normal;
	const [sx, sy, sz] = smear;
	for (let i = 0; i < n; i++) {
		if (grabWeight[i] > .4) continue;
		const i3 = i * 3;
		const dx = pos[i3] - px;
		const dy = pos[i3 + 1] - py;
		const dz = pos[i3 + 2] - pz;
		const d = Math.hypot(dx, dy, dz);
		if (d > radius) continue;
		const w = 1 - d / radius;
		const dist = dx * nx + dy * ny + dz * nz;
		pos[i3] = pos[i3] - nx * dist * flatten * w + sx * w;
		pos[i3 + 1] = pos[i3 + 1] - ny * dist * flatten * w + sy * w;
		pos[i3 + 2] = pos[i3 + 2] - nz * dist * flatten * w + sz * w;
	}
}
function applyScoop(state, center, camDir, radius, strength) {
	const { n, pos, grabWeight } = state;
	const [cx, cy, cz] = center;
	const [dx, dy, dz] = camDir;
	const ring = radius * .72;
	for (let i = 0; i < n; i++) {
		if (grabWeight[i] > .4) continue;
		const i3 = i * 3;
		const px = pos[i3] - cx;
		const py = pos[i3 + 1] - cy;
		const pz = pos[i3 + 2] - cz;
		const d = Math.hypot(px, py, pz);
		if (d > radius) continue;
		const w = 1 - d / radius;
		pos[i3] = pos[i3] + dx * strength * w;
		pos[i3 + 1] = pos[i3 + 1] + dy * strength * w;
		pos[i3 + 2] = pos[i3 + 2] + dz * strength * w;
		if (d > 1e-4) {
			const rd = d;
			const k = (ring - rd) / rd * .18 * w;
			pos[i3] = pos[i3] + px * k;
			pos[i3 + 1] = pos[i3 + 1] + py * k;
			pos[i3 + 2] = pos[i3 + 2] + pz * k;
		}
	}
}
function closestToRay(state, origin, dir, maxPerp = .55) {
	const { n, pos } = state;
	const [ox, oy, oz] = origin;
	const [dx, dy, dz] = dir;
	let best = -1;
	let bestD = maxPerp;
	let bestAlong = 0;
	for (let i = 0; i < n; i++) {
		const px = pos[i * 3] - ox;
		const py = pos[i * 3 + 1] - oy;
		const pz = pos[i * 3 + 2] - oz;
		const along = px * dx + py * dy + pz * dz;
		if (along < 0) continue;
		const qx = px - dx * along;
		const qy = py - dy * along;
		const qz = pz - dz * along;
		const d = Math.hypot(qx, qy, qz);
		if (d < bestD) {
			bestD = d;
			best = i;
			bestAlong = along;
		}
	}
	if (best < 0) return null;
	return {
		index: best,
		along: bestAlong,
		point: [
			origin[0] + dir[0] * bestAlong,
			origin[1] + dir[1] * bestAlong,
			origin[2] + dir[2] * bestAlong
		]
	};
}
function collectGrab(state, point, radius) {
	const { n, pos } = state;
	const indices = [];
	const weights = [];
	const [px, py, pz] = point;
	const r2 = radius * radius;
	for (let i = 0; i < n; i++) {
		const dx = pos[i * 3] - px;
		const dy = pos[i * 3 + 1] - py;
		const dz = pos[i * 3 + 2] - pz;
		const d2 = dx * dx + dy * dy + dz * dz;
		if (d2 > r2) continue;
		const d = Math.sqrt(d2);
		indices.push(i);
		weights.push(1 - d / radius);
	}
	return {
		indices,
		weights
	};
}
function hash3(x, y, z) {
	const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
	return s - Math.floor(s);
}
function unique(cells) {
	const seen = /* @__PURE__ */ new Set();
	const out = [];
	for (const c of cells) {
		const k = `${c.gx}|${c.gy}|${c.gz}`;
		if (seen.has(k)) continue;
		seen.add(k);
		out.push(c);
	}
	return out;
}
function center(cells) {
	if (cells.length === 0) return cells;
	let sx = 0, sy = 0, sz = 0;
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
		gz: c.gz - cz
	}));
}
function addBox(cells, x0, x1, y0, y1, z0, z1) {
	for (let gx = x0; gx <= x1; gx++) for (let gy = y0; gy <= y1; gy++) for (let gz = z0; gz <= z1; gz++) cells.push({
		gx,
		gy,
		gz
	});
}
function generateLump(thresh) {
	const cells = [];
	const R = 5;
	for (let gx = -5; gx <= R; gx++) for (let gy = -5; gy <= R; gy++) for (let gz = -5; gz <= R; gz++) {
		const fx = gx * 1;
		const fy = gy * 1.08;
		const fz = gz * .96;
		const d2 = fx * fx + fy * fy + fz * fz;
		const n = (hash3(gx, gy, gz) - .5) * 3.2;
		const bump = Math.sin(gx * 1.3 + gz * .7) * Math.cos(gy * 1.1) * 1.4;
		if (d2 < thresh + n + bump) cells.push({
			gx,
			gy,
			gz
		});
	}
	return unique(cells);
}
function buildLump() {
	let thresh = 16.2;
	let cells = generateLump(thresh);
	for (let i = 0; i < 12; i++) {
		if (cells.length < 220) thresh += 1.1;
		else if (cells.length > 320) thresh -= 1.1;
		else break;
		cells = generateLump(thresh);
	}
	if (cells.length > 320) {
		cells.sort((a, b) => a.gx * a.gx + a.gy * a.gy + a.gz * a.gz - (b.gx * b.gx + b.gy * b.gy + b.gz * b.gz));
		cells = cells.slice(0, 260);
	}
	return center(cells);
}
function buildGun() {
	const cells = [];
	addBox(cells, -1, 1, 0, 2, -2, 4);
	addBox(cells, -1, 1, 1, 2, 5, 9);
	addBox(cells, 0, 0, 0, 0, 5, 8);
	addBox(cells, -1, 1, -4, -1, -1, 1);
	addBox(cells, -1, 1, -6, -4, -2, 0);
	addBox(cells, 0, 0, -2, -1, 2, 3);
	addBox(cells, 0, 0, -3, -2, 1, 3);
	addBox(cells, 0, 0, 3, 3, -2, -1);
	addBox(cells, 0, 0, 3, 3, 9, 9);
	addBox(cells, -1, 1, 0, 1, -3, -2);
	addBox(cells, 0, 0, 2, 2, 8, 9);
	addBox(cells, -1, 1, -5, -2, 0, 1);
	addBox(cells, 0, 0, -1, 0, 4, 4);
	let out = unique(cells);
	if (out.length < 220) {
		addBox(cells, -1, 1, 0, 2, 4, 5);
		addBox(cells, -1, 1, -3, 0, -1, 0);
		out = unique(cells);
	}
	return center(out);
}
function cellsToRest(cells, spacing) {
	const rest = new Float32Array(cells.length * 3);
	for (let i = 0; i < cells.length; i++) {
		rest[i * 3] = cells[i].gx * spacing;
		rest[i * 3 + 1] = cells[i].gy * spacing;
		rest[i * 3 + 2] = cells[i].gz * spacing;
	}
	return rest;
}
var CLAY = [
	[
		.78,
		.42,
		.24
	],
	[
		.7,
		.36,
		.2
	],
	[
		.82,
		.5,
		.3
	],
	[
		.64,
		.34,
		.22
	],
	[
		.74,
		.46,
		.28
	],
	[
		.6,
		.32,
		.2
	]
];
var GUNMETAL = [
	[
		.42,
		.44,
		.46
	],
	[
		.36,
		.37,
		.4
	],
	[
		.5,
		.5,
		.48
	],
	[
		.3,
		.31,
		.34
	],
	[
		.46,
		.4,
		.32
	]
];
var FidgetEngine = class {
	canvas;
	renderer;
	scene;
	camera;
	mesh;
	dummy = new Object3D();
	color = new Color();
	state;
	tool = "hand";
	shape = "lump";
	pointers = /* @__PURE__ */ new Map();
	hooks;
	disposed = false;
	last = 0;
	idleFor = 0;
	interacting = false;
	recovering = false;
	trauma = 0;
	camYaw = .35;
	camPitch = .18;
	camDist = 4.35;
	reducedMotion;
	flash;
	shadow;
	raycaster = new Raycaster();
	ndc = new Vector2();
	hitPlane = new Plane(new Vector3(0, 0, 1), 0);
	planeHit = new Vector3();
	camDir = new Vector3();
	origin = new Vector3();
	tmp = new Vector3();
	lastStretchAt = 0;
	muted = false;
	geom;
	mat;
	ndcClamp = new Vector3();
	constructor(canvas, hooks) {
		this.canvas = canvas;
		this.hooks = hooks;
		this.reducedMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		const rest = cellsToRest(buildLump(), VOXEL_SPACING);
		this.state = createState(rest);
		hooks.onVoxelCount(this.state.n);
		this.renderer = new WebGLRenderer({
			canvas,
			antialias: false,
			alpha: false,
			powerPreference: "high-performance"
		});
		this.renderer.setClearColor(789258, 1);
		this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
		this.renderer.outputColorSpace = SRGBColorSpace;
		this.scene = new Scene();
		this.scene.background = new Color(789258);
		this.scene.fog = new Fog(789258, 6.5, 12);
		this.camera = new PerspectiveCamera(40, 1, .1, 30);
		this.camera.position.set(0, .2, this.camDist);
		const hemi = new HemisphereLight(15787736, 1709586, .72);
		this.scene.add(hemi);
		const key = new DirectionalLight(16773602, 1.15);
		key.position.set(2.4, 3.2, 2.8);
		this.scene.add(key);
		const fill = new DirectionalLight(9085112, .28);
		fill.position.set(-2.6, .4, 1.4);
		this.scene.add(fill);
		const rim = new DirectionalLight(16767160, .22);
		rim.position.set(-.6, 1.4, -3.2);
		this.scene.add(rim);
		this.flash = new PointLight(16770760, 0, 4.5);
		this.scene.add(this.flash);
		const shadowGeo = new CircleGeometry(1.6, 32);
		const shadowMat = new MeshBasicMaterial({
			color: 0,
			transparent: true,
			opacity: .28,
			depthWrite: false
		});
		this.shadow = new Mesh(shadowGeo, shadowMat);
		this.shadow.rotation.x = -Math.PI / 2;
		this.shadow.position.y = -1.55;
		this.scene.add(this.shadow);
		this.geom = new RoundedBoxGeometry(VOXEL_SIZE, VOXEL_SIZE, VOXEL_SIZE, 1, VOXEL_SIZE * .16);
		this.mat = new MeshPhongMaterial({
			color: 16777215,
			shininess: 34,
			specular: 3813932
		});
		this.mesh = new InstancedMesh(this.geom, this.mat, this.state.n);
		this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
		this.mesh.frustumCulled = false;
		this.scene.add(this.mesh);
		this.resize();
		this.bind();
		this.syncInstances();
	}
	setTool(tool) {
		this.tool = tool;
	}
	setMuted(v) {
		this.muted = v;
	}
	morphTo(shape) {
		if (shape === this.shape) return;
		this.shape = shape;
		const rest = cellsToRest(shape === "gun" ? buildGun() : buildLump(), VOXEL_SPACING);
		rematchRest(this.state, padRest(rest, this.state.n));
		const palette = shape === "gun" ? GUNMETAL : CLAY;
		for (let i = 0; i < this.state.n; i++) {
			const c = palette[i % palette.length];
			this.state.baseColor[i * 3] = c[0];
			this.state.baseColor[i * 3 + 1] = c[1];
			this.state.baseColor[i * 3 + 2] = c[2];
		}
	}
	reset() {
		resetToRest(this.state);
		playReset();
		this.idleFor = 4;
		this.trauma = .12;
	}
	pokeCenter() {
		applyImpulse(this.state, [
			0,
			0,
			1.4
		], [
			0,
			0,
			-1
		], .7, .18, .5);
		playPoke(.8);
		this.bumpActivity();
		this.trauma = Math.min(1, this.trauma + .25);
	}
	start() {
		this.last = performance.now();
		this.renderer.setAnimationLoop(this.tick);
		this.hooks.onReady();
	}
	dispose() {
		this.disposed = true;
		this.renderer.setAnimationLoop(null);
		this.unbind();
		this.geom.dispose();
		this.mat.dispose();
		this.shadow.material.dispose();
		this.shadow.geometry.dispose();
		this.mesh.dispose();
		this.renderer.dispose();
	}
	bind() {
		this.canvas.addEventListener("pointerdown", this.onDown);
		this.canvas.addEventListener("pointermove", this.onMove);
		this.canvas.addEventListener("pointerup", this.onUp);
		this.canvas.addEventListener("pointercancel", this.onUp);
		this.canvas.addEventListener("contextmenu", prevent);
		window.addEventListener("resize", this.resize);
		document.addEventListener("visibilitychange", this.onVis);
		window.addEventListener("blur", this.onBlur);
	}
	unbind() {
		this.canvas.removeEventListener("pointerdown", this.onDown);
		this.canvas.removeEventListener("pointermove", this.onMove);
		this.canvas.removeEventListener("pointerup", this.onUp);
		this.canvas.removeEventListener("pointercancel", this.onUp);
		this.canvas.removeEventListener("contextmenu", prevent);
		window.removeEventListener("resize", this.resize);
		document.removeEventListener("visibilitychange", this.onVis);
		window.removeEventListener("blur", this.onBlur);
	}
	onVis = () => {
		resumeAudioIfNeeded();
		if (document.visibilityState !== "visible") this.clearPointers();
	};
	onBlur = () => this.clearPointers();
	resize = () => {
		const w = this.canvas.clientWidth || window.innerWidth;
		const h = this.canvas.clientHeight || window.innerHeight;
		this.renderer.setSize(w, h, false);
		this.camera.aspect = w / Math.max(1, h);
		this.camera.updateProjectionMatrix();
	};
	clearPointers() {
		this.pointers.clear();
		this.state.grabWeight.fill(0);
		this.interacting = false;
	}
	bumpActivity() {
		this.idleFor = 0;
		this.interacting = true;
	}
	onDown = (e) => {
		unlockAudio();
		e.preventDefault();
		this.canvas.setPointerCapture(e.pointerId);
		this.bumpActivity();
		const ray = this.pointerRay(e.clientX, e.clientY);
		const hit = closestToRay(this.state, ray.origin, ray.dir, .85);
		const point = hit ? [
			this.state.pos[hit.index * 3],
			this.state.pos[hit.index * 3 + 1],
			this.state.pos[hit.index * 3 + 2]
		] : this.intersectPlane(e.clientX, e.clientY);
		const ptr = {
			id: e.pointerId,
			cx: e.clientX,
			cy: e.clientY,
			startX: e.clientX,
			startY: e.clientY,
			lastX: e.clientX,
			lastY: e.clientY,
			startedAt: performance.now(),
			indices: [],
			weights: [],
			offsets: /* @__PURE__ */ new Float32Array(0),
			hit: new Vector3(point[0], point[1], point[2])
		};
		if (this.tool === "hand") {
			const grab = collectGrab(this.state, point, GRAB_RADIUS);
			ptr.indices = grab.indices;
			ptr.weights = grab.weights;
			ptr.offsets = new Float32Array(grab.indices.length * 3);
			for (let k = 0; k < grab.indices.length; k++) {
				const i = grab.indices[k];
				ptr.offsets[k * 3] = this.state.pos[i * 3] - point[0];
				ptr.offsets[k * 3 + 1] = this.state.pos[i * 3 + 1] - point[1];
				ptr.offsets[k * 3 + 2] = this.state.pos[i * 3 + 2] - point[2];
			}
			this.pointers.set(e.pointerId, ptr);
			this.assignGrabs();
			return;
		}
		this.pointers.set(e.pointerId, ptr);
		if (this.tool === "gun") {
			this.fireGun(point, ray.dir);
			return;
		}
		this.strokeTool(point, ray.dir, 1, [
			0,
			0,
			0
		], true);
		playPoke(.7);
		haptic(this.muted, 10);
	};
	onMove = (e) => {
		const ptr = this.pointers.get(e.pointerId);
		if (!ptr) return;
		e.preventDefault();
		this.bumpActivity();
		const dx = e.clientX - ptr.lastX;
		const dy = e.clientY - ptr.lastY;
		ptr.lastX = e.clientX;
		ptr.lastY = e.clientY;
		ptr.cx = e.clientX;
		ptr.cy = e.clientY;
		const planePt = this.intersectPlane(e.clientX, e.clientY);
		const smear = [
			planePt[0] - ptr.hit.x,
			planePt[1] - ptr.hit.y,
			planePt[2] - ptr.hit.z
		];
		ptr.hit.set(planePt[0], planePt[1], planePt[2]);
		if (this.tool === "hand") {
			if (this.pointers.size >= 2) {
				const now = performance.now();
				if (now - this.lastStretchAt > 180) {
					playStretch();
					this.lastStretchAt = now;
				}
			}
			this.assignGrabs();
			return;
		}
		if (this.tool === "gun") return;
		const ray = this.pointerRay(e.clientX, e.clientY);
		const dist = Math.hypot(dx, dy);
		this.strokeTool(planePt, ray.dir, Math.min(1.6, .35 + dist * .02), smear, false);
	};
	onUp = (e) => {
		const ptr = this.pointers.get(e.pointerId);
		this.pointers.delete(e.pointerId);
		try {
			this.canvas.releasePointerCapture(e.pointerId);
		} catch {}
		if (!ptr) {
			if (this.pointers.size === 0) {
				this.state.grabWeight.fill(0);
				this.interacting = false;
			}
			return;
		}
		const elapsed = performance.now() - ptr.startedAt;
		const moved = Math.hypot(e.clientX - ptr.startX, e.clientY - ptr.startY);
		if (this.tool === "hand" && moved < 10 && elapsed < 240) {
			const ray = this.pointerRay(ptr.startX, ptr.startY);
			const hit = closestToRay(this.state, ray.origin, ray.dir, .9);
			const pt = hit?.point ?? this.intersectPlane(ptr.startX, ptr.startY);
			applyImpulse(this.state, pt, ray.dir, .48, .16, .55);
			if (hit) this.state.pulse[hit.index] = 1;
			playPoke(.9);
			this.trauma = Math.min(1, this.trauma + .22);
			haptic(this.muted, 12);
		}
		if (this.pointers.size === 0) {
			this.state.grabWeight.fill(0);
			this.interacting = false;
		} else this.assignGrabs();
	};
	assignGrabs() {
		this.state.grabWeight.fill(0);
		for (const ptr of this.pointers.values()) {
			const target = this.intersectPlane(ptr.cx, ptr.cy);
			for (let k = 0; k < ptr.indices.length; k++) {
				const i = ptr.indices[k];
				const w = ptr.weights[k];
				if (w > this.state.grabWeight[i]) {
					this.state.grabWeight[i] = w;
					this.state.grabTarget[i * 3] = target[0] + ptr.offsets[k * 3];
					this.state.grabTarget[i * 3 + 1] = target[1] + ptr.offsets[k * 3 + 1];
					this.state.grabTarget[i * 3 + 2] = target[2] + ptr.offsets[k * 3 + 2];
				}
			}
		}
	}
	strokeTool(point, dir, amount, smear, tap) {
		const nd = Math.hypot(dir[0], dir[1], dir[2]) || 1;
		const d = [
			dir[0] / nd,
			dir[1] / nd,
			dir[2] / nd
		];
		if (this.tool === "spike") applyImpulse(this.state, point, d, .26, tap ? .22 : .07 * amount, .85);
		else if (this.tool === "needle") applyImpulse(this.state, point, d, .12, tap ? .2 : .06 * amount, 1.1);
		else if (this.tool === "trowel") {
			this.camera.getWorldDirection(this.camDir);
			applyPlaneSmear(this.state, point, [
				this.camDir.x,
				this.camDir.y,
				this.camDir.z
			], [
				smear[0] * .85,
				smear[1] * .85,
				smear[2] * .85
			], .58, tap ? .35 : .22);
		} else if (this.tool === "loop") {
			this.camera.getWorldDirection(this.camDir);
			applyScoop(this.state, point, [
				this.camDir.x,
				this.camDir.y,
				this.camDir.z
			], .7, tap ? .08 : .035 * amount);
		}
	}
	fireGun(point, dir) {
		applyImpulse(this.state, point, dir, .5, .42, .7);
		playGun();
		this.trauma = Math.min(1, this.trauma + .7);
		this.flash.position.set(point[0], point[1], point[2]);
		this.flash.intensity = 4.2;
		haptic(this.muted, [
			8,
			30,
			16
		]);
	}
	pointerRay(clientX, clientY) {
		const rect = this.canvas.getBoundingClientRect();
		this.ndc.x = (clientX - rect.left) / rect.width * 2 - 1;
		this.ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
		this.raycaster.setFromCamera(this.ndc, this.camera);
		const o = this.raycaster.ray.origin;
		const d = this.raycaster.ray.direction;
		return {
			origin: [
				o.x,
				o.y,
				o.z
			],
			dir: [
				d.x,
				d.y,
				d.z
			]
		};
	}
	intersectPlane(clientX, clientY) {
		const rect = this.canvas.getBoundingClientRect();
		this.ndc.x = (clientX - rect.left) / rect.width * 2 - 1;
		this.ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
		this.raycaster.setFromCamera(this.ndc, this.camera);
		this.camera.getWorldDirection(this.camDir);
		this.hitPlane.setFromNormalAndCoplanarPoint(this.camDir, this.origin.set(0, 0, 0));
		if (!this.raycaster.ray.intersectPlane(this.hitPlane, this.planeHit)) this.planeHit.copy(this.raycaster.ray.origin).addScaledVector(this.raycaster.ray.direction, this.camDist);
		return [
			this.planeHit.x,
			this.planeHit.y,
			this.planeHit.z
		];
	}
	clampToDisplay() {
		const m = SCREEN_MARGIN;
		const { n, pos, grabWeight } = this.state;
		for (let i = 0; i < n; i++) {
			if (grabWeight[i] > .55) continue;
			this.ndcClamp.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
			this.ndcClamp.project(this.camera);
			let hit = false;
			if (this.ndcClamp.x > 1 - m) {
				this.ndcClamp.x = 1 - m;
				hit = true;
			} else if (this.ndcClamp.x < -1 + m) {
				this.ndcClamp.x = -1 + m;
				hit = true;
			}
			if (this.ndcClamp.y > 1 - m) {
				this.ndcClamp.y = 1 - m;
				hit = true;
			} else if (this.ndcClamp.y < -1 + m) {
				this.ndcClamp.y = -1 + m;
				hit = true;
			}
			if (this.ndcClamp.z > .96) {
				this.ndcClamp.z = .96;
				hit = true;
			} else if (this.ndcClamp.z < .15) {
				this.ndcClamp.z = .15;
				hit = true;
			}
			if (!hit) continue;
			this.ndcClamp.unproject(this.camera);
			pos[i * 3] = this.ndcClamp.x;
			pos[i * 3 + 1] = this.ndcClamp.y;
			pos[i * 3 + 2] = this.ndcClamp.z;
		}
	}
	tick = (now) => {
		if (this.disposed) return;
		const dt = Math.min((now - this.last) / 1e3, .1) || 1 / 60;
		this.last = now;
		if (!this.interacting) this.idleFor += dt;
		else this.idleFor = 0;
		const rec = !this.interacting && this.idleFor > 1.25;
		if (rec !== this.recovering) {
			this.recovering = rec;
			this.hooks.onRecovering(rec);
		}
		if (!this.reducedMotion && !this.interacting) this.camYaw += dt * .12;
		this.placeCamera(dt);
		const snaps = stepPhysics(this.state, {
			dt,
			idleFor: this.idleFor,
			interacting: this.interacting,
			worldRadius: 3.4,
			reducedMotion: this.reducedMotion
		});
		if (snaps > 0) playSnap(snaps);
		this.clampToDisplay();
		this.trauma = Math.max(0, this.trauma - dt * 1.8);
		this.flash.intensity *= Math.exp(-8 * dt);
		this.syncInstances();
		this.updateShadow();
		this.renderer.render(this.scene, this.camera);
	};
	placeCamera(dt) {
		const yaw = this.camYaw;
		const pitch = this.camPitch;
		const dist = this.camDist;
		const shake = this.trauma * this.trauma;
		const ox = (Math.random() * 2 - 1) * shake * .08;
		const oy = (Math.random() * 2 - 1) * shake * .06;
		const x = Math.sin(yaw) * Math.cos(pitch) * dist + ox;
		const y = Math.sin(pitch) * dist + .15 + oy;
		const z = Math.cos(yaw) * Math.cos(pitch) * dist;
		this.tmp.set(x, y, z);
		this.camera.position.lerp(this.tmp, 1 - Math.exp(-8 * dt));
		this.camera.lookAt(0, 0, 0);
		this.camera.up.set(0, 1, 0);
	}
	updateShadow() {
		let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, minY = Infinity;
		const { n, pos } = this.state;
		for (let i = 0; i < n; i++) {
			const x = pos[i * 3];
			const y = pos[i * 3 + 1];
			const z = pos[i * 3 + 2];
			if (x < minX) minX = x;
			if (x > maxX) maxX = x;
			if (z < minZ) minZ = z;
			if (z > maxZ) maxZ = z;
			if (y < minY) minY = y;
		}
		const sx = Math.max(.8, (maxX - minX) * .7 + .4);
		const sz = Math.max(.8, (maxZ - minZ) * .7 + .4);
		this.shadow.scale.set(sx, sz, 1);
		this.shadow.position.set((minX + maxX) * .5, Math.min(-1.35, minY - .45), (minZ + maxZ) * .5);
		this.shadow.material.opacity = .18 + .12 * (1 - Math.min(1, (maxX - minX + maxZ - minZ) / 6));
	}
	syncInstances() {
		const { n, pos, pulse, strain, baseColor } = this.state;
		for (let i = 0; i < n; i++) {
			const i3 = i * 3;
			const s = 1 - pulse[i] * .16 + strain[i] * .04;
			this.dummy.position.set(pos[i3], pos[i3 + 1], pos[i3 + 2]);
			this.dummy.scale.setScalar(s);
			this.dummy.updateMatrix();
			this.mesh.setMatrixAt(i, this.dummy.matrix);
			const t = strain[i];
			const r = baseColor[i3] * (1 - t * .35) + .55 * t;
			const g = baseColor[i3 + 1] * (1 - t * .2) + .58 * t;
			const b = baseColor[i3 + 2] * (1 - t * .05) + .62 * t;
			this.color.setRGB(r, g, b);
			this.mesh.setColorAt(i, this.color);
		}
		this.mesh.instanceMatrix.needsUpdate = true;
		if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
	}
};
function prevent(e) {
	e.preventDefault();
}
function haptic(muted, pattern) {
	if (muted) return;
	try {
		navigator.vibrate?.(pattern);
	} catch {}
}
function padRest(rest, n) {
	if (rest.length / 3 === n) return rest;
	const out = new Float32Array(n * 3);
	const m = rest.length / 3;
	if (m === 0) return out;
	for (let i = 0; i < n; i++) {
		const j = i % m;
		out[i * 3] = rest[j * 3];
		out[i * 3 + 1] = rest[j * 3 + 1];
		out[i * 3 + 2] = rest[j * 3 + 2];
		if (i >= m) {
			out[i * 3] += i * 13 % 5 * .02;
			out[i * 3 + 1] -= .35 + i * 7 % 4 * .12;
		}
	}
	return out;
}
//#endregion
export { FidgetEngine };
