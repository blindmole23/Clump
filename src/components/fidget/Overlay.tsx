import {
  Camera,
  Circle,
  Crosshair,
  Hand,
  Minus,
  Pen,
  RotateCcw,
  Settings,
  Shovel,
  SlidersHorizontal,
  Triangle,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { setMuted as setAudioMuted, unlockAudio } from "@/lib/fidget/audio";
import { useFidget } from "@/lib/fidget/store";
import {
  MODES,
  TOOLS,
  TUNING_FIELDS,
  type GravityLevel,
  type MagnetSize,
  type ToolId,
} from "@/lib/fidget/types";
import { cn } from "@/lib/utils";

const SIZES: { id: MagnetSize; label: string }[] = [
  { id: "small", label: "Small" },
  { id: "medium", label: "Medium" },
  { id: "large", label: "Large" },
];

const GRAVITY_LEVELS: { id: GravityLevel; label: string }[] = [
  { id: "low", label: "Low" },
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" },
];

function formatTuningValue(value: number, step: number): string {
  const decimals = (step.toString().split(".")[1] ?? "").length;
  return value.toFixed(decimals);
}

const ICONS: Record<ToolId, typeof Hand> = {
  hand: Hand,
  spike: Triangle,
  trowel: Shovel,
  loop: Circle,
  needle: Pen,
  gun: Crosshair,
};

type OverlayProps = {
  onReset: () => void;
  onMorphGun: () => void;
  onCycleCamera: () => void;
};

export function Overlay({ onReset, onMorphGun, onCycleCamera }: OverlayProps) {
  const started = useFidget((s) => s.started);
  const start = useFidget((s) => s.start);
  const tool = useFidget((s) => s.tool);
  const setTool = useFidget((s) => s.setTool);
  const gunUnlocked = useFidget((s) => s.gunUnlocked);
  const recovering = useFidget((s) => s.recovering);
  const muted = useFidget((s) => s.muted);
  const setMuted = useFidget((s) => s.setMuted);
  const voxelCount = useFidget((s) => s.voxelCount);
  const toast = useFidget((s) => s.toast);
  const tapTitle = useFidget((s) => s.tapTitle);
  const shape = useFidget((s) => s.shape);
  const setShape = useFidget((s) => s.setShape);
  const magnetSize = useFidget((s) => s.magnetSize);
  const setMagnetSize = useFidget((s) => s.setMagnetSize);
  const mode = useFidget((s) => s.mode);
  const setMode = useFidget((s) => s.setMode);
  const gravityLevel = useFidget((s) => s.gravityLevel);
  const setGravityLevel = useFidget((s) => s.setGravityLevel);
  const tuning = useFidget((s) => s.tuning);
  const setTuning = useFidget((s) => s.setTuning);
  const resetTuning = useFidget((s) => s.resetTuning);
  const activeSheet = useFidget((s) => s.activeSheet);
  const sheetMinimized = useFidget((s) => s.sheetMinimized);
  const openSheet = useFidget((s) => s.openSheet);
  const closeSheet = useFidget((s) => s.closeSheet);

  const tools = gunUnlocked
    ? [...TOOLS, { id: "gun" as const, label: "Gun", hint: "Point and fire" }]
    : TOOLS;

  const activeHint =
    tools.find((t) => t.id === tool)?.hint ?? "Tap, push, pinch-stretch";

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col">
      {!started ? (
        <div className="pointer-events-auto absolute inset-0 z-20 flex flex-col items-center justify-end bg-bg/40 px-6 pb-[max(4.5rem,env(safe-area-inset-bottom)+3.5rem)]">
          <div className="mb-auto mt-[22vh] text-center">
            <p className="font-display text-5xl font-medium tracking-[-0.04em] text-fg md:text-6xl">
              CLUMP
            </p>
            <p className="mx-auto mt-4 max-w-[16rem] text-sm leading-relaxed text-muted">
              A lump of magnets. Poke it. Stretch it. Tools carve it. Let go —
              it comes home.
            </p>
          </div>
          <Button
            size="pill"
            onClick={() => {
              unlockAudio();
              start();
            }}
          >
            Tap to fidget
          </Button>
        </div>
      ) : (
        <>
          <header className="flex items-start justify-between px-5 pt-[max(1.25rem,env(safe-area-inset-top))]">
            <button
              type="button"
              onClick={tapTitle}
              className="pointer-events-auto text-left"
              aria-label="CLUMP"
            >
              <h1 className="font-display text-3xl font-medium leading-none tracking-[-0.04em] text-fg md:text-4xl">
                CLUMP
              </h1>
              <p className="mt-1 text-xs tracking-wide text-muted">
                magnetic fidget
              </p>
            </button>
            <div className="pointer-events-auto relative flex gap-1">
              {mode !== "floaty" ? (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Cycle camera angle"
                  onClick={onCycleCamera}
                >
                  <Camera className="size-5" strokeWidth={1.75} />
                </Button>
              ) : null}
              <Button
                variant="ghost"
                size="icon"
                aria-label={muted ? "Unmute" : "Mute"}
                onClick={() => {
                  const next = !muted;
                  setMuted(next);
                  setAudioMuted(next);
                }}
              >
                {muted ? (
                  <VolumeX className="size-5" strokeWidth={1.75} />
                ) : (
                  <Volume2 className="size-5" strokeWidth={1.75} />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Reset shape"
                onClick={onReset}
              >
                <RotateCcw className="size-5" strokeWidth={1.75} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Dev panel"
                aria-pressed={activeSheet === "dev"}
                onClick={() => openSheet("dev")}
              >
                <SlidersHorizontal className="size-5" strokeWidth={1.75} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Settings"
                aria-pressed={activeSheet === "settings"}
                onClick={() => openSheet("settings")}
              >
                <Settings className="size-5" strokeWidth={1.75} />
              </Button>
            </div>
          </header>

          {/* Tools: vertical rail, out of the way on the left. */}
          <nav
            className="pointer-events-auto absolute left-[max(0.75rem,env(safe-area-inset-left))] top-1/2 flex -translate-y-1/2 flex-col gap-1 rounded-2xl border border-border bg-surface/90 p-1.5"
            aria-label="Tools"
          >
            {tools.map((t) => {
              const Icon = ICONS[t.id];
              const active = tool === t.id;
              return (
                <Button
                  key={t.id}
                  variant="dock"
                  size="icon"
                  data-active={active}
                  aria-label={t.label}
                  aria-pressed={active}
                  onClick={() => {
                    if (t.id === "gun" && gunUnlocked && tool === "gun") {
                      const next = shape === "gun" ? "lump" : "gun";
                      setShape(next);
                      onMorphGun();
                      return;
                    }
                    setTool(t.id);
                  }}
                  title={t.label}
                >
                  <Icon className="size-5" strokeWidth={1.75} />
                </Button>
              );
            })}
          </nav>

          {/* Modes: vertical rail, out of the way on the right. */}
          <div
            className="pointer-events-auto absolute right-[max(0.75rem,env(safe-area-inset-right))] top-1/2 flex -translate-y-1/2 flex-col gap-1 rounded-2xl border border-border bg-surface/90 p-1"
            aria-label="Play area"
          >
            {MODES.map((m) => (
              <Button
                key={m.id}
                variant="dock"
                size="md"
                className="h-9 w-14 px-0 text-xs"
                data-active={mode === m.id}
                aria-pressed={mode === m.id}
                onClick={() => setMode(m.id)}
              >
                {m.label}
              </Button>
            ))}
          </div>

          <div className="flex-1" />

          <div className="relative flex flex-col items-center gap-1.5 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <p
              className={cn(
                "absolute -top-6 text-center text-xs tracking-wide text-muted transition-opacity duration-500",
                recovering ? "opacity-100" : "opacity-0",
              )}
              aria-hidden={!recovering}
            >
              remembering
            </p>
            {toast ? (
              <p className="text-xs tracking-wide text-fg/80">{toast}</p>
            ) : null}
            <p className="text-center text-xs text-subtle">{activeHint}</p>
            {voxelCount > 0 ? (
              <p className="font-sans text-[10px] tabular-nums tracking-widest text-subtle">
                {voxelCount} magnets
              </p>
            ) : null}
          </div>

          {activeSheet ? (
            <div
              className="pointer-events-auto absolute inset-x-0 bottom-0 z-30 mx-auto w-full max-w-md px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
              role="dialog"
              aria-label={activeSheet === "dev" ? "Dev panel" : "Settings"}
            >
              <div className="rounded-2xl border border-border bg-surface/95 shadow-lg backdrop-blur">
                <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
                  <p className="text-sm font-medium text-fg">
                    {activeSheet === "dev" ? "Dev panel" : "Settings"}
                  </p>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      aria-label={sheetMinimized ? "Expand" : "Minimize"}
                      onClick={() => openSheet(activeSheet)}
                    >
                      <Minus className="size-4" strokeWidth={2} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      aria-label="Close"
                      onClick={closeSheet}
                    >
                      <X className="size-4" strokeWidth={2} />
                    </Button>
                  </div>
                </div>

                {sheetMinimized ? null : (
                  <div className="max-h-[50vh] overflow-y-auto p-4">
                    {activeSheet === "settings" ? (
                      <>
                        <p className="text-xs tracking-wide text-subtle">
                          Magnet size
                        </p>
                        <div className="mt-2 flex gap-1 rounded-xl border border-border bg-bg/40 p-1">
                          {SIZES.map((s) => (
                            <Button
                              key={s.id}
                              variant="dock"
                              size="md"
                              className="h-9 flex-1 px-0 text-xs"
                              data-active={magnetSize === s.id}
                              aria-pressed={magnetSize === s.id}
                              onClick={() => setMagnetSize(s.id)}
                            >
                              {s.label}
                            </Button>
                          ))}
                        </div>
                        {mode !== "floaty" ? (
                          <>
                            <p className="mt-4 text-xs tracking-wide text-subtle">
                              Gravity
                            </p>
                            <div className="mt-2 flex gap-1 rounded-xl border border-border bg-bg/40 p-1">
                              {GRAVITY_LEVELS.map((g) => (
                                <Button
                                  key={g.id}
                                  variant="dock"
                                  size="md"
                                  className="h-9 flex-1 px-0 text-xs"
                                  data-active={gravityLevel === g.id}
                                  aria-pressed={gravityLevel === g.id}
                                  onClick={() => setGravityLevel(g.id)}
                                >
                                  {g.label}
                                </Button>
                              ))}
                            </div>
                          </>
                        ) : null}
                      </>
                    ) : (
                      <>
                        <div className="flex flex-col gap-3">
                          {TUNING_FIELDS.map((f) => (
                            <label key={f.key} className="block">
                              <div className="flex items-baseline justify-between">
                                <span className="text-xs tracking-wide text-subtle">
                                  {f.label}
                                </span>
                                <span className="font-sans text-[10px] tabular-nums text-muted">
                                  {formatTuningValue(tuning[f.key], f.step)}
                                  {f.unit ?? ""}
                                </span>
                              </div>
                              <input
                                type="range"
                                min={f.min}
                                max={f.max}
                                step={f.step}
                                value={tuning[f.key]}
                                onChange={(e) =>
                                  setTuning({ [f.key]: Number(e.target.value) })
                                }
                                className="mt-1.5 w-full accent-fg"
                              />
                            </label>
                          ))}
                        </div>
                        <Button
                          variant="dock"
                          size="md"
                          className="mt-4 h-9 w-full text-xs"
                          onClick={resetTuning}
                        >
                          Reset to defaults
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
