import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import {
  GRAB_RADIUS,
  SCREEN_MARGIN,
  VOXEL_SIZE,
  VOXEL_SPACING,
} from "./constants";
import {
  applyImpulse,
  applyPlaneSmear,
  applyScoop,
  closestToRay,
  collectGrab,
  createState,
  rematchRest,
  resetToRest,
  stepPhysics,
} from "./physics";
import { buildGun, buildLump, cellsToRest } from "./shapes";
import {
  playGun,
  playPoke,
  playReset,
  playSnap,
  playStretch,
  resumeAudioIfNeeded,
  unlockAudio,
} from "./audio";
import type { FidgetState, ShapeId, ToolId } from "./types";

export type EngineHooks = {
  onRecovering: (v: boolean) => void;
  onVoxelCount: (n: number) => void;
  onReady: () => void;
};

type Pointer = {
  id: number;
  cx: number;
  cy: number;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  startedAt: number;
  indices: number[];
  weights: number[];
  offsets: Float32Array;
  hit: THREE.Vector3;
};

const CLAY = [
  [0.78, 0.42, 0.24],
  [0.7, 0.36, 0.2],
  [0.82, 0.5, 0.3],
  [0.64, 0.34, 0.22],
  [0.74, 0.46, 0.28],
  [0.6, 0.32, 0.2],
];

const GUNMETAL = [
  [0.42, 0.44, 0.46],
  [0.36, 0.37, 0.4],
  [0.5, 0.5, 0.48],
  [0.3, 0.31, 0.34],
  [0.46, 0.4, 0.32],
];

export class FidgetEngine {
  private canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private mesh: THREE.InstancedMesh;
  private dummy = new THREE.Object3D();
  private color = new THREE.Color();
  private state: FidgetState;
  private tool: ToolId = "hand";
  private shape: ShapeId = "lump";
  private pointers = new Map<number, Pointer>();
  private hooks: EngineHooks;
  private disposed = false;
  private last = 0;
  private idleFor = 0;
  private interacting = false;
  private recovering = false;
  private trauma = 0;
  private camYaw = 0.35;
  private camPitch = 0.18;
  private camDist = 4.35;
  private reducedMotion: boolean;
  private flash: THREE.PointLight;
  private shadow: THREE.Mesh;
  private raycaster = new THREE.Raycaster();
  private ndc = new THREE.Vector2();
  private hitPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  private planeHit = new THREE.Vector3();
  private camDir = new THREE.Vector3();
  private origin = new THREE.Vector3();
  private tmp = new THREE.Vector3();
  private lastStretchAt = 0;
  private muted = false;
  private geom: THREE.BufferGeometry;
  private mat: THREE.MeshPhongMaterial;
  private ndcClamp = new THREE.Vector3();
  private shapePull = 0;

  constructor(canvas: HTMLCanvasElement, hooks: EngineHooks) {
    this.canvas = canvas;
    this.hooks = hooks;
    this.reducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const rest = cellsToRest(buildLump(), VOXEL_SPACING);
    this.state = createState(rest);
    hooks.onVoxelCount(this.state.n);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.setClearColor(0x0c0b0a, 1);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0c0b0a);
    this.scene.fog = new THREE.Fog(0x0c0b0a, 6.5, 12);

    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 30);
    this.camera.position.set(0, 0.2, this.camDist);

    const hemi = new THREE.HemisphereLight(0xf0e6d8, 0x1a1612, 0.72);
    this.scene.add(hemi);
    const key = new THREE.DirectionalLight(0xfff1e2, 1.15);
    key.position.set(2.4, 3.2, 2.8);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0x8aa0b8, 0.28);
    fill.position.set(-2.6, 0.4, 1.4);
    this.scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffd8b8, 0.22);
    rim.position.set(-0.6, 1.4, -3.2);
    this.scene.add(rim);

    this.flash = new THREE.PointLight(0xffe6c8, 0, 4.5);
    this.scene.add(this.flash);

    const shadowGeo = new THREE.CircleGeometry(1.6, 32);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
    });
    this.shadow = new THREE.Mesh(shadowGeo, shadowMat);
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = -1.55;
    this.scene.add(this.shadow);

    this.geom = new RoundedBoxGeometry(
      VOXEL_SIZE,
      VOXEL_SIZE,
      VOXEL_SIZE,
      1,
      VOXEL_SIZE * 0.16,
    );
    this.mat = new THREE.MeshPhongMaterial({
      color: 0xffffff,
      shininess: 34,
      specular: 0x3a322c,
    });
    this.mesh = new THREE.InstancedMesh(this.geom, this.mat, this.state.n);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);

    this.resize();
    this.bind();
    this.syncInstances();
  }

  setTool(tool: ToolId) {
    this.tool = tool;
  }

  setMuted(v: boolean) {
    this.muted = v;
  }

  morphTo(shape: ShapeId) {
    this.shape = shape;
    const cells = shape === "gun" ? buildGun() : buildLump();
    const rest = cellsToRest(cells, VOXEL_SPACING);
    rematchRest(this.state, padRest(rest, this.state.n));
    const palette = shape === "gun" ? GUNMETAL : CLAY;
    for (let i = 0; i < this.state.n; i++) {
      const c = palette[i % palette.length]!;
      this.state.baseColor[i * 3] = c[0]!;
      this.state.baseColor[i * 3 + 1] = c[1]!;
      this.state.baseColor[i * 3 + 2] = c[2]!;
    }
    this.shapePull = 1;
    this.interacting = false;
    this.idleFor = 2.2;
  }

  reset() {
    this.clearPointers();
    resetToRest(this.state);
    playReset();
    this.idleFor = 4;
    this.trauma = 0.08;
    this.shapePull = 0;
    this.interacting = false;
  }

  pokeCenter() {
    applyImpulse(this.state, [0, 0, 1.2], [0, 0, -1], 0.55, 0.1, 0.35);
    playPoke(0.7);
    this.idleFor = 0;
    this.interacting = false;
    this.trauma = Math.min(1, this.trauma + 0.18);
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
    (this.shadow.material as THREE.Material).dispose();
    this.shadow.geometry.dispose();
    this.mesh.dispose();
    this.renderer.dispose();
  }

  private bind() {
    this.canvas.addEventListener("pointerdown", this.onDown);
    this.canvas.addEventListener("pointermove", this.onMove);
    this.canvas.addEventListener("pointerup", this.onUp);
    this.canvas.addEventListener("pointercancel", this.onUp);
    this.canvas.addEventListener("contextmenu", prevent);
    window.addEventListener("resize", this.resize);
    document.addEventListener("visibilitychange", this.onVis);
    window.addEventListener("blur", this.onBlur);
  }

  private unbind() {
    this.canvas.removeEventListener("pointerdown", this.onDown);
    this.canvas.removeEventListener("pointermove", this.onMove);
    this.canvas.removeEventListener("pointerup", this.onUp);
    this.canvas.removeEventListener("pointercancel", this.onUp);
    this.canvas.removeEventListener("contextmenu", prevent);
    window.removeEventListener("resize", this.resize);
    document.removeEventListener("visibilitychange", this.onVis);
    window.removeEventListener("blur", this.onBlur);
  }

  private onVis = () => {
    resumeAudioIfNeeded();
    if (document.visibilityState !== "visible") this.clearPointers();
  };

  private onBlur = () => this.clearPointers();

  private resize = () => {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
  };

  private clearPointers() {
    this.pointers.clear();
    this.state.grabWeight.fill(0);
    this.interacting = false;
  }

  private bumpActivity() {
    this.idleFor = 0;
    this.interacting = true;
  }

  private onDown = (e: PointerEvent) => {
    unlockAudio();
    e.preventDefault();
    this.canvas.setPointerCapture(e.pointerId);
    this.bumpActivity();

    const ray = this.pointerRay(e.clientX, e.clientY);
    const hit = closestToRay(this.state, ray.origin, ray.dir, 0.85);
    const point = hit
      ? ([
          this.state.pos[hit.index * 3]!,
          this.state.pos[hit.index * 3 + 1]!,
          this.state.pos[hit.index * 3 + 2]!,
        ] as [number, number, number])
      : this.intersectPlane(e.clientX, e.clientY);

    const ptr: Pointer = {
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
      offsets: new Float32Array(0),
      hit: new THREE.Vector3(point[0], point[1], point[2]),
    };

    if (this.tool === "hand") {
      const grab = collectGrab(this.state, point, GRAB_RADIUS);
      ptr.indices = grab.indices;
      ptr.weights = grab.weights;
      ptr.offsets = new Float32Array(grab.indices.length * 3);
      for (let k = 0; k < grab.indices.length; k++) {
        const i = grab.indices[k]!;
        ptr.offsets[k * 3] = this.state.pos[i * 3]! - point[0];
        ptr.offsets[k * 3 + 1] = this.state.pos[i * 3 + 1]! - point[1];
        ptr.offsets[k * 3 + 2] = this.state.pos[i * 3 + 2]! - point[2];
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

    this.strokeTool(point, ray.dir, 1, [0, 0, 0], true);
    playPoke(0.7);
    haptic(this.muted, 10);
  };

  private onMove = (e: PointerEvent) => {
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
    const smear: [number, number, number] = [
      planePt[0] - ptr.hit.x,
      planePt[1] - ptr.hit.y,
      planePt[2] - ptr.hit.z,
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
    this.strokeTool(
      planePt,
      ray.dir,
      Math.min(1.6, 0.35 + dist * 0.02),
      smear,
      false,
    );
  };

  private onUp = (e: PointerEvent) => {
    const ptr = this.pointers.get(e.pointerId);
    this.pointers.delete(e.pointerId);
    try {
      this.canvas.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
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
      const hit = closestToRay(this.state, ray.origin, ray.dir, 0.9);
      const pt = hit?.point ?? this.intersectPlane(ptr.startX, ptr.startY);
      applyImpulse(this.state, pt, ray.dir, 0.42, 0.11, 0.4);
      if (hit) this.state.pulse[hit.index] = 1;
      playPoke(0.9);
      this.trauma = Math.min(1, this.trauma + 0.22);
      haptic(this.muted, 12);
    }

    if (this.pointers.size === 0) {
      this.state.grabWeight.fill(0);
      this.interacting = false;
    } else {
      this.assignGrabs();
    }
  };

  private assignGrabs() {
    this.state.grabWeight.fill(0);
    for (const ptr of this.pointers.values()) {
      const target = this.intersectPlane(ptr.cx, ptr.cy);
      for (let k = 0; k < ptr.indices.length; k++) {
        const i = ptr.indices[k]!;
        const w = ptr.weights[k]!;
        if (w > this.state.grabWeight[i]!) {
          this.state.grabWeight[i] = w;
          this.state.grabTarget[i * 3] = target[0] + ptr.offsets[k * 3]!;
          this.state.grabTarget[i * 3 + 1] = target[1] + ptr.offsets[k * 3 + 1]!;
          this.state.grabTarget[i * 3 + 2] = target[2] + ptr.offsets[k * 3 + 2]!;
        }
      }
    }
  }

  private strokeTool(
    point: [number, number, number],
    dir: [number, number, number],
    amount: number,
    smear: [number, number, number],
    tap: boolean,
  ) {
    const nd = Math.hypot(dir[0], dir[1], dir[2]) || 1;
    const d: [number, number, number] = [dir[0] / nd, dir[1] / nd, dir[2] / nd];
    if (this.tool === "spike") {
      applyImpulse(this.state, point, d, 0.26, tap ? 0.22 : 0.07 * amount, 0.85);
    } else if (this.tool === "needle") {
      applyImpulse(this.state, point, d, 0.12, tap ? 0.2 : 0.06 * amount, 1.1);
    } else if (this.tool === "trowel") {
      this.camera.getWorldDirection(this.camDir);
      applyPlaneSmear(
        this.state,
        point,
        [this.camDir.x, this.camDir.y, this.camDir.z],
        [smear[0] * 0.85, smear[1] * 0.85, smear[2] * 0.85],
        0.58,
        tap ? 0.35 : 0.22,
      );
    } else if (this.tool === "loop") {
      this.camera.getWorldDirection(this.camDir);
      applyScoop(
        this.state,
        point,
        [this.camDir.x, this.camDir.y, this.camDir.z],
        0.7,
        tap ? 0.08 : 0.035 * amount,
      );
    }
  }

  private fireGun(
    point: [number, number, number],
    dir: [number, number, number],
  ) {
    applyImpulse(this.state, point, dir, 0.5, 0.42, 0.7);
    playGun();
    this.trauma = Math.min(1, this.trauma + 0.7);
    this.flash.position.set(point[0], point[1], point[2]);
    this.flash.intensity = 4.2;
    haptic(this.muted, [8, 30, 16]);
  }

  private pointerRay(clientX: number, clientY: number) {
    const rect = this.canvas.getBoundingClientRect();
    this.ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const o = this.raycaster.ray.origin;
    const d = this.raycaster.ray.direction;
    return {
      origin: [o.x, o.y, o.z] as [number, number, number],
      dir: [d.x, d.y, d.z] as [number, number, number],
    };
  }

  private intersectPlane(
    clientX: number,
    clientY: number,
  ): [number, number, number] {
    const rect = this.canvas.getBoundingClientRect();
    this.ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.ndc, this.camera);
    this.camera.getWorldDirection(this.camDir);
    this.hitPlane.setFromNormalAndCoplanarPoint(
      this.camDir,
      this.origin.set(0, 0, 0),
    );
    const ok = this.raycaster.ray.intersectPlane(this.hitPlane, this.planeHit);
    if (!ok) {
      this.planeHit
        .copy(this.raycaster.ray.origin)
        .addScaledVector(this.raycaster.ray.direction, this.camDist);
    }
    return [this.planeHit.x, this.planeHit.y, this.planeHit.z];
  }

  private clampToDisplay() {
    const m = SCREEN_MARGIN;
    const { n, pos, grabWeight } = this.state;
    for (let i = 0; i < n; i++) {
      if (grabWeight[i]! > 0.55) continue;
      this.ndcClamp.set(pos[i * 3]!, pos[i * 3 + 1]!, pos[i * 3 + 2]!);
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
      if (this.ndcClamp.z > 0.96) {
        this.ndcClamp.z = 0.96;
        hit = true;
      } else if (this.ndcClamp.z < 0.15) {
        this.ndcClamp.z = 0.15;
        hit = true;
      }
      if (!hit) continue;
      this.ndcClamp.unproject(this.camera);
      pos[i * 3] = this.ndcClamp.x;
      pos[i * 3 + 1] = this.ndcClamp.y;
      pos[i * 3 + 2] = this.ndcClamp.z;
    }
  }

  private tick = (now: number) => {
    if (this.disposed) return;
    const dt = Math.min((now - this.last) / 1000, 0.1) || 1 / 60;
    this.last = now;

    if (!this.interacting) this.idleFor += dt;
    else this.idleFor = 0;

    const rec = !this.interacting && this.idleFor > 1.25;
    if (rec !== this.recovering) {
      this.recovering = rec;
      this.hooks.onRecovering(rec);
    }

    if (!this.reducedMotion && !this.interacting) {
      this.camYaw += dt * 0.12;
    }
    this.placeCamera(dt);

    const snaps = stepPhysics(this.state, {
      dt,
      idleFor: this.idleFor + this.shapePull * 2.4,
      interacting: this.interacting && this.shapePull < 0.15,
      worldRadius: 3.4,
      reducedMotion: this.reducedMotion,
    });
    this.shapePull *= Math.exp(-0.55 * dt);
    if (snaps > 0) playSnap(snaps);
    this.clampToDisplay();

    this.trauma = Math.max(0, this.trauma - dt * 1.8);
    this.flash.intensity *= Math.exp(-8 * dt);

    this.syncInstances();
    this.updateShadow();
    this.renderer.render(this.scene, this.camera);
  };

  private placeCamera(dt: number) {
    const yaw = this.camYaw;
    const pitch = this.camPitch;
    const dist = this.camDist;
    const shake = this.trauma * this.trauma;
    const ox = (Math.random() * 2 - 1) * shake * 0.08;
    const oy = (Math.random() * 2 - 1) * shake * 0.06;
    const x = Math.sin(yaw) * Math.cos(pitch) * dist + ox;
    const y = Math.sin(pitch) * dist + 0.15 + oy;
    const z = Math.cos(yaw) * Math.cos(pitch) * dist;
    this.tmp.set(x, y, z);
    this.camera.position.lerp(this.tmp, 1 - Math.exp(-8 * dt));
    this.camera.lookAt(0, 0, 0);
    this.camera.up.set(0, 1, 0);
  }

  private updateShadow() {
    let minX = Infinity,
      maxX = -Infinity,
      minZ = Infinity,
      maxZ = -Infinity,
      minY = Infinity;
    const { n, pos } = this.state;
    for (let i = 0; i < n; i++) {
      const x = pos[i * 3]!;
      const y = pos[i * 3 + 1]!;
      const z = pos[i * 3 + 2]!;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
      if (y < minY) minY = y;
    }
    const sx = Math.max(0.8, (maxX - minX) * 0.7 + 0.4);
    const sz = Math.max(0.8, (maxZ - minZ) * 0.7 + 0.4);
    this.shadow.scale.set(sx, sz, 1);
    this.shadow.position.set(
      (minX + maxX) * 0.5,
      Math.min(-1.35, minY - 0.45),
      (minZ + maxZ) * 0.5,
    );
    (this.shadow.material as THREE.MeshBasicMaterial).opacity =
      0.18 + 0.12 * (1 - Math.min(1, (maxX - minX + maxZ - minZ) / 6));
  }

  private syncInstances() {
    const { n, pos, pulse, strain, baseColor } = this.state;
    for (let i = 0; i < n; i++) {
      const i3 = i * 3;
      const s = 1 - pulse[i]! * 0.16 + strain[i]! * 0.04;
      this.dummy.position.set(pos[i3]!, pos[i3 + 1]!, pos[i3 + 2]!);
      this.dummy.scale.setScalar(s);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
      const t = strain[i]!;
      const r = baseColor[i3]! * (1 - t * 0.35) + 0.55 * t;
      const g = baseColor[i3 + 1]! * (1 - t * 0.2) + 0.58 * t;
      const b = baseColor[i3 + 2]! * (1 - t * 0.05) + 0.62 * t;
      this.color.setRGB(r, g, b);
      this.mesh.setColorAt(i, this.color);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

function prevent(e: Event) {
  e.preventDefault();
}

function haptic(muted: boolean, pattern: number | number[]) {
  if (muted) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* ignore */
  }
}

function padRest(rest: Float32Array, n: number): Float32Array {
  if (rest.length / 3 === n) return rest;
  const out = new Float32Array(n * 3);
  const m = rest.length / 3;
  if (m === 0) return out;
  for (let i = 0; i < n; i++) {
    const j = i % m;
    out[i * 3] = rest[j * 3]!;
    out[i * 3 + 1] = rest[j * 3 + 1]!;
    out[i * 3 + 2] = rest[j * 3 + 2]!;
    if (i >= m) {
      out[i * 3] += ((i * 13) % 5) * 0.02;
      out[i * 3 + 1] -= 0.35 + ((i * 7) % 4) * 0.12;
    }
  }
  return out;
}
