import { AppState } from "../core/state.js";

// ---------- procedural per-planet ambient soundscape (Web Audio API — no external audio files) ----------
// NOTE: these are stylized/artistic soundscapes, not real recordings — most of these bodies
// have no atmosphere for sound to travel through at all (the Moon, Mercury, the vacuum around
// the ISS), so "what a planet sounds like" is inherently a creative liberty, same spirit as the
// sim's other dramatized-for-engagement choices (stylized-fast ISS orbit, more-frequent-than-real
// eclipses). Each body gets a hand-tuned "profile": filtered noise (its texture) plus an optional
// low drone with slow pitch wobble (its "voice"). Swapping in real NASA plasma-wave recordings
// (Voyager/Cassini/Juno "sounds of the planets") instead of this synth is a valid future upgrade —
// see the context doc's Open items for the licensing/hosting tradeoffs that would involve.
export const AmbientAudio = (() => {
  let ctx = null;
  let masterGain = null;
  let current = null; // { bodyGain, nodes: [...] }
  let currentKey = null;
  let duckedFor = 0; // nested-duck counter, in case narration overlaps a scene transition

  const PROFILES = {
    sun: { noise: "brown", noiseGain: 0.45, filterFreq: 1400, filterQ: 0.4, drone: 55, droneGain: 0.22, lfoRate: 0.15, lfoDepth: 8, wave: "sawtooth" },
    mercury: { noise: "white", noiseGain: 0.1, filterFreq: 4200, filterQ: 0.6 },
    venus: { noise: "brown", noiseGain: 0.55, filterFreq: 280, filterQ: 0.6, drone: 38, droneGain: 0.3, lfoRate: 0.05, lfoDepth: 3 },
    earth: { noise: "pink", noiseGain: 0.22, filterFreq: 950, filterQ: 0.5, drone: 82, droneGain: 0.1, lfoRate: 0.22, lfoDepth: 8 },
    moon: { noise: "white", noiseGain: 0.015, filterFreq: 6000, filterQ: 0.3 },
    mars: { noise: "pink", noiseGain: 0.18, filterFreq: 2400, filterQ: 0.6 },
    jupiter: { noise: "brown", noiseGain: 0.6, filterFreq: 190, filterQ: 0.8, drone: 30, droneGain: 0.32, lfoRate: 0.35, lfoDepth: 18 },
    saturn: { noise: "brown", noiseGain: 0.38, filterFreq: 480, filterQ: 1.3, drone: 65, droneGain: 0.22, lfoRate: 0.1, lfoDepth: 5, wave: "triangle" },
    uranus: { noise: "pink", noiseGain: 0.18, filterFreq: 1600, filterQ: 0.9, drone: 112, droneGain: 0.1, lfoRate: 0.08, lfoDepth: 4 },
    neptune: { noise: "pink", noiseGain: 0.22, filterFreq: 1350, filterQ: 1.0, drone: 100, droneGain: 0.13, lfoRate: 0.12, lfoDepth: 5 },
    iss: { noise: "white", noiseGain: 0.07, filterFreq: 2600, filterQ: 2, drone: 120, droneGain: 0.06, lfoRate: 4.5, lfoDepth: 2, wave: "square" },
  };

  function ensureCtx() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = ctx.createGain();
      masterGain.gain.value = ambientMuted ? 0 : ambientVolume;
      masterGain.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  // Colored-noise generators (Paul Kellet's pink-noise approximation for "pink"; simple leaky
  // integrator for "brown"), baked into a 2s looping buffer so there's no per-sample JS cost at runtime.
  function makeNoiseBuffer(type) {
    const bufferSize = 2 * ctx.sampleRate;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      if (type === "white") {
        data[i] = white;
      } else if (type === "pink") {
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.969 * b2 + white * 0.153852;
        b3 = 0.8665 * b3 + white * 0.3104856;
        b4 = 0.55 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.016898;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
        b6 = white * 0.115926;
      } else {
        lastOut = (lastOut + 0.02 * white) / 1.02;
        data[i] = lastOut * 3.5;
      }
    }
    return buffer;
  }

  function stop() {
    if (!current) {
      currentKey = null;
      return;
    }
    const { bodyGain, nodes } = current;
    const now = ctx.currentTime;
    bodyGain.gain.cancelScheduledValues(now);
    bodyGain.gain.setValueAtTime(bodyGain.gain.value, now);
    bodyGain.gain.linearRampToValueAtTime(0, now + 0.8); // fade out
    nodes.forEach((n) => {
      try {
        n.stop(now + 0.9);
      } catch (e) {
        /* already stopped */
      }
    });
    current = null;
    currentKey = null;
  }

  function start(key) {
    const profile = PROFILES[key];
    if (!profile || ambientMuted) return;
    if (key === currentKey) return; // already playing this body's ambience
    ensureCtx();
    stop();
    currentKey = key;

    const nodes = [];
    const bodyGain = ctx.createGain();
    bodyGain.gain.value = 0;
    bodyGain.connect(masterGain);
    bodyGain.gain.linearRampToValueAtTime(1, ctx.currentTime + 1.5); // fade in

    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = makeNoiseBuffer(profile.noise);
    noiseSrc.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = profile.filterFreq;
    filter.Q.value = profile.filterQ;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = profile.noiseGain;
    noiseSrc.connect(filter).connect(noiseGain).connect(bodyGain);
    noiseSrc.start();
    nodes.push(noiseSrc);

    if (profile.drone) {
      const osc = ctx.createOscillator();
      osc.type = profile.wave || "sine";
      osc.frequency.value = profile.drone;
      const droneGain = ctx.createGain();
      droneGain.gain.value = profile.droneGain;
      osc.connect(droneGain).connect(bodyGain);
      osc.start();
      nodes.push(osc);

      if (profile.lfoRate) {
        const lfo = ctx.createOscillator();
        lfo.frequency.value = profile.lfoRate;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = profile.lfoDepth;
        lfo.connect(lfoGain).connect(osc.frequency);
        lfo.start();
        nodes.push(lfo);
      }
    }

    current = { bodyGain, nodes };
  }

  // Lowers ambient volume while narration speaks, restores it after — nested-safe via a counter
  // so an ElevenLabs fetch delay overlapping a fast planet-switch can't leave it stuck ducked.
  function duck(active) {
    if (!masterGain) return;
    duckedFor = Math.max(0, duckedFor + (active ? 1 : -1));
    const now = ctx.currentTime;
    const target = ambientMuted ? 0 : duckedFor > 0 ? ambientVolume * 0.3 : ambientVolume;
    masterGain.gain.cancelScheduledValues(now);
    masterGain.gain.setValueAtTime(masterGain.gain.value, now);
    masterGain.gain.linearRampToValueAtTime(target, now + 0.4);
  }

  function setMuted(muted) {
    if (masterGain) {
      const now = ctx.currentTime;
      masterGain.gain.cancelScheduledValues(now);
      masterGain.gain.setValueAtTime(masterGain.gain.value, now);
      masterGain.gain.linearRampToValueAtTime(muted ? 0 : ambientVolume, now + 0.4);
    }
    if (muted) stop();
  }

  return { start, stop, duck, setMuted };
})();

export const ambientToggleBtn = document.getElementById("ambientToggleBtn");
export const ambientVolume = 0.6; // fixed master level; narration ducks it further via AmbientAudio.duck()
export let ambientMuted = localStorage.getItem("ambientMuted") === "true";

export function updateAmbientButton() {
  ambientToggleBtn.textContent = ambientMuted ? "🌑" : "🪐";
  ambientToggleBtn.title = ambientMuted ? "Unmute planet ambience" : "Mute planet ambience";
  ambientToggleBtn.classList.toggle("muted", ambientMuted);
}
updateAmbientButton();

ambientToggleBtn.addEventListener("click", () => {
  ambientMuted = !ambientMuted;
  localStorage.setItem("ambientMuted", String(ambientMuted));
  updateAmbientButton();
  AmbientAudio.setMuted(ambientMuted);
  if (!ambientMuted && AppState.focusedTarget?.userData?.info) {
    AmbientAudio.start(AppState.focusedTarget.userData.info.name.toLowerCase());
  }
});
