// ---------- procedural footstep audio ----------
// Same "no external audio files" approach as audio/ambientAudio.js, kept as
// its own lazily-created AudioContext rather than reusing that module's
// (private, not exported) one — footsteps are short one-shot bursts on a
// completely different trigger (distance walked, not "which body is
// focused"), so sharing state would add coupling for no real benefit.
//
// Two styles, matching the "gas giants should sound different" decision:
// "rocky" is a short, bright, highpass-filtered noise burst (a crunch);
// "gas" is a longer, soft, lowpass-filtered swell (a whoosh through cloud),
// since gas-giant Surface Mode is walking on cloud-deck, not solid ground.
let ctx = null;

function ensureCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

export function playFootstep(style) {
  const audioCtx = ensureCtx();
  const isGas = style === "gas";
  const duration = isGas ? 0.28 : 0.12;
  const bufferSize = Math.max(1, Math.floor(audioCtx.sampleRate * duration));
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

  const src = audioCtx.createBufferSource();
  src.buffer = buffer;

  const filter = audioCtx.createBiquadFilter();
  filter.type = isGas ? "lowpass" : "highpass";
  filter.frequency.value = isGas ? 700 : 1900;
  filter.Q.value = isGas ? 0.7 : 0.9;

  const gain = audioCtx.createGain();
  const peak = isGas ? 0.14 : 0.24;
  gain.gain.setValueAtTime(peak, audioCtx.currentTime);
  // exponentialRampToValueAtTime can't target exactly 0 (it's a divide-by-
  // zero in the ramp math), hence 0.001 rather than 0 as the floor.
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

  src.connect(filter).connect(gain).connect(audioCtx.destination);
  src.start();
  src.stop(audioCtx.currentTime + duration + 0.02);
}
