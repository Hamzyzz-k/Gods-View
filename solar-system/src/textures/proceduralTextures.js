import * as THREE from "three";

// ---------- procedural planet textures ----------
// Generated on <canvas> at runtime so the scene never depends on external
// image hosting/CORS availability. Equirectangular (2:1) maps for spheres.
export function makeCanvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

export function rand(min, max) {
  return min + Math.random() * (max - min);
}

// Paints soft radial blobs, wrapping horizontally so the seam at u=0/1 is invisible.
export function blobLayer(ctx, w, h, { count, hue, sat, lightRange, radiusRange, alpha, yRange }) {
  for (let i = 0; i < count; i++) {
    const x = rand(0, w);
    const y = yRange ? rand(yRange[0] * h, yRange[1] * h) : rand(0, h);
    const r = rand(radiusRange[0], radiusRange[1]);
    const light = rand(lightRange[0], lightRange[1]);
    const color = `hsla(${hue},${sat}%,${light}%,${alpha})`;
    const transparent = `hsla(${hue},${sat}%,${light}%,0)`;
    [0, -w, w].forEach((dx) => {
      if (Math.abs(x + dx - w / 2) > w) return;
      const grd = ctx.createRadialGradient(x + dx, y, 0, x + dx, y, r);
      grd.addColorStop(0, color);
      grd.addColorStop(1, transparent);
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(x + dx, y, r, 0, Math.PI * 2);
      ctx.fill();
    });
  }
}

export function polarCaps(ctx, w, h, coverage, color) {
  const capH = h * coverage;
  const gradTop = ctx.createLinearGradient(0, 0, 0, capH);
  gradTop.addColorStop(0, color);
  gradTop.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradTop;
  ctx.fillRect(0, 0, w, capH);

  const gradBottom = ctx.createLinearGradient(0, h - capH, 0, h);
  gradBottom.addColorStop(0, "rgba(255,255,255,0)");
  gradBottom.addColorStop(1, color);
  ctx.fillStyle = gradBottom;
  ctx.fillRect(0, h - capH, w, capH);
}

// Adds fine per-pixel grain so surfaces read as textured rock/gas rather than
// flat vector gradients — cheap way to add a lot of perceived detail.
export function noiseGrain(ctx, w, h, amount) {
  const imgData = ctx.getImageData(0, 0, w, h);
  const d = imgData.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * amount;
    d[i] = Math.min(255, Math.max(0, d[i] + n));
    d[i + 1] = Math.min(255, Math.max(0, d[i + 1] + n));
    d[i + 2] = Math.min(255, Math.max(0, d[i + 2] + n));
  }
  ctx.putImageData(imgData, 0, 0);
}

// ---------- procedural heightmaps (for bumpMap) ----------
// Grayscale companions to the color textures above: lighter = raised,
// darker = recessed. Reuses the same blobLayer/noiseGrain helpers so crater
// and band positions read as physically consistent with the color map,
// without needing to touch the color-texture functions themselves.
export function crateredHeightMap(w, h, craterCount) {
  const c = makeCanvas(w, h);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "hsl(0,0%,50%)";
  ctx.fillRect(0, 0, w, h);
  // large basins/highlands, subtle
  blobLayer(ctx, w, h, { count: 10, hue: 0, sat: 0, lightRange: [40, 58], radiusRange: [w * 0.08, w * 0.2], alpha: 0.3 });
  // crater rims: raised edge + dark interior read as bump via light contrast
  blobLayer(ctx, w, h, { count: craterCount, hue: 0, sat: 0, lightRange: [18, 34], radiusRange: [1.5, w * 0.035], alpha: 0.55 });
  blobLayer(ctx, w, h, { count: Math.round(craterCount / 2), hue: 0, sat: 0, lightRange: [62, 82], radiusRange: [1, w * 0.012], alpha: 0.35 });
  noiseGrain(ctx, w, h, 18);
  return c;
}

export function bandedHeightMap(w, h, bandCount) {
  const c = makeCanvas(w, h);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "hsl(0,0%,50%)";
  ctx.fillRect(0, 0, w, h);
  const bandH = h / bandCount;
  for (let i = 0; i < bandCount; i++) {
    ctx.fillStyle = `hsla(0,0%,${50 + rand(-8, 8)}%,0.4)`;
    ctx.fillRect(0, i * bandH, w, bandH + 1);
  }
  blobLayer(ctx, w, h, { count: 70, hue: 0, sat: 0, lightRange: [40, 62], radiusRange: [w * 0.01, w * 0.04], alpha: 0.3 });
  noiseGrain(ctx, w, h, 10);
  return c;
}

export function terrainHeightMap(w, h) {
  const c = makeCanvas(w, h);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "hsl(0,0%,38%)"; // oceans sit slightly recessed
  ctx.fillRect(0, 0, w, h);
  // continents raised above the ocean floor, with rougher mountainous edges
  blobLayer(ctx, w, h, { count: 26, hue: 0, sat: 0, lightRange: [55, 72], radiusRange: [w * 0.05, w * 0.14], alpha: 0.85, yRange: [0.15, 0.85] });
  blobLayer(ctx, w, h, { count: 16, hue: 0, sat: 0, lightRange: [70, 88], radiusRange: [w * 0.006, w * 0.018], alpha: 0.4, yRange: [0.2, 0.8] });
  noiseGrain(ctx, w, h, 12);
  return c;
}

export function cloudHeightMap(w, h) {
  const c = makeCanvas(w, h);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "hsl(0,0%,48%)";
  ctx.fillRect(0, 0, w, h);
  blobLayer(ctx, w, h, { count: 40, hue: 0, sat: 0, lightRange: [45, 66], radiusRange: [w * 0.02, w * 0.05], alpha: 0.4 });
  noiseGrain(ctx, w, h, 8);
  return c;
}

export function bandedPlanet(w, h, baseHue, baseSat, baseLight, bandCount, contrast, spotColor, ringShadow) {
  const c = makeCanvas(w, h);
  const ctx = c.getContext("2d");
  ctx.fillStyle = `hsl(${baseHue},${baseSat}%,${baseLight}%)`;
  ctx.fillRect(0, 0, w, h);

  const bandH = h / bandCount;
  for (let i = 0; i < bandCount; i++) {
    const light = baseLight + rand(-contrast, contrast);
    const sat = baseSat + rand(-8, 8);
    ctx.fillStyle = `hsla(${baseHue + rand(-4, 4)},${sat}%,${light}%,0.55)`;
    ctx.fillRect(0, i * bandH, w, bandH + 1);
  }
  // soften bands with horizontal wavy blobs
  blobLayer(ctx, w, h, {
    count: 40,
    hue: baseHue,
    sat: baseSat,
    lightRange: [baseLight - contrast, baseLight + contrast],
    radiusRange: [w * 0.05, w * 0.14],
    alpha: 0.35,
  });
  // finer turbulence swirls within the bands, for a more storm-like texture
  blobLayer(ctx, w, h, {
    count: 90,
    hue: baseHue,
    sat: baseSat + 6,
    lightRange: [baseLight - contrast * 0.6, baseLight + contrast * 0.6],
    radiusRange: [w * 0.01, w * 0.04],
    alpha: 0.28,
  });
  if (spotColor) {
    const x = w * 0.62;
    const y = h * 0.58;
    const grd = ctx.createRadialGradient(x, y, 0, x, y, w * 0.08);
    grd.addColorStop(0, spotColor);
    grd.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.ellipse(x, y, w * 0.08, h * 0.05, 0, 0, Math.PI * 2);
    ctx.fill();
    // subtle darker ring around the storm for a sense of depth/rotation
    ctx.strokeStyle = spotColor.replace(/[\d.]+\)$/, "0.35)");
    ctx.lineWidth = w * 0.004;
    ctx.beginPath();
    ctx.ellipse(x, y, w * 0.1, h * 0.065, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (ringShadow) {
    // Soft dark band standing in for the shadow Saturn's rings cast on the
    // planet itself — baked straight into the color texture rather than a
    // real shadow-map, so it costs nothing at render time. Roughly centered
    // on the equator, where the rings project onto the globe.
    const bandCenter = h * 0.52;
    const bandHalfHeight = h * 0.05;
    const grad = ctx.createLinearGradient(0, bandCenter - bandHalfHeight, 0, bandCenter + bandHalfHeight);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(0.5, "rgba(10,8,4,0.4)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, bandCenter - bandHalfHeight, w, bandHalfHeight * 2);
  }
  noiseGrain(ctx, w, h, 8);
  return c;
}

export function crateredPlanet(w, h, hue, sat, baseLight, craterCount, poles) {
  const c = makeCanvas(w, h);
  const ctx = c.getContext("2d");
  ctx.fillStyle = `hsl(${hue},${sat}%,${baseLight}%)`;
  ctx.fillRect(0, 0, w, h);

  // broad regional albedo variation (large light/dark terrain patches, not just craters)
  blobLayer(ctx, w, h, {
    count: 10,
    hue,
    sat: sat + 4,
    lightRange: [baseLight - 10, baseLight + 8],
    radiusRange: [w * 0.08, w * 0.22],
    alpha: 0.3,
  });

  blobLayer(ctx, w, h, {
    count: craterCount,
    hue,
    sat,
    lightRange: [baseLight - 18, baseLight + 6],
    radiusRange: [1.5, w * 0.035],
    alpha: 0.5,
  });
  blobLayer(ctx, w, h, {
    count: Math.round(craterCount / 3),
    hue,
    sat,
    lightRange: [baseLight + 4, baseLight + 14],
    radiusRange: [1, w * 0.015],
    alpha: 0.4,
  });
  // fine micro-craters — visible now that resolution is higher
  blobLayer(ctx, w, h, {
    count: Math.round(craterCount * 1.4),
    hue,
    sat,
    lightRange: [baseLight - 10, baseLight + 4],
    radiusRange: [0.5, w * 0.008],
    alpha: 0.3,
  });
  if (poles) polarCaps(ctx, w, h, 0.1, "rgba(255,255,255,0.55)");
  noiseGrain(ctx, w, h, 10);
  return c;
}

export function earthTexture(w, h) {
  const c = makeCanvas(w, h);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "hsl(210,65%,32%)";
  ctx.fillRect(0, 0, w, h);
  // ocean depth variation (deep trenches vs. shallower basins)
  blobLayer(ctx, w, h, {
    count: 14,
    hue: 215,
    sat: 55,
    lightRange: [22, 30],
    radiusRange: [w * 0.1, w * 0.22],
    alpha: 0.4,
  });
  // continents
  blobLayer(ctx, w, h, {
    count: 26,
    hue: 100,
    sat: 35,
    lightRange: [28, 42],
    radiusRange: [w * 0.05, w * 0.14],
    alpha: 0.9,
    yRange: [0.15, 0.85],
  });
  // terrain variety within continents (forest/desert tone variation)
  blobLayer(ctx, w, h, {
    count: 22,
    hue: 90,
    sat: 40,
    lightRange: [22, 34],
    radiusRange: [w * 0.02, w * 0.05],
    alpha: 0.5,
    yRange: [0.2, 0.75],
  });
  blobLayer(ctx, w, h, {
    count: 18,
    hue: 32,
    sat: 30,
    lightRange: [30, 40],
    radiusRange: [w * 0.02, w * 0.06],
    alpha: 0.7,
    yRange: [0.2, 0.8],
  });
  // mountain-range highlights — thin brighter streaks
  blobLayer(ctx, w, h, {
    count: 16,
    hue: 30,
    sat: 15,
    lightRange: [55, 68],
    radiusRange: [w * 0.006, w * 0.018],
    alpha: 0.4,
    yRange: [0.2, 0.8],
  });
  // shallow-water coastlines
  blobLayer(ctx, w, h, {
    count: 24,
    hue: 195,
    sat: 55,
    lightRange: [45, 55],
    radiusRange: [w * 0.015, w * 0.04],
    alpha: 0.4,
    yRange: [0.15, 0.85],
  });
  // clouds
  blobLayer(ctx, w, h, {
    count: 34,
    hue: 0,
    sat: 0,
    lightRange: [92, 100],
    radiusRange: [w * 0.03, w * 0.09],
    alpha: 0.16,
  });
  polarCaps(ctx, w, h, 0.12, "rgba(255,255,255,0.85)");
  noiseGrain(ctx, w, h, 6);
  return c;
}

export function marsTexture(w, h) {
  const c = makeCanvas(w, h);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "hsl(16,55%,42%)";
  ctx.fillRect(0, 0, w, h);
  blobLayer(ctx, w, h, {
    count: 34,
    hue: 16,
    sat: 50,
    lightRange: [24, 34],
    radiusRange: [w * 0.03, w * 0.1],
    alpha: 0.55,
  });
  blobLayer(ctx, w, h, {
    count: 22,
    hue: 22,
    sat: 45,
    lightRange: [48, 58],
    radiusRange: [w * 0.015, w * 0.04],
    alpha: 0.4,
  });
  // Valles-Marineris-style darker canyon streaks
  blobLayer(ctx, w, h, {
    count: 10,
    hue: 12,
    sat: 55,
    lightRange: [18, 26],
    radiusRange: [w * 0.008, w * 0.02],
    alpha: 0.45,
    yRange: [0.35, 0.6],
  });
  // faint dust-storm haze
  blobLayer(ctx, w, h, {
    count: 20,
    hue: 30,
    sat: 30,
    lightRange: [55, 65],
    radiusRange: [w * 0.02, w * 0.05],
    alpha: 0.15,
  });
  polarCaps(ctx, w, h, 0.07, "rgba(255,255,255,0.8)");
  noiseGrain(ctx, w, h, 8);
  return c;
}

export function venusTexture(w, h) {
  const c = makeCanvas(w, h);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "hsl(42,45%,68%)";
  ctx.fillRect(0, 0, w, h);
  // faint horizontal cloud banding — Venus's thick atmosphere shows subtle bands in UV
  const bandCount = 8;
  const bandH = h / bandCount;
  for (let i = 0; i < bandCount; i++) {
    const light = 68 + rand(-4, 4);
    ctx.fillStyle = `hsla(42,${40 + rand(-6, 6)}%,${light}%,0.3)`;
    ctx.fillRect(0, i * bandH, w, bandH + 1);
  }
  blobLayer(ctx, w, h, {
    count: 46,
    hue: 42,
    sat: 40,
    lightRange: [58, 78],
    radiusRange: [w * 0.06, w * 0.16],
    alpha: 0.5,
  });
  blobLayer(ctx, w, h, {
    count: 28,
    hue: 35,
    sat: 45,
    lightRange: [50, 62],
    radiusRange: [w * 0.02, w * 0.05],
    alpha: 0.35,
  });
  // finer swirling streaks, evoking the characteristic Venusian "Y" cloud pattern
  blobLayer(ctx, w, h, {
    count: 30,
    hue: 40,
    sat: 35,
    lightRange: [62, 74],
    radiusRange: [w * 0.01, w * 0.03],
    alpha: 0.25,
  });
  noiseGrain(ctx, w, h, 6);
  return c;
}

export function sunTexture(w, h) {
  const c = makeCanvas(w, h);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "hsl(42,100%,55%)";
  ctx.fillRect(0, 0, w, h);
  blobLayer(ctx, w, h, {
    count: 90,
    hue: 38,
    sat: 100,
    lightRange: [50, 70],
    radiusRange: [w * 0.03, w * 0.09],
    alpha: 0.55,
  });
  blobLayer(ctx, w, h, {
    count: 60,
    hue: 20,
    sat: 100,
    lightRange: [45, 55],
    radiusRange: [w * 0.015, w * 0.05],
    alpha: 0.45,
  });
  blobLayer(ctx, w, h, {
    count: 40,
    hue: 55,
    sat: 100,
    lightRange: [75, 90],
    radiusRange: [w * 0.01, w * 0.03],
    alpha: 0.5,
  });
  // fine granulation speckle for a surface-boil texture up close
  blobLayer(ctx, w, h, {
    count: 130,
    hue: 45,
    sat: 100,
    lightRange: [55, 80],
    radiusRange: [w * 0.004, w * 0.012],
    alpha: 0.3,
  });
  noiseGrain(ctx, w, h, 10);
  return c;
}

export function ringTexture(w, h, baseHue, baseSat, baseLight) {
  const c = makeCanvas(w, h);
  const ctx = c.getContext("2d");
  const gapCenter = w * 0.62; // roughly where the Cassini division sits in the ring's radial span
  const gapWidth = w * 0.03;
  for (let x = 0; x < w; x++) {
    const n = Math.sin(x * 0.15) * 0.5 + Math.sin(x * 0.05) * 0.5;
    const light = baseLight + n * 14;
    let alpha = 0.35 + Math.abs(Math.sin(x * 0.08)) * 0.5;
    if (Math.abs(x - gapCenter) < gapWidth) alpha *= 0.1; // dark band = the gap
    ctx.fillStyle = `hsla(${baseHue},${baseSat}%,${light}%,${alpha})`;
    ctx.fillRect(x, 0, 1, h);
  }
  return c;
}

export function earthCloudsTexture(w, h) {
  const c = makeCanvas(w, h);
  const ctx = c.getContext("2d");
  // no base fill — stays transparent, only the cloud blobs are painted
  blobLayer(ctx, w, h, {
    count: 55,
    hue: 0,
    sat: 0,
    lightRange: [95, 100],
    radiusRange: [w * 0.03, w * 0.1],
    alpha: 0.55,
  });
  blobLayer(ctx, w, h, {
    count: 35,
    hue: 0,
    sat: 0,
    lightRange: [90, 100],
    radiusRange: [w * 0.015, w * 0.04],
    alpha: 0.4,
  });
  return c;
}

// Small grid texture standing in for solar-cell panels on the ISS model.
export function issPanelTexture(w, h) {
  const c = makeCanvas(w, h);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#0a1a33";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "rgba(120,180,255,0.55)";
  ctx.lineWidth = 1;
  const cols = 8;
  const rows = 3;
  for (let i = 1; i < cols; i++) {
    ctx.beginPath();
    ctx.moveTo((i / cols) * w, 0);
    ctx.lineTo((i / cols) * w, h);
    ctx.stroke();
  }
  for (let j = 1; j < rows; j++) {
    ctx.beginPath();
    ctx.moveTo(0, (j / rows) * h);
    ctx.lineTo(w, (j / rows) * h);
    ctx.stroke();
  }
  return c;
}

// A small, schematic (not-to-scale) low-poly ISS: central truss, a stack of
// pressurized modules, and four solar-array wings. Built entirely from
// primitives so it needs no external model/texture assets.
const textureCache = {};
export function getTexture(key, factory) {
  if (!textureCache[key]) {
    const canvas = factory();
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    textureCache[key] = tex;
  }
  return textureCache[key];
}

