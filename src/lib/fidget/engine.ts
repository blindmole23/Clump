import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import {
  BALL_RADIUS,
  BOUNCE,
  CAMERA_DIST_BASE,
  CLUMP_SCREEN_OFFSET,
  CUBE_SIZE,
  GRAB_RADIUS,
  GRAVITY,
  MAGNET_DELAY,
  MAGNET_SIZE_SCALE,
  PLANE_HEIGHT_BALLS,
  PLANE_SIZE_BALLS,
  PLAY_RADIUS,
  TROUGH_HEIGHT_BALLS,
  TROUGH_LENGTH_BALLS,
  TROUGH_WIDTH_BALLS,
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
  type Containment,
} from "./physics";
import { buildCube, buildGun, cellsToRest } from "./shapes";
import {
  playGun,
  playPoke,
  playReset,
  playSnap,
  playStretch,
  resumeAudioIfNeeded,
  unlockAudio,
} from "./audio";
import type { FidgetState, MagnetSize, Mode, ShapeId, ToolId } from "./types";

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
  private camDist = CAMERA_DIST_BASE;
  private hasDetached = false;
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
  private lookTarget = new THREE.Vector3();
  private lastStretchAt = 0;
  private muted = false;
  private geom: THREE.BufferGeometry;
  private mat: THREE.MeshStandardMaterial;
  private envTexture: THREE.Texture;
  private shapePull = 0;
  private mode: Mode = "floaty";
  private containment: Containment = { kind: "sphere", radius: PLAY_RADIUS };
  private cameraPresetIndex = 0;
  private boundaryMesh: THREE.LineSegments | null = null;
  private showBoundary = false;

  constructor(canvas: HTMLCanvasElement, hooks: EngineHooks) {
    this.canvas = canvas;
    this.hooks = hooks;
    this.reducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const rest = cellsToRest(buildCube(CUBE_SIZE), VOXEL_SPACING);
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
    // Metal + an environment map needs real tone mapping, or the reflected
    // light range renders muddy/near-black instead of a proper metal sheen.
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0c0b0a);
    this.scene.fog = new THREE.Fog(0x0c0b0a, 6.5, 12);

    // Metal needs something to reflect or it renders near-black outside its
    // direct specular highlights. A tiny procedural room is the standard
    // cheap way to get that: generated once here, sampled per-pixel after —
    // no texture download, no per-frame cost beyond a normal cubemap lookup.
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    this.scene.environment = this.envTexture;

    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 30);
    // Snap straight to the steady-state orbit position/framing instead of a
    // mismatched fixed point the render loop then has to lerp away from.
    this.placeCamera(0, true);

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

    // Low segment counts on purpose — this is one geometry instanced ~260
    // times, and a shiny sphere reads as smooth well before 16x12 segments.
    this.geom = new THREE.SphereGeometry(BALL_RADIUS, 14, 10);
    this.mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      metalness: 0.92,
      roughness: 0.28,
      envMapIntensity: 1.4,
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

  setMode(mode: Mode) {
    this.mode = mode;
    this.containment = this.containmentFor(mode);
    this.cameraPresetIndex = 0;
    this.dropIntoMode();
    this.updateBoundaryMesh();
    this.placeCamera(0, true);
    // The floating drop-shadow disc is a floaty-only illusion; the gravity
    // modes have a real floor (and, in Trough, real walls) instead.
    this.shadow.visible = mode === "floaty";
    // Fog was tuned for floaty mode's ~4-unit camera distance around a small
    // clump. Trough/Plane cameras sit much farther back to frame a much
    // bigger play area, so the same fog distances would fade the whole scene
    // to nothing before the camera preset ever got there.
    const fog = this.scene.fog as THREE.Fog;
    if (mode === "floaty") {
      fog.near = 6.5;
      fog.far = 12;
    } else {
      fog.near = 14;
      fog.far = 26;
    }
    this.trauma = 0;
    this.shapePull = 0;
    this.interacting = false;
    this.hasDetached = false;
    this.idleFor = 0;
    if (this.recovering) {
      this.recovering = false;
      this.hooks.onRecovering(false);
    }
  }

  /** Cycle to the next fixed camera angle. A no-op in floaty mode, which
   * keeps its own auto-orbit instead of manual angles. */
  cycleCamera() {
    if (this.mode === "floaty") return;
    const presets = this.cameraPresets(this.mode);
    this.cameraPresetIndex = (this.cameraPresetIndex + 1) % presets.length;
  }

  /** Dev/testing aid: the Trough and Plane containers are invisible to a
   * player during normal play, but this reveals their bounds as a wireframe
   * so the box dimensions can be checked visually. */
  toggleBoundary() {
    this.showBoundary = !this.showBoundary;
    if (this.boundaryMesh) this.boundaryMesh.visible = this.showBoundary;
  }

  private containmentFor(mode: Mode): Containment {
    if (mode === "floaty") return { kind: "sphere", radius: PLAY_RADIUS };
    if (mode === "trough") {
      return {
        kind: "box",
        halfX: (TROUGH_WIDTH_BALLS * VOXEL_SPACING) / 2,
        halfZ: (TROUGH_LENGTH_BALLS * VOXEL_SPACING) / 2,
        floorY: 0,
        ceilY: TROUGH_HEIGHT_BALLS * VOXEL_SPACING,
        bounce: BOUNCE,
      };
    }
    const half = (PLANE_SIZE_BALLS * VOXEL_SPACING) / 2;
    return { kind: "box", halfX: half, halfZ: half, floorY: 0, ceilY: null, bounce: BOUNCE };
  }

  /** Re-seeds the clump above the container's floor so switching into a
   * gravity mode (or resetting inside one) reads as a visible drop, rather
   * than the cube just appearing already resting on the ground. */
  private dropIntoMode() {
    resetToRest(this.state);
    const c = this.containment;
    if (c.kind !== "box") return;
    const halfCube = ((CUBE_SIZE - 1) / 2) * VOXEL_SPACING;
    const dropClearance = 1.4;
    const offsetY = c.floorY + halfCube + dropClearance;
    for (let i = 0; i < this.state.n; i++) {
      this.state.pos[i * 3 + 1] = this.state.pos[i * 3 + 1]! + offsetY;
      this.state.prev[i * 3 + 1] = this.state.prev[i * 3 + 1]! + offsetY;
    }
  }

  private cameraPresets(
    mode: Mode,
  ): { pos: [number, number, number]; look: [number, number, number]; up: [number, number, number] }[] {
    const Y_UP: [number, number, number] = [0, 1, 0];
    // A camera looking near-straight down has its view direction parallel to
    // the default (0,1,0) up vector, which makes lookAt's basis degenerate —
    // THREE then picks an arbitrary roll, which is what produced the "diamond
    // rotated 45 degrees" top-down shots. Tilting up toward -Z instead of
    // straight up avoids ever being parallel to a purely vertical view.
    const TOP_DOWN_UP: [number, number, number] = [0, 0, -1];

    if (mode === "trough") {
      const halfX = (TROUGH_WIDTH_BALLS * VOXEL_SPACING) / 2;
      const halfZ = (TROUGH_LENGTH_BALLS * VOXEL_SPACING) / 2;
      const h = TROUGH_HEIGHT_BALLS * VOXEL_SPACING;
      return [
        { pos: [halfX * 2.4, h * 2.1, halfZ * 1.2], look: [0, h * 0.3, 0], up: Y_UP },
        // Eye-level, straight-on: the trough itself has no visible walls
        // (that's the point — the boundary is only a felt one, revealed on
        // demand by the debug wireframe), so a "down the length" shot has
        // nothing to anchor it visually. A close, level front view is the
        // more useful second angle instead.
        { pos: [halfX * 4.5, h * 0.55, halfX * 4.5], look: [0, h * 0.3, 0], up: Y_UP },
        { pos: [0.001, halfZ * 1.05, 0.001], look: [0, h * 0.4, 0], up: TOP_DOWN_UP },
      ];
    }
    const half = (PLANE_SIZE_BALLS * VOXEL_SPACING) / 2;
    const wallH = PLANE_HEIGHT_BALLS * VOXEL_SPACING;
    return [
      { pos: [half * 0.5, half * 0.48, half * 0.5], look: [0, wallH * 0.2, 0], up: Y_UP },
      { pos: [0.001, half * 1.1, 0.001], look: [0, wallH * 0.4, 0], up: TOP_DOWN_UP },
      { pos: [half * 0.28, wallH * 0.9, half * 0.28], look: [0, wallH * 0.25, 0], up: Y_UP },
    ];
  }

  private updateBoundaryMesh() {
    if (this.boundaryMesh) {
      this.scene.remove(this.boundaryMesh);
      this.boundaryMesh.geometry.dispose();
      (this.boundaryMesh.material as THREE.Material).dispose();
      this.boundaryMesh = null;
    }
    const c = this.containment;
    if (c.kind !== "box") return;
    const height = c.ceilY != null ? c.ceilY - c.floorY : PLANE_HEIGHT_BALLS * VOXEL_SPACING;
    const box = new THREE.BoxGeometry(c.halfX * 2, height, c.halfZ * 2);
    const edges = new THREE.EdgesGeometry(box);
    box.dispose();
    const mat = new THREE.LineBasicMaterial({ color: 0x4dffe0, transparent: true, opacity: 0.55 });
    this.boundaryMesh = new THREE.LineSegments(edges, mat);
    this.boundaryMesh.position.set(0, c.floorY + height / 2, 0);
    this.boundaryMesh.visible = this.showBoundary;
    this.scene.add(this.boundaryMesh);
  }

  setMagnetSize(size: MagnetSize) {
    this.camDist = CAMERA_DIST_BASE * MAGNET_SIZE_SCALE[size];
  }

  morphTo(shape: ShapeId) {
    this.shape = shape;
    const cells = shape === "gun" ? buildGun() : buildCube(CUBE_SIZE);
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
    this.dropIntoMode();
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
    this.envTexture.dispose();
    (this.shadow.material as THREE.Material).dispose();
    this.shadow.geometry.dispose();
    this.mesh.dispose();
    if (this.boundaryMesh) {
      this.boundaryMesh.geometry.dispose();
      (this.boundaryMesh.material as THREE.Material).dispose();
    }
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

    if (this.tool === "needle") {
      // Precision single-magnet grab for testing: full weight, no falloff,
      // and a much tighter hit tolerance than Hand so it targets exactly
      // one block instead of collecting everything nearby.
      const needleHit = closestToRay(this.state, ray.origin, ray.dir, 0.3);
      if (needleHit) {
        const i = needleHit.index;
        const nx = this.state.pos[i * 3]!;
        const ny = this.state.pos[i * 3 + 1]!;
        const nz = this.state.pos[i * 3 + 2]!;
        ptr.hit.set(nx, ny, nz);
        ptr.indices = [i];
        ptr.weights = [1];
        ptr.offsets = new Float32Array([0, 0, 0]);
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

    if (this.tool === "hand" || this.tool === "needle") {
      if (this.tool === "hand" && this.pointers.size >= 2) {
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
    this.strokeTool(planePt, ray.dir, Math.min(1.6, 0.35 + dist * 0.02), smear, false);
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
      applyScoop(this.state, point, [this.camDir.x, this.camDir.y, this.camDir.z], 0.7, tap ? 0.08 : 0.035 * amount);
    }
  }

  private fireGun(point: [number, number, number], dir: [number, number, number]) {
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

  private intersectPlane(clientX: number, clientY: number): [number, number, number] {
    const rect = this.canvas.getBoundingClientRect();
    this.ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.ndc, this.camera);
    this.camera.getWorldDirection(this.camDir);
    this.hitPlane.setFromNormalAndCoplanarPoint(this.camDir, this.origin.set(0, 0, 0));
    const ok = this.raycaster.ray.intersectPlane(this.hitPlane, this.planeHit);
    if (!ok) {
      this.planeHit.copy(this.raycaster.ray.origin).addScaledVector(this.raycaster.ray.direction, this.camDist);
    }
    return [this.planeHit.x, this.planeHit.y, this.planeHit.z];
  }

  private tick = (now: number) => {
    if (this.disposed) return;
    const dt = Math.min((now - this.last) / 1000, 0.1) || 1 / 60;
    this.last = now;

    if (!this.interacting) this.idleFor += dt;
    else this.idleFor = 0;

    // Detached-piece framing: the auto-orbit swings anything off-origin
    // around the clump, so pause it while a piece is loose and resume once
    // everything's reformed. Uses last frame's cluster count — this frame's
    // is only known after stepPhysics runs, one line down. Only floaty mode
    // auto-orbits at all; Trough/Plane use fixed angles the player cycles.
    if (this.mode === "floaty" && !this.reducedMotion && !this.interacting && !this.hasDetached) {
      this.camYaw += dt * 0.12;
    }
    this.placeCamera(dt);

    const floaty = this.mode === "floaty";
    const { snaps, hasDetached } = stepPhysics(this.state, {
      dt,
      interacting: this.interacting && this.shapePull < 0.15,
      gravity: floaty ? 0 : GRAVITY,
      magnetHoming: floaty,
      elasticHome: floaty,
      containment: this.containment,
    });
    this.hasDetached = hasDetached;
    this.shapePull *= Math.exp(-0.55 * dt);
    if (snaps > 0) playSnap(snaps);

    // "Remembering" (idle magnetic homing) only exists in floaty mode.
    const rec = floaty && !this.interacting && this.idleFor > MAGNET_DELAY && hasDetached;
    if (rec !== this.recovering) {
      this.recovering = rec;
      this.hooks.onRecovering(rec);
    }

    this.trauma = Math.max(0, this.trauma - dt * 1.8);
    this.flash.intensity *= Math.exp(-8 * dt);

    this.syncInstances();
    if (floaty) this.updateShadow();
    this.renderer.render(this.scene, this.camera);
  };

  private placeCamera(dt: number, instant = false) {
    if (this.mode !== "floaty") {
      const preset = this.cameraPresets(this.mode)[this.cameraPresetIndex]!;
      this.tmp.set(preset.pos[0], preset.pos[1], preset.pos[2]);
      if (instant) this.camera.position.copy(this.tmp);
      else this.camera.position.lerp(this.tmp, 1 - Math.exp(-8 * dt));
      this.camera.up.set(preset.up[0], preset.up[1], preset.up[2]);
      this.lookTarget.set(preset.look[0], preset.look[1], preset.look[2]);
      this.camera.lookAt(this.lookTarget);
      return;
    }

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
    if (instant) {
      this.camera.position.copy(this.tmp);
    } else {
      this.camera.position.lerp(this.tmp, 1 - Math.exp(-8 * dt));
    }
    // Aim slightly to the camera's own right (not straight at the clump) so
    // the clump renders left-of-center, leaving open space on the right to
    // pull chunks into — this tracks the current yaw so it holds as the
    // camera auto-orbits.
    const rightX = Math.cos(yaw);
    const rightZ = -Math.sin(yaw);
    this.lookTarget.set(rightX * CLUMP_SCREEN_OFFSET, 0, rightZ * CLUMP_SCREEN_OFFSET);
    this.camera.lookAt(this.lookTarget);
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
    this.shadow.position.set((minX + maxX) * 0.5, Math.min(-1.35, minY - 0.45), (minZ + maxZ) * 0.5);
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
