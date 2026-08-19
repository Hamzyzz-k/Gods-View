import { ambientMuted, ambientVolume } from "../audio/ambientAudio.js";

// ---------- the sound of the sequence ----------
// Synthesised, not a file. Three reasons: nothing has to be downloaded or
// licensed, it costs a few hundred bytes instead of a megabyte, and it can be
// driven continuously from the same clock that drives the visuals rather than
// being a fixed clip that drifts out of sync with a looping animation.
//
// It also has to be honest, which is worth stating in a project that has been
// careful about this elsewhere: space is a vacuum and the Big Bang made no
// sound anyone could have heard. What this is doing is what a documentary
// score does — carrying the shape of the event, not reproducing it. The
// caption already tells the player the visuals are an interpretation; the
// audio is the same interpretation.
//
// Respects the existing AMB mute, so one control still silences everything.

const RUMBLE_HZ = 34; // low enough to feel rather than hear on decent speakers

let ctx = null;
let master = null;
let started = false;

// Noise is the bulk of an explosion; tones alone sound like a synthesiser.
// Generated once into a looping buffer rather than per-frame.
function makeNoiseBuffer(audioCtx, seconds) {
  const frames = Math.floor(audioCtx.sampleRate * seconds);
  const buffer = audioCtx.createBuffer(1, frames, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < frames; i++) {
    const white = Math.random() * 2 - 1;
    // Leaky integrator: turns white noise brown-ish, which is the deep
    // roaring end of the spectrum rather than the hiss.
    last = (last + 0.02 * white) / 1.02;
    data[i] = last * 3.2;
  }
  return buffer;
}

function build() {
  ctx = new (window.AudioContext || window.webkitAudioContext)();

  master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);

  // Roar: brown noise through a lowpass that opens at the detonation.
  const noise = ctx.createBufferSource();
  noise.buffer = makeNoiseBuffer(ctx, 4);
  noise.loop = true;

  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = "lowpass";
  noiseFilter.frequency.value = 200;
  noiseFilter.Q.value = 0.6;

  const noiseGain = ctx.createGain();
  noiseGain.gain.value = 0;

  noise.connect(noiseFilter).connect(noiseGain).connect(master);
  noise.start();

  // Sub: the felt weight under the roar.
  const sub = ctx.createOscillator();
  sub.type = "sine";
  sub.frequency.value = RUMBLE_HZ;
  const subGain = ctx.createGain();
  subGain.gain.value = 0;
  sub.connect(subGain).connect(master);
  sub.start();

  // Shimmer: a high, slowly detuning pair that fades in as structure forms —
  // the "something is being built" register, against the roar's collapse.
  const shimmer = ctx.createOscillator();
  shimmer.type = "triangle";
  shimmer.frequency.value = 520;
  const shimmer2 = ctx.createOscillator();
  shimmer2.type = "triangle";
  shimmer2.frequency.value = 523.5; // a few cents off, so the pair beats slowly
  const shimmerGain = ctx.createGain();
  shimmerGain.gain.value = 0;
  shimmer.connect(shimmerGain);
  shimmer2.connect(shimmerGain);
  shimmerGain.connect(master);
  shimmer.start();
  shimmer2.start();

  return { noiseFilter, noiseGain, subGain, shimmerGain };
}

let nodes = null;

// Called every frame while the tier is active, with the sequence clock. Gains
// are ramped rather than assigned so parameter changes don't click.
export function updateBigBangAudio(t, loopSeconds) {
  if (ambientMuted) {
    if (master) master.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
    return;
  }

  // Created lazily on first use: browsers refuse to start an AudioContext
  // before a user gesture, and by the time someone has navigated to this tier
  // they have made several.
  if (!ctx) {
    try {
      nodes = build();
    } catch {
      return; // no audio available; the visuals stand alone
    }
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  if (!started) started = true;

  const now = ctx.currentTime;
  const ramp = 0.08;

  // Silence before the detonation — the reference's opening is a still point
  // in the dark, and it is much more effective if it is also quiet.
  const preBang = t < 2.0 ? 0 : 1;

  // Decay envelope. The base is clamped to zero BEFORE the exponent, not
  // after: once t passes the decay window the base goes negative, and
  // Math.pow(negative, 1.6) is NaN — which WebAudio rejects outright with
  // "The provided float value is non-finite", killing the whole update. A
  // fractional exponent makes that a crash rather than merely a wrong number.
  const decay = (start, span, shape) =>
    t < start ? 0 : Math.pow(Math.max(0, 1 - (t - start) / span), shape);

  // Roar: slams in at the detonation, then decays across the rest of the loop.
  const roar = decay(2.0, 16, 1.6);
  nodes.noiseGain.gain.setTargetAtTime(roar * 0.55 * preBang, now, ramp);
  // The filter opening is what makes it read as a burst rather than a fade-in.
  nodes.noiseFilter.frequency.setTargetAtTime(200 + roar * 2600, now, ramp);

  const sub = decay(2.0, 12, 2.0);
  nodes.subGain.gain.setTargetAtTime(sub * 0.42, now, ramp);

  // Shimmer arrives with the galaxies and stays to the end of the loop.
  const structure = Math.min(1, Math.max(0, (t - 12) / 8));
  nodes.shimmerGain.gain.setTargetAtTime(structure * 0.05, now, 0.4);

  // Fade the whole bed out over the last two seconds so the loop restart is a
  // dip to silence rather than an audible seam.
  const tail = t > loopSeconds - 2 ? Math.max(0, (loopSeconds - t) / 2) : 1;
  master.gain.setTargetAtTime(ambientVolume * 0.8 * tail, now, ramp);
}

// Called when the tier is left. The context is kept (creating them repeatedly
// leaks, and browsers cap how many a page may have) — only silenced.
export function stopBigBangAudio() {
  if (!ctx || !master) return;
  master.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
}
