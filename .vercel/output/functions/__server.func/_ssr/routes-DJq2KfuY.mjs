import { i as __toESM } from "../_runtime.mjs";
import { I as require_jsx_runtime, L as require_react } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as Shovel, c as Hand, l as Crosshair, n as Volume2, o as RotateCcw, r as Triangle, s as Pen, t as VolumeX, u as Circle } from "../_libs/lucide-react.mjs";
import { n as clsx, t as cva } from "../_libs/class-variance-authority+clsx.mjs";
import { t as twMerge } from "../_libs/tailwind-merge.mjs";
import { t as create } from "../_libs/zustand.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-DJq2KfuY.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var __defProp = Object.defineProperty;
var __exportAll = (all, no_symbols) => {
	let target = {};
	for (var name in all) __defProp(target, name, {
		get: all[name],
		enumerable: true
	});
	if (!no_symbols) __defProp(target, Symbol.toStringTag, { value: "Module" });
	return target;
};
var VOXEL_SPACING = .24;
var VOXEL_SIZE = .208;
var BOND_STIFFNESS = .62;
var OVERLAP = .9;
var MAGNET_BREAK = 2.55;
var MAGNET_REFORM = 1.22;
var HOME_ACTIVE = .035;
var HOME_IDLE = .42;
var IDLE_AFTER = 1.25;
var IDLE_RAMP = 3.6;
var GRAB_RADIUS = .62;
var SCREEN_MARGIN = .08;
var kit = null;
var muted = false;
var lastClick = 0;
var lastSnap = 0;
function getKit() {
	if (typeof window === "undefined") return null;
	if (kit) return kit;
	const AC = window.AudioContext || window.webkitAudioContext;
	if (!AC) return null;
	const ctx = new AC({ latencyHint: "interactive" });
	const master = ctx.createGain();
	const sfx = ctx.createGain();
	master.gain.value = .7;
	sfx.gain.value = .9;
	sfx.connect(master);
	master.connect(ctx.destination);
	kit = {
		ctx,
		master,
		sfx
	};
	return kit;
}
function unlockAudio() {
	const k = getKit();
	if (!k) return;
	if (k.ctx.state === "suspended") k.ctx.resume();
}
function setMuted(next) {
	muted = next;
	const k = kit;
	if (!k) return;
	k.master.gain.setTargetAtTime(next ? 0 : .7, k.ctx.currentTime, .03);
}
function resumeAudioIfNeeded() {
	if (typeof document !== "undefined" && document.visibilityState === "visible") unlockAudio();
}
function beep(freq, dur, vol, type = "sine", slide = 0) {
	const k = getKit();
	if (!k || muted) return;
	const t = k.ctx.currentTime;
	const osc = k.ctx.createOscillator();
	const g = k.ctx.createGain();
	osc.type = type;
	osc.frequency.setValueAtTime(freq, t);
	if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
	g.gain.setValueAtTime(0, t);
	g.gain.linearRampToValueAtTime(vol, t + .006);
	g.gain.exponentialRampToValueAtTime(1e-4, t + dur);
	osc.connect(g);
	g.connect(k.sfx);
	osc.start(t);
	osc.stop(t + dur + .02);
}
function noiseBurst(dur, vol, hp = 400) {
	const k = getKit();
	if (!k || muted) return;
	const t = k.ctx.currentTime;
	const n = Math.floor(k.ctx.sampleRate * dur);
	const buf = k.ctx.createBuffer(1, n, k.ctx.sampleRate);
	const data = buf.getChannelData(0);
	for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
	const src = k.ctx.createBufferSource();
	src.buffer = buf;
	const filter = k.ctx.createBiquadFilter();
	filter.type = "bandpass";
	filter.frequency.value = hp;
	filter.Q.value = .7;
	const g = k.ctx.createGain();
	g.gain.setValueAtTime(vol, t);
	g.gain.exponentialRampToValueAtTime(1e-4, t + dur);
	src.connect(filter);
	filter.connect(g);
	g.connect(k.sfx);
	src.start(t);
	src.stop(t + dur);
}
function playPoke(intensity = 1) {
	const now = performance.now();
	if (now - lastClick < 40) return;
	lastClick = now;
	const i = Math.min(1, intensity);
	beep(90 + i * 40, .09, .07 * i, "sine", -40);
	beep(220 + Math.random() * 40, .04, .03 * i, "triangle");
}
function playSnap(count) {
	const now = performance.now();
	if (now - lastSnap < 55) return;
	lastSnap = now;
	const n = Math.min(count, 6);
	beep(520 + Math.random() * 180, .035, .018 * Math.sqrt(n), "sine");
}
function playStretch() {
	beep(140, .12, .025, "triangle", 80);
}
function playGun() {
	noiseBurst(.12, .16, 900);
	beep(70, .16, .12, "sine", -30);
	beep(240, .05, .04, "square", -80);
}
function playUnlock() {
	beep(320, .08, .05, "sine");
	setTimeout(() => beep(480, .1, .045, "sine"), 90);
}
function playReset() {
	beep(180, .08, .04, "sine", 60);
}
function cn(...inputs) {
	return twMerge(clsx(inputs));
}
var buttonVariants = cva("inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-[opacity,transform,background-color,color] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 disabled:pointer-events-none disabled:opacity-40 active:scale-[0.98] [&_svg]:pointer-events-none [&_svg]:shrink-0", {
	variants: {
		variant: {
			solid: "bg-accent text-accent-fg hover:opacity-90",
			ghost: "bg-transparent text-fg hover:bg-surface-2",
			dock: "bg-transparent text-muted hover:text-fg hover:bg-surface-2 data-[active=true]:bg-accent data-[active=true]:text-accent-fg"
		},
		size: {
			md: "h-11 px-4 text-sm rounded-md",
			icon: "size-12 rounded-md",
			pill: "h-12 px-6 rounded-full text-sm tracking-wide"
		}
	},
	defaultVariants: {
		variant: "solid",
		size: "md"
	}
});
var Button = import_react.forwardRef(({ className, variant, size, ...props }, ref) => {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
		className: cn(buttonVariants({
			variant,
			size
		}), className),
		ref,
		...props
	});
});
Button.displayName = "Button";
var GUN_KEY = "clump.gunUnlocked";
function readGunUnlocked() {
	if (typeof window === "undefined") return false;
	try {
		return window.localStorage.getItem(GUN_KEY) === "1";
	} catch {
		return false;
	}
}
var useFidget = create((set, get) => ({
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
	start: () => set({ started: true }),
	setTool: (tool) => {
		if (tool === "gun" && !get().gunUnlocked) return;
		set({ tool });
	},
	setRecovering: (recovering) => set({ recovering }),
	setMuted: (muted) => set({ muted }),
	setVoxelCount: (voxelCount) => set({ voxelCount }),
	setShape: (shape) => set({ shape }),
	setToast: (toast) => set({ toast }),
	unlockGun: () => {
		try {
			window.localStorage.setItem(GUN_KEY, "1");
		} catch {}
		playUnlock();
		set({
			gunUnlocked: true,
			toast: "loaded."
		});
		window.setTimeout(() => {
			if (get().toast === "loaded.") set({ toast: null });
		}, 2200);
	},
	tapTitle: () => {
		if (get().gunUnlocked) return;
		const now = performance.now();
		const taps = now - get().lastTitleTap > 2800 ? 1 : get().titleTaps + 1;
		if (taps >= 7) {
			get().unlockGun();
			set({
				titleTaps: 0,
				lastTitleTap: now
			});
			return;
		}
		set({
			titleTaps: taps,
			lastTitleTap: now
		});
	}
}));
var TOOLS = [
	{
		id: "hand",
		label: "Hand",
		hint: "Tap, push, pinch-stretch"
	},
	{
		id: "spike",
		label: "Spike",
		hint: "Punch a hole, split the mass"
	},
	{
		id: "trowel",
		label: "Trowel",
		hint: "Flatten and smear"
	},
	{
		id: "loop",
		label: "Loop",
		hint: "Scoop a pocket"
	},
	{
		id: "needle",
		label: "Needle",
		hint: "Fine split"
	}
];
var ICONS = {
	hand: Hand,
	spike: Triangle,
	trowel: Shovel,
	loop: Circle,
	needle: Pen,
	gun: Crosshair
};
function Overlay({ onReset, onMorphGun }) {
	const started = useFidget((s) => s.started);
	const start = useFidget((s) => s.start);
	const tool = useFidget((s) => s.tool);
	const setTool = useFidget((s) => s.setTool);
	const gunUnlocked = useFidget((s) => s.gunUnlocked);
	const recovering = useFidget((s) => s.recovering);
	const muted = useFidget((s) => s.muted);
	const setMuted$1 = useFidget((s) => s.setMuted);
	const voxelCount = useFidget((s) => s.voxelCount);
	const toast = useFidget((s) => s.toast);
	const tapTitle = useFidget((s) => s.tapTitle);
	const shape = useFidget((s) => s.shape);
	const setShape = useFidget((s) => s.setShape);
	const tools = gunUnlocked ? [...TOOLS, {
		id: "gun",
		label: "Gun",
		hint: "Point and fire"
	}] : TOOLS;
	const activeHint = tools.find((t) => t.id === tool)?.hint ?? "Tap, push, pinch-stretch";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "pointer-events-none absolute inset-0 z-10 flex flex-col",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "flex items-start justify-between px-5 pt-[max(1.25rem,env(safe-area-inset-top))]",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					onClick: tapTitle,
					className: "pointer-events-auto text-left",
					"aria-label": "CLUMP",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
						className: "font-display text-3xl font-medium leading-none tracking-[-0.04em] text-fg md:text-4xl",
						children: "CLUMP"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-xs tracking-wide text-muted",
						children: "magnetic fidget"
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "pointer-events-auto flex gap-1",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "ghost",
						size: "icon",
						"aria-label": muted ? "Unmute" : "Mute",
						onClick: () => {
							const next = !muted;
							setMuted$1(next);
							setMuted(next);
						},
						children: muted ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(VolumeX, {
							className: "size-5",
							strokeWidth: 1.75
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Volume2, {
							className: "size-5",
							strokeWidth: 1.75
						})
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "ghost",
						size: "icon",
						"aria-label": "Reset shape",
						onClick: onReset,
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RotateCcw, {
							className: "size-5",
							strokeWidth: 1.75
						})
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "flex-1" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-col items-center gap-3 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: cn("text-center text-xs tracking-wide text-muted transition-opacity duration-500", recovering ? "opacity-100" : "opacity-0"),
						children: "remembering"
					}),
					toast ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs tracking-wide text-fg/80",
						children: toast
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-center text-xs text-subtle",
						children: activeHint
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
						className: "pointer-events-auto flex items-center gap-1 rounded-2xl border border-border bg-surface/90 p-1.5",
						"aria-label": "Tools",
						children: tools.map((t) => {
							const Icon = ICONS[t.id];
							const active = tool === t.id;
							return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								variant: "dock",
								size: "icon",
								"data-active": active,
								"aria-label": t.label,
								"aria-pressed": active,
								onClick: () => {
									if (t.id === "gun" && gunUnlocked && tool === "gun") {
										setShape(shape === "gun" ? "lump" : "gun");
										onMorphGun();
										return;
									}
									setTool(t.id);
								},
								title: t.label,
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, {
									className: "size-5",
									strokeWidth: 1.75
								})
							}, t.id);
						})
					}),
					voxelCount > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "font-sans text-[10px] tabular-nums tracking-widest text-subtle",
						children: [voxelCount, " magnets"]
					}) : null
				]
			}),
			!started ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "pointer-events-auto absolute inset-0 z-20 flex flex-col items-center justify-end bg-bg/55 px-6 pb-[max(6rem,env(safe-area-inset-bottom)+5rem)]",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mb-auto mt-28 text-center",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-display text-5xl font-medium tracking-[-0.04em] text-fg",
						children: "CLUMP"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mx-auto mt-4 max-w-[16rem] text-sm leading-relaxed text-muted",
						children: "A lump of magnets. Poke it. Stretch it. Tools carve it. Let go — it comes home."
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					size: "pill",
					onClick: () => {
						unlockAudio();
						start();
					},
					children: "Tap to fidget"
				})]
			}) : null
		]
	});
}
function FidgetApp() {
	const canvasRef = (0, import_react.useRef)(null);
	const engineRef = (0, import_react.useRef)(null);
	const tool = useFidget((s) => s.tool);
	const muted = useFidget((s) => s.muted);
	const gunUnlocked = useFidget((s) => s.gunUnlocked);
	const setRecovering = useFidget((s) => s.setRecovering);
	const setVoxelCount = useFidget((s) => s.setVoxelCount);
	const setTool = useFidget((s) => s.setTool);
	const setShape = useFidget((s) => s.setShape);
	const unlockGun = useFidget((s) => s.unlockGun);
	const start = useFidget((s) => s.start);
	(0, import_react.useEffect)(() => {
		if (!canvasRef.current) return;
		let disposed = false;
		let engine = null;
		import("./engine-BMy2NqGY.mjs").then(({ FidgetEngine }) => {
			if (disposed || !canvasRef.current) return;
			engine = new FidgetEngine(canvasRef.current, {
				onRecovering: setRecovering,
				onVoxelCount: setVoxelCount,
				onReady: () => {
					window.__fidget = {
						ready: true,
						poke: () => engine?.pokeCenter(),
						reset: () => engine?.reset(),
						unlockGun,
						get voxelCount() {
							return useFidget.getState().voxelCount;
						}
					};
				}
			});
			engine.setTool(useFidget.getState().tool);
			engine.setMuted(useFidget.getState().muted);
			engine.start();
			engineRef.current = engine;
		});
		return () => {
			disposed = true;
			engine?.dispose();
			engineRef.current = null;
			if (window.__fidget) delete window.__fidget;
		};
	}, [
		setRecovering,
		setVoxelCount,
		unlockGun
	]);
	(0, import_react.useEffect)(() => {
		engineRef.current?.setTool(tool);
	}, [tool]);
	(0, import_react.useEffect)(() => {
		engineRef.current?.setMuted(muted);
		setMuted(muted);
	}, [muted]);
	(0, import_react.useEffect)(() => {
		const onKey = (e) => {
			if (e.repeat) return;
			if (e.code === "Digit1") setTool("hand");
			else if (e.code === "Digit2") setTool("spike");
			else if (e.code === "Digit3") setTool("trowel");
			else if (e.code === "Digit4") setTool("loop");
			else if (e.code === "Digit5") setTool("needle");
			else if (e.code === "KeyG") {
				if (!useFidget.getState().gunUnlocked) unlockGun();
				setTool("gun");
			} else if (e.code === "KeyR") engineRef.current?.reset();
			else if (e.code === "Space") {
				e.preventDefault();
				unlockAudio();
				start();
				engineRef.current?.pokeCenter();
			} else if (e.code === "KeyB") {
				const buf = (window.__clumpKeys ?? "") + "b";
				window.__clumpKeys = buf.slice(-8);
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [
		setTool,
		unlockGun,
		start
	]);
	(0, import_react.useEffect)(() => {
		let buffer = "";
		const onKey = (e) => {
			if (e.key.length !== 1) return;
			buffer = (buffer + e.key.toLowerCase()).slice(-3);
			if (buffer === "gun" && !useFidget.getState().gunUnlocked) unlockGun();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [unlockGun]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "relative h-dvh w-full overflow-hidden bg-bg text-fg",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("canvas", {
				ref: canvasRef,
				className: "absolute inset-0 size-full touch-none",
				style: { touchAction: "none" },
				"aria-label": "Magnetic voxel fidget"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Overlay, {
				onReset: () => {
					setShape("lump");
					engineRef.current?.morphTo("lump");
					engineRef.current?.reset();
				},
				onMorphGun: () => {
					const next = useFidget.getState().shape;
					engineRef.current?.morphTo(next);
				}
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "sr-only",
				children: gunUnlocked ? "gun unlocked" : "clump fidget"
			})
		]
	});
}
var routes_exports = /* @__PURE__ */ __exportAll({ component: () => Home });
function Home() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FidgetApp, {});
}
//#endregion
export { OVERLAP as _, playSnap as a, VOXEL_SPACING as b, unlockAudio as c, HOME_ACTIVE as d, HOME_IDLE as f, MAGNET_REFORM as g, MAGNET_BREAK as h, playReset as i, BOND_STIFFNESS as l, IDLE_RAMP as m, playGun as n, playStretch as o, IDLE_AFTER as p, playPoke as r, resumeAudioIfNeeded as s, routes_exports as t, GRAB_RADIUS as u, SCREEN_MARGIN as v, VOXEL_SIZE as y };
