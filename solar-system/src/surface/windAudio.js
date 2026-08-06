// ---------- continuous surface wind bed ----------
// A third dedicated procedural-audio module, alongside footsteps.js and
// audio/ambientAudio.js — same reasoning footsteps.js already documents for
// not sharing state with ambientAudio.js: this has its own trigger (surface
// enter/exit, not "which body is focused") and its own lifecycle (starts
// once on landing, runs continuously, stops once on exit), so a dedicated
// module stays simpler than threading a third mode through either existing one.
let ctx = null;
let current = null; // { gain, nodes: [...] }

function ensureCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function makeNoiseBuffer(audioCtx) {
  const bufferSize = 2 * audioCtx.sampleRate;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

// Called once on entering a surface with wind (surface/surfaceMode.js).
// windStyle "none" (Mercury/Pluto) or windSpeed 0 is a deliberate no-op —
// those bodies have no atmosphere worth hearing move.
export function startWind(windStyle, windSpeed) {
  if (!windStyle || windStyle === "none" || windSpeed <= 0) return;
  stopWind();
  const audioCtx = ensureCtx();
  const isGas = windStyle === "gas"; // deep rushing roar (thick, fast-moving cloud deck) vs. a higher, thinner hiss (dust/breeze over rock)

  const noise = audioCtx.createBufferSource();
  noise.buffer = makeNoiseBuffer(audioCtx);
  noise.loop = true;

  const filter = audioCtx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = isGas ? 450 + windSpeed * 300 : 2000 + windSpeed * 1500;
  filter.Q.value = 0.6;

  const gain = audioCtx.createGain();
  const targetGain = (isGas ? 0.22 : 0.12) * windSpeed;
  gain.gain.setValueAtTime(0, audioCtx.currentTime);
  gain.gain.linearRampToValueAtTime(targetGain, audioCtx.currentTime + 1.2); // fade in on landing, not an abrupt start

  // Slow amplitude wobble so it reads as gusting rather than a static drone —
  // same "LFO modulating a parameter" technique ambientAudio.js already uses
  // for pitch, applied to gain here instead.
  const lfo = audioCtx.createOscillator();
  lfo.frequency.value = isGas ? 0.08 : 0.15;
  const lfoGain = audioCtx.createGain();
  lfoGain.gain.value = targetGain * 0.3;
  lfo.connect(lfoGain).connect(gain.gain);
  lfo.start();

  noise.connect(filter).connect(gain).connect(audioCtx.destination);
  noise.start();

  current = { gain, nodes: [noise, lfo] };
}

// Called once on exiting a surface (surface/surfaceMode.js), unconditionally
// — a no-op if wind was never started (e.g. Mercury/Pluto).
export function stopWind() {
  if (!current || !ctx) return;
  const { gain, nodes } = current;
  const now = ctx.currentTime;
  gain.gain.cancelScheduledValues(now);
  gain.gain.setValueAtTime(gain.gain.value, now);
  gain.gain.linearRampToValueAtTime(0, now + 0.6);
  nodes.forEach((n) => {
    try {
      n.stop(now + 0.7);
    } catch {
      /* already stopped */
    }
  });
  current = null;
}
