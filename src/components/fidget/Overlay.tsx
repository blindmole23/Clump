import {
  Circle,
  Crosshair,
  Hand,
  Pen,
  RotateCcw,
  Shovel,
  Triangle,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { setMuted as setAudioMuted, unlockAudio } from "@/lib/fidget/audio";
import { useFidget } from "@/lib/fidget/store";
import { TOOLS, type ToolId } from "@/lib/fidget/types";
import { cn } from "@/lib/utils";

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
};

export function Overlay({ onReset, onMorphGun }: OverlayProps) {
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
            <div className="pointer-events-auto flex gap-1">
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
            </div>
          </header>

          <div className="flex-1" />

          <div className="relative flex flex-col items-center gap-3 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
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

            <nav
              className="pointer-events-auto flex items-center gap-1 rounded-2xl border border-border bg-surface/90 p-1.5"
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
            {voxelCount > 0 ? (
              <p className="font-sans text-[10px] tabular-nums tracking-widest text-subtle">
                {voxelCount} magnets
              </p>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
