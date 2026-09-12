import { useEffect, useRef } from "react";
import { Overlay } from "@/components/fidget/Overlay";
import { setMuted, unlockAudio } from "@/lib/fidget/audio";
import { useFidget } from "@/lib/fidget/store";
import type { FidgetEngine } from "@/lib/fidget/engine";

export function FidgetApp() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<FidgetEngine | null>(null);
  const tool = useFidget((s) => s.tool);
  const muted = useFidget((s) => s.muted);
  const magnetSize = useFidget((s) => s.magnetSize);
  const mode = useFidget((s) => s.mode);
  const gravityLevel = useFidget((s) => s.gravityLevel);
  const tuning = useFidget((s) => s.tuning);
  const pinchZoomEnabled = useFidget((s) => s.pinchZoomEnabled);
  const gunUnlocked = useFidget((s) => s.gunUnlocked);
  const setRecovering = useFidget((s) => s.setRecovering);
  const setVoxelCount = useFidget((s) => s.setVoxelCount);
  const setTool = useFidget((s) => s.setTool);
  const setShape = useFidget((s) => s.setShape);
  const unlockGun = useFidget((s) => s.unlockGun);
  const start = useFidget((s) => s.start);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let disposed = false;
    let engine: FidgetEngine | null = null;

    void import("@/lib/fidget/engine").then(({ FidgetEngine }) => {
      if (disposed || !canvasRef.current) return;
      engine = new FidgetEngine(canvasRef.current, {
        onRecovering: setRecovering,
        onVoxelCount: setVoxelCount,
        onReady: () => {
          const api = {
            ready: true,
            poke: () => engine?.pokeCenter(),
            reset: () => engine?.reset(),
            unlockGun,
            get voxelCount() {
              return useFidget.getState().voxelCount;
            },
          };
          window.__fidget = api;
        },
      });
      engine.setTool(useFidget.getState().tool);
      engine.setMuted(useFidget.getState().muted);
      engine.setMagnetSize(useFidget.getState().magnetSize);
      engine.setTuning(useFidget.getState().tuning);
      engine.setPinchZoomEnabled(useFidget.getState().pinchZoomEnabled);
      engine.start();
      engineRef.current = engine;
    });

    return () => {
      disposed = true;
      engine?.dispose();
      engineRef.current = null;
      if (window.__fidget) delete window.__fidget;
    };
  }, [setRecovering, setVoxelCount, unlockGun]);

  useEffect(() => {
    engineRef.current?.setTool(tool);
  }, [tool]);

  useEffect(() => {
    engineRef.current?.setMuted(muted);
    setMuted(muted);
  }, [muted]);

  useEffect(() => {
    engineRef.current?.setMagnetSize(magnetSize);
  }, [magnetSize]);

  useEffect(() => {
    engineRef.current?.setMode(mode);
  }, [mode]);

  useEffect(() => {
    engineRef.current?.setGravityLevel(gravityLevel);
  }, [gravityLevel]);

  useEffect(() => {
    engineRef.current?.setTuning(tuning);
  }, [tuning]);

  useEffect(() => {
    engineRef.current?.setPinchZoomEnabled(pinchZoomEnabled);
  }, [pinchZoomEnabled]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.code === "Digit1") setTool("hand");
      else if (e.code === "Digit2") setTool("spike");
      else if (e.code === "Digit3") setTool("trowel");
      else if (e.code === "Digit4") setTool("needle");
      else if (e.code === "Digit0") {
        engineRef.current?.recenter();
      } else if (e.code === "KeyG") {
        if (!useFidget.getState().gunUnlocked) unlockGun();
        setTool("gun");
      } else if (e.code === "KeyR") {
        engineRef.current?.reset();
      } else if (e.code === "Space") {
        e.preventDefault();
        unlockAudio();
        start();
        engineRef.current?.pokeCenter();
      } else if (e.code === "KeyB") {
        // Dev/testing aid: reveals the Trough/Plane container as a wireframe.
        // No-op in floaty mode, which has no box to show.
        engineRef.current?.toggleBoundary();
      } else if (e.code === "KeyC") {
        engineRef.current?.cycleCamera();
      } else if (e.code === "KeyF") {
        if (document.fullscreenElement) {
          void document.exitFullscreen();
        } else {
          void document.documentElement.requestFullscreen().catch(() => {
            /* unsupported (e.g. iOS Safari) — silently no-op */
          });
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setTool, unlockGun, start]);

  useEffect(() => {
    let buffer = "";
    const onKey = (e: KeyboardEvent) => {
      if (e.key.length !== 1) return;
      buffer = (buffer + e.key.toLowerCase()).slice(-3);
      if (buffer === "gun" && !useFidget.getState().gunUnlocked) {
        unlockGun();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [unlockGun]);

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-bg text-fg">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 size-full touch-none"
        style={{ touchAction: "none" }}
        aria-label="Magnetic voxel fidget"
      />
      <Overlay
        onReset={() => {
          setShape("lump");
          engineRef.current?.morphTo("lump");
          engineRef.current?.reset();
        }}
        onMorphGun={() => {
          const next = useFidget.getState().shape;
          engineRef.current?.morphTo(next);
        }}
        onCycleCamera={() => engineRef.current?.cycleCamera()}
        onRecenter={() => engineRef.current?.recenter()}
      />
      <span className="sr-only">
        {gunUnlocked ? "gun unlocked" : "clump fidget"}
      </span>
    </div>
  );
}

declare global {
  interface Window {
    __fidget?: {
      ready: boolean;
      poke: () => void;
      reset: () => void;
      unlockGun: () => void;
      voxelCount: number;
    };
  }
}
