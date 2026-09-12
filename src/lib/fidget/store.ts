import { create } from "zustand";
import { DEFAULT_TUNING, GUN_UNLOCK_TAPS } from "./constants";
import { playUnlock } from "./audio";
import type { GravityLevel, MagnetSize, Mode, ShapeId, ToolId, Tuning } from "./types";

const GUN_KEY = "clump.gunUnlocked";
const SIZE_KEY = "clump.magnetSize";
const GRAVITY_KEY = "clump.gravityLevel";
const TUNING_KEY = "clump.tuning";
const PINCH_ZOOM_KEY = "clump.pinchZoom";

function readGunUnlocked(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(GUN_KEY) === "1";
  } catch {
    return false;
  }
}

function readMagnetSize(): MagnetSize {
  if (typeof window === "undefined") return "medium";
  try {
    const v = window.localStorage.getItem(SIZE_KEY);
    return v === "small" || v === "medium" || v === "large" ? v : "medium";
  } catch {
    return "medium";
  }
}

function readGravityLevel(): GravityLevel {
  if (typeof window === "undefined") return "low";
  try {
    const v = window.localStorage.getItem(GRAVITY_KEY);
    return v === "low" || v === "medium" || v === "high" ? v : "low";
  } catch {
    return "low";
  }
}

function readPinchZoomEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(PINCH_ZOOM_KEY) === "1";
  } catch {
    return false;
  }
}

function readTuning(): Tuning {
  if (typeof window === "undefined") return DEFAULT_TUNING;
  try {
    const raw = window.localStorage.getItem(TUNING_KEY);
    if (!raw) return DEFAULT_TUNING;
    const parsed = JSON.parse(raw) as Partial<Tuning>;
    const merged = { ...DEFAULT_TUNING };
    for (const key of Object.keys(DEFAULT_TUNING) as (keyof Tuning)[]) {
      const v = parsed[key];
      if (typeof v === "number" && Number.isFinite(v)) merged[key] = v;
    }
    return merged;
  } catch {
    return DEFAULT_TUNING;
  }
}

type FidgetUI = {
  started: boolean;
  tool: ToolId;
  gunUnlocked: boolean;
  shape: ShapeId;
  recovering: boolean;
  muted: boolean;
  voxelCount: number;
  toast: string | null;
  titleTaps: number;
  lastTitleTap: number;
  magnetSize: MagnetSize;
  mode: Mode;
  gravityLevel: GravityLevel;
  tuning: Tuning;
  pinchZoomEnabled: boolean;
  activeSheet: "settings" | "dev" | null;
  sheetMinimized: boolean;
  start: () => void;
  setTool: (tool: ToolId) => void;
  setMode: (mode: Mode) => void;
  setGravityLevel: (level: GravityLevel) => void;
  setRecovering: (v: boolean) => void;
  setMuted: (v: boolean) => void;
  setVoxelCount: (n: number) => void;
  setShape: (s: ShapeId) => void;
  tapTitle: () => void;
  unlockGun: () => void;
  setToast: (msg: string | null) => void;
  setMagnetSize: (size: MagnetSize) => void;
  setTuning: (partial: Partial<Tuning>) => void;
  resetTuning: () => void;
  setPinchZoomEnabled: (v: boolean) => void;
  openSheet: (id: "settings" | "dev") => void;
  closeSheet: () => void;
};

export const useFidget = create<FidgetUI>((set, get) => ({
  started: false,
  tool: "hand",
  gunUnlocked: readGunUnlocked(),
  shape: "lump",
  recovering: false,
  muted: false,
  voxelCount: 0,
  toast: null,
  titleTaps: 0,
  lastTitleTap: 0,
  magnetSize: readMagnetSize(),
  mode: "floaty",
  gravityLevel: readGravityLevel(),
  tuning: readTuning(),
  pinchZoomEnabled: readPinchZoomEnabled(),
  activeSheet: null,
  sheetMinimized: false,
  start: () => set({ started: true }),
  setTool: (tool) => {
    if (tool === "gun" && !get().gunUnlocked) return;
    set({ tool });
  },
  setMode: (mode) => set({ mode }),
  setGravityLevel: (gravityLevel) => {
    try {
      window.localStorage.setItem(GRAVITY_KEY, gravityLevel);
    } catch {
      /* ignore */
    }
    set({ gravityLevel });
  },
  setRecovering: (recovering) => set({ recovering }),
  setMuted: (muted) => set({ muted }),
  setVoxelCount: (voxelCount) => set({ voxelCount }),
  setShape: (shape) => set({ shape }),
  setToast: (toast) => set({ toast }),
  unlockGun: () => {
    try {
      window.localStorage.setItem(GUN_KEY, "1");
    } catch {
      /* ignore */
    }
    playUnlock();
    set({ gunUnlocked: true, toast: "loaded." });
    window.setTimeout(() => {
      if (get().toast === "loaded.") set({ toast: null });
    }, 2200);
  },
  tapTitle: () => {
    if (get().gunUnlocked) return;
    const now = performance.now();
    const taps = now - get().lastTitleTap > 2800 ? 1 : get().titleTaps + 1;
    if (taps >= GUN_UNLOCK_TAPS) {
      get().unlockGun();
      set({ titleTaps: 0, lastTitleTap: now });
      return;
    }
    set({ titleTaps: taps, lastTitleTap: now });
  },
  setMagnetSize: (magnetSize) => {
    try {
      window.localStorage.setItem(SIZE_KEY, magnetSize);
    } catch {
      /* ignore */
    }
    set({ magnetSize });
  },
  setTuning: (partial) => {
    const tuning = { ...get().tuning, ...partial };
    try {
      window.localStorage.setItem(TUNING_KEY, JSON.stringify(tuning));
    } catch {
      /* ignore */
    }
    set({ tuning });
  },
  resetTuning: () => {
    try {
      window.localStorage.setItem(TUNING_KEY, JSON.stringify(DEFAULT_TUNING));
    } catch {
      /* ignore */
    }
    set({ tuning: DEFAULT_TUNING });
  },
  setPinchZoomEnabled: (pinchZoomEnabled) => {
    try {
      window.localStorage.setItem(PINCH_ZOOM_KEY, pinchZoomEnabled ? "1" : "0");
    } catch {
      /* ignore */
    }
    set({ pinchZoomEnabled });
  },
  openSheet: (id) =>
    set((s) =>
      s.activeSheet === id
        ? { sheetMinimized: !s.sheetMinimized }
        : { activeSheet: id, sheetMinimized: false },
    ),
  closeSheet: () => set({ activeSheet: null, sheetMinimized: false }),
}));
