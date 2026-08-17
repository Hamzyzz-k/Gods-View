import * as THREE from "three";

// ---------- real-photo colour sampling ----------
// Reads the ACTUAL colours out of each galaxy's real Wikimedia photo (the
// same verified URLs cosmos/galaxyData.js already carries) and turns them
// into a core-to-rim colour ramp the particle builder can shade stars with.
// So the 3D galaxies aren't just "a blue-ish spiral" — Andromeda gets
// Andromeda's real warm core and blue-white arms, the Sombrero gets its
// distinctive tan bulge, Centaurus A its dusty orange, because those numbers
// come off the photograph rather than out of a hand-tuned guess.
//
// The photo is never RENDERED here — this only measures it. The galaxies
// themselves stay pure geometry (see cosmos/galaxyFactory.js's header for
// why flat photo sprites were dropped); this is how the real imagery still
// informs how they look.
//
// Async by nature, so it follows the same progressive-upgrade contract as
// textures/realTextures.js: callers get a sensible ramp immediately and an
// optional callback once the real one is measured. If the fetch or the pixel
// read fails for any reason, the fallback ramp simply stays — same graceful
// degradation every other real-image path in this app already has.

const RINGS = 6; // radial zones sampled, core -> rim
const SAMPLE_SIZE = 128; // photo is downscaled to this before reading pixels; plenty for an average, and cheap
const MIN_LUMA = 0.06; // ignore near-black background sky, which would otherwise drag every average toward black

const cache = new Map(); // imageUrl -> THREE.Color[] (a measured ramp)
const pending = new Map(); // imageUrl -> Array<(ramp) => void>

// Generic warm-core/cool-rim ramp, tinted by the galaxy's own data-driven
// colour. Used until (or instead of) a measured one — this is what the
// galaxies looked like before photo sampling existed.
export function fallbackRamp(tintHex) {
  const tint = new THREE.Color(tintHex ?? 0xffffff);
  const ramp = [];
  const c = new THREE.Color();
  for (let i = 0; i < RINGS; i++) {
    const t = i / (RINGS - 1);
    c.setHSL(
      THREE.MathUtils.lerp(0.11, 0.6, Math.min(1, t * 1.25)),
      THREE.MathUtils.lerp(0.65, 0.35, t),
      THREE.MathUtils.lerp(0.82, 0.55, t)
    );
    ramp.push(c.clone().lerp(tint, 0.45));
  }
  return ramp;
}

// Averages the photo's pixels into RINGS radial bins measured from the image
// centre outward — which maps directly onto a galaxy's own core-to-rim
// structure, since these photos are all framed on their subject.
function measureRamp(img) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SAMPLE_SIZE;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);

  // Throws if the canvas is tainted (a cross-origin image served without
  // CORS headers). Wikimedia does send them — textures/realTextures.js has
  // relied on that for every planet texture in the app — but a bad or
  // redirected URL shouldn't take a tier's build down with it.
  let data;
  try {
    data = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE).data;
  } catch {
    return null;
  }

  // Hue and brightness are measured SEPARATELY, on purpose. A naive RGB
  // average of a ring converges to the same washed-out cream for every
  // galaxy, because these photos are mostly a blown-out near-white core plus
  // faint outskirts: the brightest pixels dominate the mean but carry almost
  // no colour information, since anything approaching white has no
  // meaningful hue left in it.
  //
  // So brightness comes from a plain luminance mean (which is real and
  // useful — it's the galaxy's actual light profile), while hue and
  // saturation are accumulated weighted BY saturation, letting the pixels
  // that genuinely carry colour define the colour and ignoring the white
  // ones. Hue is summed as a unit vector rather than a scalar, because hue
  // is an angle: naively averaging 0.95 and 0.05 gives 0.5 (cyan) instead of
  // the correct answer near 0 (red).
  const bins = Array.from({ length: RINGS }, () => ({ hx: 0, hy: 0, sSum: 0, hw: 0, lSum: 0, lw: 0 }));
  const mid = SAMPLE_SIZE / 2;
  const px = new THREE.Color();
  const hsl = {};

  for (let y = 0; y < SAMPLE_SIZE; y++) {
    for (let x = 0; x < SAMPLE_SIZE; x++) {
      const i = (y * SAMPLE_SIZE + x) * 4;
      const r = data[i] / 255;
      const g = data[i + 1] / 255;
      const b = data[i + 2] / 255;
      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      if (luma < MIN_LUMA) continue; // background sky, not the galaxy

      const dist = Math.hypot(x - mid, y - mid) / mid;
      if (dist > 1) continue; // corners fall outside the inscribed circle
      const bin = bins[Math.min(RINGS - 1, Math.floor(dist * RINGS))];

      bin.lSum += luma;
      bin.lw++;

      px.setRGB(r, g, b).getHSL(hsl);
      // Squared saturation weight: strongly favours the pixels that actually
      // have a colour, and all but ignores the desaturated core.
      const hw = hsl.s * hsl.s * luma;
      if (hw <= 0) continue;
      const ang = hsl.h * Math.PI * 2;
      bin.hx += Math.cos(ang) * hw;
      bin.hy += Math.sin(ang) * hw;
      bin.sSum += hsl.s * hw;
      bin.hw += hw;
    }
  }

  const ramp = [];
  for (let i = 0; i < RINGS; i++) {
    const bin = bins[i];
    if (bin.lw === 0) {
      // Empty ring (a photo that doesn't fill the frame) — reuse the last
      // real measurement rather than inventing a colour or going black.
      ramp.push((ramp[i - 1] ?? new THREE.Color(0.6, 0.65, 0.8)).clone());
      continue;
    }

    let hue = 0.09; // warm default, for a ring with no colour signal at all
    let sat = 0.25;
    if (bin.hw > 0) {
      hue = Math.atan2(bin.hy, bin.hx) / (Math.PI * 2);
      if (hue < 0) hue += 1;
      // Vector length vs total weight measures hue AGREEMENT: a ring whose
      // pixels all share a hue keeps its saturation, one with scattered hues
      // (so no real colour identity) is pulled toward neutral.
      const coherence = Math.hypot(bin.hx, bin.hy) / bin.hw;
      sat = (bin.sSum / bin.hw) * (0.45 + 0.55 * coherence);
    }

    const light = bin.lSum / bin.lw;
    const coreBoost = 1 - i / (RINGS - 1); // innermost ring gets the most lift
    ramp.push(
      new THREE.Color().setHSL(
        hue,
        THREE.MathUtils.clamp(sat * 2.1, 0.12, 0.85), // measured colour is real but faint; lift it to what the eye reads in the photo
        THREE.MathUtils.clamp(light * (0.85 + 0.5 * coreBoost) + 0.1 * coreBoost, 0.2, 0.92)
      )
    );
  }

  return ramp;
}

// Returns the best ramp available right now (measured if already cached,
// otherwise the fallback), and calls onReady(ramp) later if a real
// measurement lands. Results are cached per URL, so the same photo is never
// fetched or measured twice across tier rebuilds.
export function getGalaxyRamp(entry, onReady) {
  const url = entry.imageUrl;
  const fallback = fallbackRamp(entry.color);
  if (!url) return fallback;

  if (cache.has(url)) return cache.get(url);

  if (pending.has(url)) {
    if (onReady) pending.get(url).push(onReady);
    return fallback;
  }

  pending.set(url, onReady ? [onReady] : []);

  const img = new Image();
  img.crossOrigin = "anonymous"; // required before src for a readable (untainted) canvas
  img.onload = () => {
    const measured = measureRamp(img);
    const waiters = pending.get(url) || [];
    pending.delete(url);
    if (!measured) return; // unreadable — every waiter keeps its fallback
    cache.set(url, measured);
    waiters.forEach((fn) => fn(measured));
  };
  img.onerror = () => {
    pending.delete(url); // offline or blocked — fallback ramp stands, nothing to report
  };
  img.src = url;

  return fallback;
}

export const RAMP_LENGTH = RINGS;

// Samples a ramp at a normalized 0..1 depth into the galaxy, interpolating
// between the two nearest measured rings so shading is smooth rather than
// visibly banded into six shells.
export function sampleRamp(ramp, t, out) {
  const x = THREE.MathUtils.clamp(t, 0, 1) * (ramp.length - 1);
  const i = Math.floor(x);
  const j = Math.min(ramp.length - 1, i + 1);
  return out.copy(ramp[i]).lerp(ramp[j], x - i);
}
