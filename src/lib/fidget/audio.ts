type AudioKit = {
  ctx: AudioContext;
  master: GainNode;
  sfx: GainNode;
};

let kit: AudioKit | null = null;
let muted = false;
let lastClick = 0;
let lastSnap = 0;

function getKit(): AudioKit | null {
  if (typeof window === "undefined") return null;
  if (kit) return kit;
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AC) return null;
  const ctx = new AC({ latencyHint: "interactive" });
  const master = ctx.createGain();
  const sfx = ctx.createGain();
  master.gain.value = 0.7;
  sfx.gain.value = 0.9;
  sfx.connect(master);
  master.connect(ctx.destination);
  kit = { ctx, master, sfx };
  return kit;
}

export function unlockAudio() {
  const k = getKit();
  if (!k) return;
  if (k.ctx.state === "suspended") {
    void k.ctx.resume();
  }
}

export function setMuted(next: boolean) {
  muted = next;
  const k = kit;
  if (!k) return;
  k.master.gain.setTargetAtTime(next ? 0 : 0.7, k.ctx.currentTime, 0.03);
}

export function resumeAudioIfNeeded() {
  if (typeof document !== "undefined" && document.visibilityState === "visible") {
    unlockAudio();
  }
}

function beep(
  freq: number,
  dur: number,
  vol: number,
  type: OscillatorType = "sine",
  slide = 0,
) {
  const k = getKit();
  if (!k || muted) return;
  const t = k.ctx.currentTime;
  const osc = k.ctx.createOscillator();
  const g = k.ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g);
  g.connect(k.sfx);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function noiseBurst(dur: number, vol: number, hp = 400) {
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
  filter.Q.value = 0.7;
  const g = k.ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter);
  filter.connect(g);
  g.connect(k.sfx);
  src.start(t);
  src.stop(t + dur);
}

export function playPoke(intensity = 1) {
  const now = performance.now();
  if (now - lastClick < 40) return;
  lastClick = now;
  const i = Math.min(1, intensity);
  beep(90 + i * 40, 0.09, 0.07 * i, "sine", -40);
  beep(220 + Math.random() * 40, 0.04, 0.03 * i, "triangle");
}

export function playSnap(count: number) {
  const now = performance.now();
  if (now - lastSnap < 55) return;
  lastSnap = now;
  const n = Math.min(count, 6);
  beep(520 + Math.random() * 180, 0.035, 0.018 * Math.sqrt(n), "sine");
}

export function playStretch() {
  beep(140, 0.12, 0.025, "triangle", 80);
}

export function playGun() {
  noiseBurst(0.12, 0.16, 900);
  beep(70, 0.16, 0.12, "sine", -30);
  beep(240, 0.05, 0.04, "square", -80);
}

export function playUnlock() {
  beep(320, 0.08, 0.05, "sine");
  setTimeout(() => beep(480, 0.1, 0.045, "sine"), 90);
}

export function playReset() {
  beep(180, 0.08, 0.04, "sine", 60);
}
