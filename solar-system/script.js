import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

// ---------- basic setup ----------
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  50,
  window.innerWidth / window.innerHeight,
  0.1,
  5000
);
camera.position.set(0, 60, 140);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 3;
controls.maxDistance = 800;
controls.zoomSpeed = 4.5; // higher = more sensitive scroll/pinch zoom

// ---------- lighting ----------
const sunLight = new THREE.PointLight(0xffffff, 3.2, 0, 0);
sunLight.position.set(0, 0, 0);
scene.add(sunLight);

const ambient = new THREE.AmbientLight(0x222233, 0.6);
scene.add(ambient);

// ---------- starfield ----------
function createStarfield() {
  const starGeo = new THREE.BufferGeometry();
  const starCount = 6000;
  const positions = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const r = 900 * Math.random() + 200;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);
  }
  starGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const starMat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 1.1,
    sizeAttenuation: true,
  });
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);
}
createStarfield();

// ---------- background constellations ----------
// Faint stick-figure constellations drawn on the celestial sphere, in the
// spirit of NASA's Eyes on the Solar System background. Star positions are
// real (approximate) right-ascension/declination coordinates for each
// constellation's brightest stars; `lines` connects star indices into the
// familiar stick-figure asterism. Purely decorative — not tied to any real
// date/time, so it doesn't attempt to match tonight's actual sky.
const CONSTELLATIONS = [
  { name: "Ursa Major", stars: [
      { ra: 11.03, dec: 61.75 }, { ra: 11.03, dec: 56.38 }, { ra: 11.90, dec: 53.70 },
      { ra: 12.25, dec: 57.03 }, { ra: 12.90, dec: 55.96 }, { ra: 13.40, dec: 54.93 },
      { ra: 13.79, dec: 49.31 },
    ], lines: [[0,1],[1,2],[2,3],[3,0],[3,4],[4,5],[5,6]] },
  { name: "Orion", stars: [
      { ra: 5.92, dec: 7.41 }, { ra: 5.42, dec: 6.35 }, { ra: 5.53, dec: -0.30 },
      { ra: 5.60, dec: -1.20 }, { ra: 5.68, dec: -1.94 }, { ra: 5.80, dec: -9.67 },
      { ra: 5.24, dec: -8.20 },
    ], lines: [[0,3],[1,2],[2,3],[3,4],[4,5],[2,6]] },
  { name: "Cassiopeia", stars: [
      { ra: 0.15, dec: 59.15 }, { ra: 0.67, dec: 56.54 }, { ra: 0.95, dec: 60.72 },
      { ra: 1.43, dec: 60.24 }, { ra: 1.91, dec: 63.67 },
    ], lines: [[0,1],[1,2],[2,3],[3,4]] },
  { name: "Leo", stars: [
      { ra: 10.14, dec: 11.97 }, { ra: 10.33, dec: 19.84 }, { ra: 11.24, dec: 20.52 },
      { ra: 11.24, dec: 15.43 }, { ra: 11.82, dec: 14.57 },
    ], lines: [[0,1],[1,2],[2,3],[3,0],[3,4]] },
  { name: "Scorpius", stars: [
      { ra: 16.09, dec: -19.80 }, { ra: 16.00, dec: -22.62 }, { ra: 16.49, dec: -26.43 },
      { ra: 17.62, dec: -42.99 }, { ra: 17.56, dec: -37.10 },
    ], lines: [[0,1],[1,2],[2,4],[4,3]] },
  { name: "Cygnus", stars: [
      { ra: 20.69, dec: 45.28 }, { ra: 20.37, dec: 40.26 }, { ra: 19.51, dec: 27.96 },
      { ra: 20.77, dec: 33.97 }, { ra: 19.75, dec: 45.13 },
    ], lines: [[0,1],[1,2],[3,1],[1,4]] },
  { name: "Taurus", stars: [
      { ra: 4.60, dec: 16.51 }, { ra: 5.44, dec: 28.61 }, { ra: 4.30, dec: 12.49 },
      { ra: 4.48, dec: 15.87 },
    ], lines: [[2,3],[3,0],[0,1]] },
  { name: "Pegasus", stars: [
      { ra: 23.08, dec: 15.21 }, { ra: 23.06, dec: 28.08 }, { ra: 0.14, dec: 29.09 },
      { ra: 0.22, dec: 15.18 },
    ], lines: [[0,1],[1,2],[2,3],[3,0]] },
];

function raDecToVec3(raHours, decDeg, radius) {
  const raRad = THREE.MathUtils.degToRad(raHours * 15);
  const decRad = THREE.MathUtils.degToRad(decDeg);
  return new THREE.Vector3(
    radius * Math.cos(decRad) * Math.cos(raRad),
    radius * Math.sin(decRad),
    radius * Math.cos(decRad) * Math.sin(raRad)
  );
}

function createConstellationLabel(text) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  ctx.font = "28px sans-serif";
  ctx.fillStyle = "rgba(170,195,255,0.55)";
  ctx.textAlign = "center";
  ctx.fillText(text, 128, 40);
  const texture = new THREE.CanvasTexture(canvas);
  const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.scale.set(70, 17.5, 1);
  return sprite;
}

function createConstellations() {
  const group = new THREE.Group();
  const R = 980; // just inside the outer edge of the starfield shell
  const lineMat = new THREE.LineBasicMaterial({ color: 0x5d7fc7, transparent: true, opacity: 0.35 });
  const starGeo = new THREE.SphereGeometry(1.6, 6, 6);
  const starMat = new THREE.MeshBasicMaterial({ color: 0xdfe9ff });

  CONSTELLATIONS.forEach((c) => {
    const points = c.stars.map((s) => raDecToVec3(s.ra, s.dec, R));

    points.forEach((p) => {
      const starMesh = new THREE.Mesh(starGeo, starMat);
      starMesh.position.copy(p);
      group.add(starMesh);
    });

    c.lines.forEach(([a, b]) => {
      const geo = new THREE.BufferGeometry().setFromPoints([points[a], points[b]]);
      group.add(new THREE.Line(geo, lineMat));
    });

    const centroid = new THREE.Vector3();
    points.forEach((p) => centroid.add(p));
    centroid.divideScalar(points.length);
    const label = createConstellationLabel(c.name);
    label.position.copy(centroid);
    group.add(label);
  });

  scene.add(group);
  return group;
}
const constellations = createConstellations();

// ---------- procedural planet textures ----------
// Generated on <canvas> at runtime so the scene never depends on external
// image hosting/CORS availability. Equirectangular (2:1) maps for spheres.
function makeCanvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}

// Paints soft radial blobs, wrapping horizontally so the seam at u=0/1 is invisible.
function blobLayer(ctx, w, h, { count, hue, sat, lightRange, radiusRange, alpha, yRange }) {
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

function polarCaps(ctx, w, h, coverage, color) {
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
function noiseGrain(ctx, w, h, amount) {
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
function crateredHeightMap(w, h, craterCount) {
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

function bandedHeightMap(w, h, bandCount) {
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

function terrainHeightMap(w, h) {
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

function cloudHeightMap(w, h) {
  const c = makeCanvas(w, h);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "hsl(0,0%,48%)";
  ctx.fillRect(0, 0, w, h);
  blobLayer(ctx, w, h, { count: 40, hue: 0, sat: 0, lightRange: [45, 66], radiusRange: [w * 0.02, w * 0.05], alpha: 0.4 });
  noiseGrain(ctx, w, h, 8);
  return c;
}

function bandedPlanet(w, h, baseHue, baseSat, baseLight, bandCount, contrast, spotColor, ringShadow) {
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

function crateredPlanet(w, h, hue, sat, baseLight, craterCount, poles) {
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

function earthTexture(w, h) {
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

function marsTexture(w, h) {
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

function venusTexture(w, h) {
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

function sunTexture(w, h) {
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

function ringTexture(w, h, baseHue, baseSat, baseLight) {
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

function earthCloudsTexture(w, h) {
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
function issPanelTexture(w, h) {
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
function createISSModel() {
  const group = new THREE.Group();

  const trussMat = new THREE.MeshStandardMaterial({ color: 0xd8d8dc, metalness: 0.7, roughness: 0.35 });
  const moduleMat = new THREE.MeshStandardMaterial({ color: 0xe4dcc8, metalness: 0.3, roughness: 0.5 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xcf9d4f, metalness: 0.6, roughness: 0.4 });
  const panelMat = new THREE.MeshStandardMaterial({
    map: getTexture("ISSPanel", () => issPanelTexture(128, 64)),
    color: 0x6f9fd8,
    metalness: 0.2,
    roughness: 0.5,
    side: THREE.DoubleSide,
  });
  const radiatorMat = new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.6 });

  // central integrated truss
  const truss = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.09, 0.09), trussMat);
  group.add(truss);

  // pressurized module cluster (stand-in for Unity/Zarya/Zvezda)
  const moduleGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.55, 12);
  [-1, 0, 1].forEach((i) => {
    const m = new THREE.Mesh(moduleGeo, i === 0 ? goldMat : moduleMat);
    m.rotation.z = Math.PI / 2;
    m.position.set(i * 0.35, -0.15, 0);
    group.add(m);
  });

  // four solar-array wings, two pairs near each end of the truss
  [-1.05, 1.05].forEach((x) => {
    [-1, 1].forEach((side) => {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.55, 1.3), panelMat);
      wing.position.set(x, 0, side * 0.75);
      group.add(wing);
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 6), trussMat);
      mast.rotation.x = Math.PI / 2;
      mast.position.set(x, 0, side * 0.15);
      group.add(mast);
    });
  });

  // radiator panels along the truss
  [-0.55, 0.55].forEach((x) => {
    const rad = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.02), radiatorMat);
    rad.position.set(x, 0.15, 0);
    group.add(rad);
  });

  group.scale.setScalar(0.42); // keep it small and subtle next to Earth
  return group;
}

const textureCache = {};
function getTexture(key, factory) {
  if (!textureCache[key]) {
    const canvas = factory();
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    textureCache[key] = tex;
  }
  return textureCache[key];
}

// ---------- real photographic textures (progressive upgrade) ----------
// The scene renders immediately with the procedural canvas textures above
// (so it never depends on network access), then quietly swaps in real
// NASA-derived equirectangular maps as they finish downloading. Source:
// Solar System Scope's texture pack, CC BY 4.0, mirrored on Wikimedia
// Commons — chosen specifically because upload.wikimedia.org serves images
// with permissive CORS headers, which WebGL textures require.
const REAL_TEXTURE_URLS = {
  Sun: "https://upload.wikimedia.org/wikipedia/commons/c/cb/Solarsystemscope_texture_2k_sun.jpg",
  Mercury: "https://upload.wikimedia.org/wikipedia/commons/9/92/Solarsystemscope_texture_2k_mercury.jpg",
  Venus: "https://upload.wikimedia.org/wikipedia/commons/4/40/Solarsystemscope_texture_2k_venus_surface.jpg",
  Earth: "https://upload.wikimedia.org/wikipedia/commons/c/c3/Solarsystemscope_texture_2k_earth_daymap.jpg",
  EarthClouds: "https://upload.wikimedia.org/wikipedia/commons/e/ed/Solarsystemscope_texture_2k_earth_clouds.jpg",
  Mars: "https://upload.wikimedia.org/wikipedia/commons/4/46/Solarsystemscope_texture_2k_mars.jpg",
  Jupiter: "https://upload.wikimedia.org/wikipedia/commons/b/be/Solarsystemscope_texture_2k_jupiter.jpg",
  Saturn: "https://upload.wikimedia.org/wikipedia/commons/e/ea/Solarsystemscope_texture_2k_saturn.jpg",
  SaturnRing: "https://upload.wikimedia.org/wikipedia/commons/7/7d/Solarsystemscope_texture_2k_saturn_ring_alpha.png",
  Uranus: "https://upload.wikimedia.org/wikipedia/commons/9/95/Solarsystemscope_texture_2k_uranus.jpg",
  Neptune: "https://upload.wikimedia.org/wikipedia/commons/1/1e/Solarsystemscope_texture_2k_neptune.jpg",
  Moon: "https://upload.wikimedia.org/wikipedia/commons/2/26/Solarsystemscope_texture_2k_moon.jpg",
};

const realTextureLoader = new THREE.TextureLoader();
realTextureLoader.crossOrigin = "anonymous";

// Tracks how many real-texture fetches succeeded/failed so we can surface a
// single, visible summary (via the existing toast UI) once they've all
// settled — without needing the browser dev console open. Debounced with a
// short timer since ~12 requests fire in quick succession at startup.
const realTextureStats = { requested: 0, settled: 0, loaded: 0 };
let realTextureReportTimer = null;
function reportRealTextureStatus() {
  clearTimeout(realTextureReportTimer);
  realTextureReportTimer = setTimeout(() => {
    const { requested, settled, loaded } = realTextureStats;
    if (settled < requested) return; // more still in flight
    if (loaded === 0) {
      showToast(
        "⚠️ Real textures unavailable",
        "Couldn't fetch photo textures from Wikimedia — check your internet connection, or that this page is being served over http(s) rather than opened directly as a local file (module scripts are blocked on file://). Using the built-in procedural textures instead.",
        10000
      );
    } else if (loaded < requested) {
      showToast("🪐 Real textures partly loaded", `${loaded}/${requested} loaded; the rest fell back to procedural textures.`, 6000);
    } else {
      showToast("🪐 Real textures loaded", `All ${loaded} NASA-derived textures loaded successfully.`, 5000);
    }
  }, 500);
}

// Loads a real texture and hands it to `onLoad` once ready. If the request
// fails for any reason (offline, blocked, slow network timeout) it just
// logs a warning and leaves whatever procedural texture is already on the
// material in place — the scene degrades gracefully instead of breaking.
function loadRealTexture(url, onLoad) {
  realTextureStats.requested++;
  realTextureLoader.load(
    url,
    (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.wrapS = THREE.RepeatWrapping;
      onLoad(tex);
      realTextureStats.settled++;
      realTextureStats.loaded++;
      reportRealTextureStatus();
    },
    undefined,
    (err) => {
      console.warn(`Real texture unavailable, keeping procedural texture: ${url}`, err);
      realTextureStats.settled++;
      reportRealTextureStatus();
    }
  );
}

const PLANET_TEXTURE_FACTORIES = {
  Mercury: () => crateredPlanet(1024, 512, 28, 6, 48, 480, false),
  Venus: () => venusTexture(1024, 512),
  Earth: () => earthTexture(1024, 512),
  Mars: () => marsTexture(1024, 512),
  Jupiter: () => bandedPlanet(1024, 512, 32, 35, 62, 16, 10, "hsla(8,70%,55%,0.85)"),
  Saturn: () => bandedPlanet(1024, 512, 44, 28, 70, 12, 7, null, true), // ringShadow = true
  Uranus: () => bandedPlanet(1024, 512, 185, 45, 72, 6, 4, null),
  Neptune: () => bandedPlanet(1024, 512, 225, 60, 48, 7, 5, "hsla(220,50%,30%,0.6)"),
  Moon: () => crateredPlanet(512, 256, 40, 4, 60, 300, false),
  Pluto: () => crateredPlanet(1024, 512, 30, 22, 62, 220, true),
};

// Grayscale companions used as bumpMap, so surfaces catch light like real
// terrain instead of perfectly smooth spheres. Keyed the same way as the
// color factories above; consumed in createPlanet() via data.bumpScale.
const PLANET_BUMP_FACTORIES = {
  Mercury: () => crateredHeightMap(1024, 512, 480),
  Venus: () => cloudHeightMap(1024, 512),
  Earth: () => terrainHeightMap(1024, 512),
  Mars: () => crateredHeightMap(1024, 512, 260),
  Jupiter: () => bandedHeightMap(1024, 512, 16),
  Saturn: () => bandedHeightMap(1024, 512, 12),
  Uranus: () => bandedHeightMap(1024, 512, 6),
  Neptune: () => bandedHeightMap(1024, 512, 7),
  Moon: () => crateredHeightMap(512, 256, 300),
  Pluto: () => crateredHeightMap(1024, 512, 220),
};

// ---------- sun ----------
const sunGeo = new THREE.SphereGeometry(8, 48, 48);
const sunMat = new THREE.MeshBasicMaterial({ map: getTexture("Sun", () => sunTexture(1024, 512)) });
const sun = new THREE.Mesh(sunGeo, sunMat);
sun.name = "Sun";
scene.add(sun);
loadRealTexture(REAL_TEXTURE_URLS.Sun, (tex) => {
  sunMat.map = tex;
  sunMat.needsUpdate = true;
});

// glow sprite around sun
function createGlow(size, color, opacity) {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  const grd = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, `rgba(255,220,150,${opacity})`);
  grd.addColorStop(1, "rgba(255,220,150,0)");
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  const spriteMat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.scale.set(size, size, 1);
  return sprite;
}
const glow = createGlow(45, 0xffcc55, 0.9);
sun.add(glow);

// Fresnel-style atmosphere rim glow: a slightly larger back-facing sphere
// that brightens toward the silhouette edge, additively blended. Cheap
// (no extra light sources or shadow work) and reads as a soft atmospheric
// halo on planets with real atmospheres.
function createAtmosphere(radius, color) {
  const geo = new THREE.SphereGeometry(radius * 1.12, 48, 48);
  const mat = new THREE.ShaderMaterial({
    uniforms: { glowColor: { value: new THREE.Color(color) } },
    vertexShader: `
      varying vec3 vNormal;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vNormal;
      uniform vec3 glowColor;
      void main() {
        float intensity = pow(0.65 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 3.0);
        gl_FragColor = vec4(glowColor, clamp(intensity, 0.0, 1.0) * 0.55);
      }
    `,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  });
  return new THREE.Mesh(geo, mat);
}

// ---------- planet data ----------
// distance/size are visually scaled (NOT to real astronomical scale) so the scene reads well.
const planetData = [
  { name: "Mercury", radius: 0.6, distance: 14, speed: 4.15, color: 0x9b9b9b, tilt: 0.03,
    roughness: 0.95, metalness: 0.04, bumpScale: 0.045,
    meta: { "Order": "1st from Sun", "Day length": "59 Earth days", "Year length": "88 Earth days" },
    info: "The smallest and fastest planet, Mercury is a cratered, airless rock baked by the Sun and scarred by extreme temperature swings between day and night." },
  { name: "Venus",   radius: 1.0, distance: 19, speed: 1.62, color: 0xe6c58c, tilt: 177.4,
    roughness: 0.9, metalness: 0.0, bumpScale: 0.012, atmosphere: 0xf3dfa8,
    meta: { "Order": "2nd from Sun", "Day length": "243 Earth days", "Year length": "225 Earth days" },
    info: "Venus is the hottest planet in the solar system thanks to a runaway greenhouse effect, hidden beneath thick clouds of sulfuric acid. It spins backwards compared to most planets." },
  { name: "Earth",   radius: 1.1, distance: 25, speed: 1.0,  color: 0x3a86ff, tilt: 23.4, hasMoon: true, hasISS: true,
    roughness: 0.75, metalness: 0.08, bumpScale: 0.02, atmosphere: 0x6ab7ff,
    meta: { "Order": "3rd from Sun", "Day length": "24 hours", "Year length": "365.25 days" },
    info: "Our home. The only known planet with liquid water on its surface and life, protected by a magnetic field and orbited by one large moon." },
  { name: "Mars",    radius: 0.7, distance: 31, speed: 0.53, color: 0xd1543e, tilt: 25.2,
    roughness: 0.96, metalness: 0.02, bumpScale: 0.035,
    meta: { "Order": "4th from Sun", "Day length": "24.6 hours", "Year length": "687 Earth days" },
    info: "The Red Planet, colored by iron oxide dust. Home to the largest volcano and canyon in the solar system, and a major target for future human exploration.",
    moons: [
      { name: "Phobos", radius: 0.05, distance: 1.1, speed: 5.5, hue: 25, sat: 10, baseLight: 38, craterCount: 40,
        meta: { "Diameter": "~22 km", "Orbital period": "7h 39m", "Discovered": "1877" },
        info: "Phobos is the larger and inner of Mars's two moons, a heavily cratered, potato-shaped rock orbiting so close it will eventually break apart or crash into Mars." },
      { name: "Deimos", radius: 0.035, distance: 1.6, speed: 3.2, hue: 25, sat: 8, baseLight: 42, craterCount: 25,
        meta: { "Diameter": "~12 km", "Orbital period": "30h 18m", "Discovered": "1877" },
        info: "Deimos is the smaller, outer moon of Mars, a smooth, dusty fragment thought to be a captured asteroid." },
    ] },
  { name: "Jupiter", radius: 3.4, distance: 42, speed: 0.084, color: 0xd8ba8a, tilt: 3.1,
    roughness: 0.95, metalness: 0.0, bumpScale: 0.015,
    meta: { "Order": "5th from Sun", "Day length": "10 hours", "Year length": "12 Earth years" },
    info: "The largest planet in the solar system, a gas giant with a Great Red Spot storm bigger than Earth and dozens of moons, including four large Galilean moons.",
    moons: [
      { name: "Io", radius: 0.32, distance: 5.5, speed: 2.6, hue: 48, sat: 55, baseLight: 60, craterCount: 12,
        meta: { "Diameter": "3,643 km", "Orbital period": "1.8 days" },
        info: "Io is the most volcanically active body in the solar system, its surface coated in sulfur compounds that give it a yellow-orange hue." },
      { name: "Europa", radius: 0.28, distance: 6.8, speed: 1.85, hue: 200, sat: 15, baseLight: 75, craterCount: 8,
        meta: { "Diameter": "3,122 km", "Orbital period": "3.6 days" },
        info: "Europa is an icy moon with a smooth, cracked surface hiding a vast subsurface ocean, making it a top target in the search for life beyond Earth." },
      { name: "Ganymede", radius: 0.4, distance: 8.4, speed: 1.15, hue: 35, sat: 15, baseLight: 50, craterCount: 30,
        meta: { "Diameter": "5,268 km", "Orbital period": "7.2 days" },
        info: "Ganymede is the largest moon in the solar system, bigger than the planet Mercury, with a mix of ancient cratered terrain and grooved icy ridges." },
      { name: "Callisto", radius: 0.38, distance: 10.2, speed: 0.75, hue: 30, sat: 10, baseLight: 35, craterCount: 55,
        meta: { "Diameter": "4,821 km", "Orbital period": "16.7 days" },
        info: "Callisto is one of the most heavily cratered objects in the solar system, an ancient icy-rock world largely unchanged for billions of years." },
    ] },
  { name: "Saturn",  radius: 2.9, distance: 55, speed: 0.034, color: 0xe6d2a3, tilt: 26.7, hasRing: true,
    roughness: 0.9, metalness: 0.0, bumpScale: 0.015,
    meta: { "Order": "6th from Sun", "Day length": "10.7 hours", "Year length": "29 Earth years" },
    info: "Famous for its spectacular ring system made of ice and rock particles. Saturn is the least dense planet — it would float in water.",
    moons: [
      { name: "Mimas", radius: 0.12, distance: 8.2, speed: 2.3, hue: 0, sat: 0, baseLight: 55, craterCount: 20,
        meta: { "Diameter": "396 km", "Orbital period": "0.9 days" },
        info: "Mimas is a small icy moon dominated by a giant impact crater that gives it a distinctive Death Star-like appearance." },
      { name: "Enceladus", radius: 0.14, distance: 9.2, speed: 1.9, hue: 200, sat: 10, baseLight: 85, craterCount: 10,
        meta: { "Diameter": "504 km", "Orbital period": "1.4 days" },
        info: "Enceladus is a bright, icy moon that vents geysers of water vapor from its south pole, suggesting a subsurface ocean beneath its shell." },
      { name: "Tethys", radius: 0.17, distance: 10.3, speed: 1.5, hue: 0, sat: 0, baseLight: 65, craterCount: 25,
        meta: { "Diameter": "1,062 km", "Orbital period": "1.9 days" },
        info: "Tethys is an icy moon marked by a giant canyon, Ithaca Chasma, that stretches most of the way around it." },
      { name: "Dione", radius: 0.18, distance: 11.4, speed: 1.2, hue: 0, sat: 0, baseLight: 55, craterCount: 30,
        meta: { "Diameter": "1,123 km", "Orbital period": "2.7 days" },
        info: "Dione is an icy moon with bright, wispy cliffs of ice streaking across its trailing hemisphere." },
      { name: "Rhea", radius: 0.2, distance: 12.8, speed: 0.95, hue: 0, sat: 0, baseLight: 50, craterCount: 35,
        meta: { "Diameter": "1,527 km", "Orbital period": "4.5 days" },
        info: "Rhea is Saturn's second-largest moon, a heavily cratered ball of ice and rock." },
      { name: "Titan", radius: 0.45, distance: 16, speed: 0.5, hue: 35, sat: 45, baseLight: 55, craterCount: 5,
        meta: { "Diameter": "5,150 km", "Orbital period": "16 days" },
        info: "Titan is Saturn's largest moon and the only moon in the solar system with a thick atmosphere, complete with lakes and rivers of liquid methane." },
      { name: "Iapetus", radius: 0.2, distance: 19.5, speed: 0.27, hue: 30, sat: 15, baseLight: 45, craterCount: 30,
        meta: { "Diameter": "1,469 km", "Orbital period": "79 days" },
        info: "Iapetus is a strikingly two-toned moon, dramatically darker on its leading hemisphere than its trailing one." },
    ] },
  { name: "Uranus",  radius: 1.9, distance: 66, speed: 0.012, color: 0x9fe3e8, tilt: 97.8,
    roughness: 0.6, metalness: 0.12, bumpScale: 0.01, atmosphere: 0x9fe3e8,
    meta: { "Order": "7th from Sun", "Day length": "17 hours", "Year length": "84 Earth years" },
    info: "An ice giant that rotates almost completely on its side. Its pale blue-green color comes from methane in its atmosphere.",
    moons: [
      { name: "Miranda", radius: 0.09, distance: 3.3, speed: 2.2, hue: 220, sat: 10, baseLight: 55, craterCount: 20,
        meta: { "Diameter": "472 km", "Orbital period": "1.4 days" },
        info: "Miranda has some of the tallest cliffs in the solar system and a jumbled, patchwork surface suggesting a violent past." },
      { name: "Ariel", radius: 0.14, distance: 4.1, speed: 1.7, hue: 220, sat: 8, baseLight: 60, craterCount: 15,
        meta: { "Diameter": "1,158 km", "Orbital period": "2.5 days" },
        info: "Ariel is the brightest of Uranus's major moons, with a surface of ice-carved canyons and relatively few large craters." },
      { name: "Umbriel", radius: 0.14, distance: 4.9, speed: 1.35, hue: 220, sat: 5, baseLight: 32, craterCount: 30,
        meta: { "Diameter": "1,169 km", "Orbital period": "4.1 days" },
        info: "Umbriel is the darkest of Uranus's major moons, an ancient, heavily cratered world." },
      { name: "Titania", radius: 0.19, distance: 5.9, speed: 1.0, hue: 220, sat: 8, baseLight: 50, craterCount: 25,
        meta: { "Diameter": "1,578 km", "Orbital period": "8.7 days" },
        info: "Titania is the largest moon of Uranus, scarred by canyons that suggest a geologically active past." },
      { name: "Oberon", radius: 0.18, distance: 6.9, speed: 0.8, hue: 220, sat: 8, baseLight: 40, craterCount: 35,
        meta: { "Diameter": "1,523 km", "Orbital period": "13.5 days" },
        info: "Oberon is the outermost major moon of Uranus, an old, heavily cratered surface with a few mysterious dark patches." },
    ] },
  { name: "Neptune", radius: 1.85, distance: 76, speed: 0.006, color: 0x4f6fe0, tilt: 28.3,
    roughness: 0.55, metalness: 0.14, bumpScale: 0.01, atmosphere: 0x4f6fe0,
    meta: { "Order": "8th from Sun", "Day length": "16 hours", "Year length": "165 Earth years" },
    info: "The windiest planet, with storms reaching supersonic speeds. Neptune is the most distant known major planet, a deep blue ice giant.",
    moons: [
      { name: "Triton", radius: 0.3, distance: 4.3, speed: -1.1, hue: 350, sat: 15, baseLight: 65, craterCount: 8,
        meta: { "Diameter": "2,707 km", "Orbital period": "5.9 days (retrograde)" },
        info: "Triton is Neptune's largest moon and orbits backwards compared to Neptune's rotation, evidence that it's a captured world from the Kuiper Belt." },
    ] },
  { name: "Pluto", radius: 0.55, distance: 88, speed: 0.004, color: 0xd9c7a1, tilt: 122.5,
    roughness: 0.94, metalness: 0.02, bumpScale: 0.03,
    meta: { "Order": "Dwarf planet, Kuiper Belt", "Day length": "6.4 Earth days", "Year length": "248 Earth years" },
    info: "Pluto is the best-known dwarf planet, a small icy-rocky world in the Kuiper Belt with a heart-shaped nitrogen-ice plain called Tombaugh Regio. Reclassified from a planet to a dwarf planet in 2006.",
    moons: [
      { name: "Charon", radius: 0.26, distance: 1.3, speed: 1.6, hue: 220, sat: 5, baseLight: 50, craterCount: 20,
        meta: { "Diameter": "1,212 km", "Orbital period": "6.4 days" },
        info: "Charon is Pluto's largest moon, so big relative to Pluto that the two are tidally locked to each other and sometimes called a double dwarf-planet system." },
    ] },
];

const sunInfo = {
  meta: { "Type": "G-type star", "Age": "~4.6 billion years", "Surface temp": "~5,500°C" },
  info: "The Sun is the star at the center of our solar system, containing 99.8% of the system's mass. Nuclear fusion in its core powers all life on Earth.",
};

const ISS_INFO = {
  meta: { "Orbit": "Low Earth Orbit", "Inclination": "51.6°", "Orbital period": "~92 minutes" },
  info: "The International Space Station is a crewed research outpost orbiting Earth roughly every 92 minutes. It's a joint project of NASA, Roscosmos, ESA, JAXA and CSA. Live position, altitude and speed below come from a real-time satellite-tracking API.",
};

const ORBIT_SPEED_SCALE = 0.2; // base multiplier so motion is visible but not too fast (halved for a calmer default pace)
const SELF_SPIN_SCALE = 0.6;
const ISS_ORBIT_SPEED = 3; // stylized orbit so it's satisfying to watch — not real-time (real period is ~92 min), slowed from its original stylized pace

const planets = []; // { mesh, pivot, data, angle }
const orbitLines = [];
const allMoonMeshes = []; // every non-Earth major-moon mesh, collected for raycasting/click support

function createOrbitRing(distance) {
  const segments = 128;
  const points = [];
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    points.push(new THREE.Vector3(Math.cos(theta) * distance, 0, Math.sin(theta) * distance));
  }
  const geo = new THREE.BufferGeometry().setFromPoints(points);
  const mat = new THREE.LineBasicMaterial({ color: 0x555577, transparent: true, opacity: 0.4 });
  const line = new THREE.LineLoop(geo, mat);
  scene.add(line);
  return line;
}

function createPlanet(data) {
  const pivot = new THREE.Object3D();
  pivot.rotation.y = Math.random() * Math.PI * 2; // random starting angle
  scene.add(pivot);

  const geo = new THREE.SphereGeometry(data.radius, 48, 48);
  const bumpFactory = PLANET_BUMP_FACTORIES[data.name];
  const mat = new THREE.MeshStandardMaterial({
    map: getTexture(data.name, PLANET_TEXTURE_FACTORIES[data.name]),
    roughness: data.roughness ?? 0.85,
    metalness: data.metalness ?? 0.05,
    ...(bumpFactory && {
      bumpMap: getTexture(data.name + "Bump", bumpFactory),
      bumpScale: data.bumpScale ?? 0.02,
    }),
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(data.distance, 0, 0);
  mesh.rotation.z = THREE.MathUtils.degToRad(data.tilt);
  mesh.name = data.name;
  pivot.add(mesh);

  if (REAL_TEXTURE_URLS[data.name]) {
    loadRealTexture(REAL_TEXTURE_URLS[data.name], (tex) => {
      mat.map = tex;
      mat.needsUpdate = true;
    });
  }

  if (data.atmosphere) {
    const atmosphere = createAtmosphere(data.radius, data.atmosphere);
    mesh.add(atmosphere);
    data._atmosphereMesh = atmosphere;
  }

  // Saturn's ring
  if (data.hasRing) {
    const ringInnerR = data.radius * 1.5;
    const ringOuterR = data.radius * 2.6;
    const ringGeo = new THREE.RingGeometry(ringInnerR, ringOuterR, 64);
    // Map radial distance continuously to U (0 = inner edge, 1 = outer edge)
    // so a radial ring texture — procedural or real — reads as a smooth
    // gradient across the ring instead of two flat bands.
    const pos = ringGeo.attributes.position;
    const v3 = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v3.fromBufferAttribute(pos, i);
      const u = THREE.MathUtils.clamp((v3.length() - ringInnerR) / (ringOuterR - ringInnerR), 0, 1);
      ringGeo.attributes.uv.setXY(i, u, 1);
    }
    const ringMat = new THREE.MeshStandardMaterial({
      map: getTexture("SaturnRing", () => ringTexture(1024, 16, 44, 25, 68)),
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
      roughness: 1,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2.2;
    mesh.add(ring);
    data._ringMesh = ring;

    loadRealTexture(REAL_TEXTURE_URLS.SaturnRing, (tex) => {
      tex.wrapS = THREE.ClampToEdgeWrapping; // a radial slice, not meant to repeat
      ringMat.map = tex;
      ringMat.alphaMap = tex; // same grayscale data doubles as per-pixel transparency (ring gaps)
      ringMat.color.set(0xd8c9a0); // warm tan tint, since the source is near-grayscale
      ringMat.needsUpdate = true;
    });
  }

  // Earth's clouds
  if (data.name === "Earth") {
    const cloudGeo = new THREE.SphereGeometry(data.radius * 1.015, 48, 48);
    const cloudMat = new THREE.MeshStandardMaterial({
      map: getTexture("EarthClouds", () => earthCloudsTexture(1024, 512)),
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      roughness: 1,
    });
    const clouds = new THREE.Mesh(cloudGeo, cloudMat);
    mesh.add(clouds);
    data._cloudMesh = clouds;

    loadRealTexture(REAL_TEXTURE_URLS.EarthClouds, (tex) => {
      cloudMat.map = tex;
      cloudMat.needsUpdate = true;
    });
  }

  // Earth's moon
  if (data.hasMoon) {
    const moonPivot = new THREE.Object3D();
    mesh.add(moonPivot);
    const moonGeo = new THREE.SphereGeometry(0.28, 16, 16);
    const moonMat = new THREE.MeshStandardMaterial({
      map: getTexture("Moon", PLANET_TEXTURE_FACTORIES.Moon),
      roughness: 0.9,
    });
    const moon = new THREE.Mesh(moonGeo, moonMat);
    moon.position.set(2, 0, 0);
    moonPivot.add(moon);
    data._moonPivot = moonPivot;
    data._moonMesh = moon;
    data._moonBaseColor = moon.material.color.clone();

    loadRealTexture(REAL_TEXTURE_URLS.Moon, (tex) => {
      moonMat.map = tex;
      moonMat.needsUpdate = true;
    });
  }

  // Major moons for planets other than Earth (Mars, Jupiter, Saturn, Uranus,
  // Neptune). Attached to `pivot` (the planet's sun-orbit pivot), NOT `mesh`
  // (which spins for day/night) — same reasoning as the ISS below: this
  // keeps each moon's orbital plane from being dragged around by the
  // planet's own axial spin. A shared sub-pivot is positioned at the
  // planet's location within `pivot`, and every moon gets its own child
  // pivot so each can orbit at its own speed.
  if (data.moons && data.moons.length) {
    const moonSystemPivot = new THREE.Object3D();
    moonSystemPivot.position.copy(mesh.position);
    pivot.add(moonSystemPivot);

    data._moons = data.moons.map((m) => {
      const moonPivot = new THREE.Object3D();
      moonPivot.rotation.y = Math.random() * Math.PI * 2; // random starting phase
      moonSystemPivot.add(moonPivot);

      const moonGeo = new THREE.SphereGeometry(m.radius, 24, 24);
      const texKey = `${data.name}_${m.name}`;
      const moonMat = new THREE.MeshStandardMaterial({
        map: getTexture(texKey, () => crateredPlanet(256, 128, m.hue, m.sat, m.baseLight, m.craterCount ?? 25, false)),
        roughness: 0.92,
        metalness: 0.02,
      });
      const moonMesh = new THREE.Mesh(moonGeo, moonMat);
      moonMesh.name = m.name;
      moonMesh.position.set(m.distance, 0, 0);
      moonMesh.userData.info = { name: m.name, meta: m.meta || {}, info: m.info || "" };
      moonPivot.add(moonMesh);

      // faint orbit path, same style as the planet orbit rings
      const segs = 64;
      const pts = [];
      for (let i = 0; i <= segs; i++) {
        const theta = (i / segs) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(theta) * m.distance, 0, Math.sin(theta) * m.distance));
      }
      const moonOrbitLine = new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({ color: 0x666688, transparent: true, opacity: 0.25 })
      );
      moonPivot.add(moonOrbitLine);

      allMoonMeshes.push(moonMesh);

      return { mesh: moonMesh, pivot: moonPivot, speed: m.speed, orbitLine: moonOrbitLine };
    });
  }

  // International Space Station — low Earth orbit.
  // Attached to `pivot` (Earth's sun-orbit pivot), NOT `mesh` (which spins
  // for day/night), so Earth's fast axial spin doesn't drag the ISS's
  // inclined orbital plane around with it.
  if (data.hasISS) {
    const issOrbitRadius = data.radius * 1.7; // just outside the cloud layer
    const issPivot = new THREE.Object3D();
    issPivot.position.copy(mesh.position);
    issPivot.rotation.x = THREE.MathUtils.degToRad(51.6); // real ISS orbital inclination
    issPivot.rotation.y = Math.random() * Math.PI * 2;
    pivot.add(issPivot);

    const issGroup = createISSModel();
    issGroup.position.set(issOrbitRadius, 0, 0);
    issGroup.name = "ISS";
    issPivot.add(issGroup);

    // Invisible slightly-larger sphere: gives an easy click/hover target and
    // a bounding sphere for focusOnObject (the visual model is a multi-mesh
    // Group, which has neither).
    const issProxy = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 12, 12),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 })
    );
    issProxy.name = "ISS";
    issProxy.position.set(issOrbitRadius, 0, 0);
    issProxy.userData.info = { name: "ISS", ...ISS_INFO };
    issPivot.add(issProxy);

    // faint path so the orbit is visible even before you click it
    const issRingPoints = [];
    const issRingSegments = 64;
    for (let i = 0; i <= issRingSegments; i++) {
      const theta = (i / issRingSegments) * Math.PI * 2;
      issRingPoints.push(new THREE.Vector3(Math.cos(theta) * issOrbitRadius, 0, Math.sin(theta) * issOrbitRadius));
    }
    const issRing = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(issRingPoints),
      new THREE.LineBasicMaterial({ color: 0x7ad8ff, transparent: true, opacity: 0.35 })
    );
    issPivot.add(issRing);

    data._issPivot = issPivot;
    data._issProxy = issProxy;
  }

  mesh.userData.info = data;

  orbitLines.push(createOrbitRing(data.distance));

  planets.push({ mesh, pivot, data });
}

planetData.forEach(createPlanet);
sun.userData.info = { name: "Sun", ...sunInfo };

// ---------- main asteroid belt (decorative — sits between Mars and Jupiter) ----------
// This is NOT live data, just a dense instanced field for visual realism;
// the live NASA rocks (below) are the near-Earth ones you can click for info.
let asteroidBelt = null;

function createAsteroidBelt() {
  const mars = planetData.find((p) => p.name === "Mars").distance; // 31
  const jupiter = planetData.find((p) => p.name === "Jupiter").distance; // 42
  const innerR = mars + 3;
  const outerR = jupiter - 2;
  const midR = (innerR + outerR) / 2;
  const halfSpan = (outerR - innerR) / 2;
  const count = 2200;

  const geo = new THREE.IcosahedronGeometry(1, 0);
  const mat = new THREE.MeshStandardMaterial({ color: 0x9a8f80, roughness: 1, metalness: 0 });
  const mesh = new THREE.InstancedMesh(geo, mat, count);

  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const r = rand(innerR, outerR);
    const theta = rand(0, Math.PI * 2);
    const thickness = 1.3 * (1 - Math.abs(r - midR) / halfSpan); // thicker mid-belt, thinner at edges
    const y = rand(-thickness, thickness);
    dummy.position.set(Math.cos(theta) * r, y, Math.sin(theta) * r);
    dummy.rotation.set(rand(0, Math.PI), rand(0, Math.PI), rand(0, Math.PI));
    dummy.scale.setScalar(rand(0.05, 0.32));
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    color.setHSL(0.08, 0.12, rand(0.32, 0.55));
    mesh.setColorAt(i, color);
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  scene.add(mesh);
  asteroidBelt = mesh;
}
createAsteroidBelt();

// ---------- raycasting: hover + click ----------
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const tooltip = document.getElementById("tooltip");

const clickableMeshes = [sun, ...planets.map((p) => p.mesh), ...allMoonMeshes];

const earthEntry = planets.find((p) => p.data.name === "Earth");
const issProxyMesh = earthEntry?.data._issProxy || null;
if (issProxyMesh) clickableMeshes.push(issProxyMesh);

let focusedTarget = null; // object to keep camera focused on
let desiredZoomDistance = null; // how close the camera should end up when focused

const infoPanel = document.getElementById("infoPanel");
const infoName = document.getElementById("infoName");
const infoMeta = document.getElementById("infoMeta");
const infoDesc = document.getElementById("infoDesc");
const infoClose = document.getElementById("infoClose");
const infoReset = document.getElementById("infoReset");

function onPointerMove(event) {
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(pointer, camera);
  const intersects = raycaster.intersectObjects(clickableMeshes, false);

  if (intersects.length > 0) {
    const obj = intersects[0].object;
    tooltip.style.display = "block";
    tooltip.style.left = event.clientX + 14 + "px";
    tooltip.style.top = event.clientY + 14 + "px";
    tooltip.textContent = obj.name;
    document.body.style.cursor = "pointer";
  } else {
    tooltip.style.display = "none";
    document.body.style.cursor = "default";
  }
}

const infoCredit = document.getElementById("infoCredit");

function showInfoFor(obj) {
  const data = obj.userData.info;
  infoName.textContent = data.name;
  infoMeta.innerHTML = Object.entries(data.meta)
    .map(([k, v]) => `<span>${k}: ${v}</span>`)
    .join("");
  infoDesc.textContent = data.info;
  infoCredit.textContent = "";
  infoPanel.classList.add("visible");
  speak(`${data.name}. ${data.info}`);

  const factKey = data.name.toLowerCase();
  AmbientAudio.start(factKey);

  if (factKey === "iss") {
    fetchISSLive()
      .then((live) => {
        if (!live || infoName.textContent !== data.name) return;
        const chips = [
          `Altitude: ${formatNumber(live.altitudeKm)} km`,
          `Speed: ${formatNumber(live.velocityKph)} km/h`,
          live.visibility ? `Currently: ${live.visibility === "daylight" ? "in sunlight ☀️" : "in Earth's shadow 🌑"}` : null,
          `Position: ${live.latitude.toFixed(1)}°, ${live.longitude.toFixed(1)}°`,
        ].filter(Boolean);
        infoMeta.insertAdjacentHTML(
          "beforeend",
          `<div class="real-data-row">${chips.map((t) => `<span class="real-data">${t}</span>`).join("")}</div>`
        );
        infoCredit.textContent = "Live tracking: wheretheiss.at (updates every ~12s)";
      })
      .catch(() => {
        infoCredit.textContent = "Live ISS tracking unavailable right now.";
      });
    return;
  }

  if (FACTS_ELIGIBLE.has(factKey)) {
    fetchBodyFacts(factKey).then((facts) => {
      // bail if the panel has since moved on to a different body
      if (!facts || infoName.textContent !== data.name) return;
      const chips = [
        facts.moonCount ? `Moons: ${facts.moonCount}` : null,
        facts.gravity ? `Gravity: ${facts.gravity}` : null,
        facts.orbitalPeriodDays ? `Orbit: ${formatNumber(facts.orbitalPeriodDays)} days` : null,
      ].filter(Boolean);
      if (chips.length) {
        infoMeta.insertAdjacentHTML(
          "beforeend",
          `<div class="real-data-row">${chips.map((t) => `<span class="real-data">${t}</span>`).join("")}</div>`
        );
        infoCredit.textContent = "Verified stats: Solar System OpenData";
      }
    });
  }
}

function focusOnObject(obj) {
  focusedTarget = obj;
  // radius comes from the mesh's geometry bounding sphere
  obj.geometry.computeBoundingSphere();
  const r = obj.geometry.boundingSphere.radius;
  desiredZoomDistance = Math.max(r * 6, r + 4);
  showInfoFor(obj);
}

function clearFocus() {
  focusedTarget = null;
  desiredZoomDistance = null;
  infoPanel.classList.remove("visible");
  infoCredit.textContent = "";
  stopSpeaking();
  AmbientAudio.stop();
}

function onClick(event) {
  raycaster.setFromCamera(pointer, camera);
  const intersects = raycaster.intersectObjects(clickableMeshes, false);
  if (intersects.length > 0) {
    focusOnObject(intersects[0].object);
  }
}

infoClose.addEventListener("click", clearFocus);
infoReset.addEventListener("click", clearFocus);

window.addEventListener("pointermove", onPointerMove);
window.addEventListener("click", onClick);

// ---------- text-to-speech narration ----------
// Speaks two things out loud: (1) every AI Scene Assistant reply, and (2) a
// planet/sun/moon/ISS's description whenever its info panel opens. A single
// floating button (top-right) mutes/unmutes both; muting also stops
// whatever's currently being read.
//
// Two engines, tried in order:
//   1. ElevenLabs (natural AI voice) — only used if ELEVENLABS_API_KEY is set.
//   2. Browser's built-in Web Speech API — free, offline, no key, used as the
//      automatic fallback if ElevenLabs isn't configured OR its call fails
//      (rate limit, network error, bad key, etc.), same pattern as the
//      n8n-webhook → local-parser fallback for the chat agent above.
//
// ⚠️ SECURITY NOTE: unlike the NASA DEMO_KEY, an ElevenLabs key is billed
// per character and this calls its REST API directly from the browser, so
// the key sits in plain text in the shipped JS bundle — anyone can open
// devtools and lift it. That's fine for a personal demo, but before sharing
// this publicly, proxy the call through a backend instead (e.g. add a
// second n8n webhook that holds the key server-side and forwards
// {text} -> audio, mirroring how N8N_WEBHOOK_URL already proxies the chat
// agent). See "Open items" in the context doc.
const ELEVENLABS_API_KEY = ""; // moved server-side — see netlify/functions/tts.js. Empty here falls back to Web Speech.
const ELEVENLABS_VOICE_ID = "cT5LqmY8Y5dz4bRVJKSy"; // "Rachel" — a default premade voice, free-tier API friendly. IMPORTANT: swap only with voice_ids from your dashboard's "My Voices" tab — "Voice Library" (shared/community) voices return a 402 error on the free API tier
const ELEVENLABS_MODEL_ID = "eleven_turbo_v2_5"; // fast + natural; use "eleven_multilingual_v2" if you want non-English narration

const ttsToggleBtn = document.getElementById("ttsToggleBtn");
const ttsSupported = "speechSynthesis" in window;
let ttsMuted = localStorage.getItem("ttsMuted") === "true";

function updateTtsButton() {
  if (!ttsSupported && !ELEVENLABS_API_KEY) {
    ttsToggleBtn.textContent = "🔇";
    ttsToggleBtn.title = "Voice narration isn't supported in this browser";
    ttsToggleBtn.classList.add("muted");
    ttsToggleBtn.disabled = true;
    return;
  }
  ttsToggleBtn.textContent = ttsMuted ? "🔇" : "🔊";
  ttsToggleBtn.title = ttsMuted ? "Unmute narration" : "Mute narration";
  ttsToggleBtn.classList.toggle("muted", ttsMuted);
}
updateTtsButton();

// Caches ElevenLabs audio by exact text, so re-opening the same planet (or
// hitting a repeated chat reply) replays the already-fetched clip instead of
// re-billing/re-fetching it. Cleared on reload — in-memory only, same
// caching philosophy as the ISS tracker's short-lived cache elsewhere in
// this file, just with no TTL since a given line's audio never goes stale.
const ttsAudioCache = new Map(); // text -> object URL
let currentAudio = null;
let speakToken = 0; // bumped on every speak()/mute so a slow in-flight fetch can't play over a newer line

async function fetchElevenLabsAudio(text) {
  if (ttsAudioCache.has(text)) return ttsAudioCache.get(text);
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
      "xi-api-key": ELEVENLABS_API_KEY,
    },
    body: JSON.stringify({
      text,
      model_id: ELEVENLABS_MODEL_ID,
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`ElevenLabs TTS error ${res.status}: ${body}`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  ttsAudioCache.set(text, url);
  return url;
}

function speakWithBrowserVoice(text) {
  if (!ttsSupported) return;
  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = 1;
  utter.pitch = 1;
  utter.onstart = () => {
    ttsToggleBtn.classList.add("speaking");
    AmbientAudio.duck(true);
  };
  utter.onend = () => {
    ttsToggleBtn.classList.remove("speaking");
    AmbientAudio.duck(false);
  };
  utter.onerror = () => {
    ttsToggleBtn.classList.remove("speaking");
    AmbientAudio.duck(false);
  };
  window.speechSynthesis.speak(utter);
}

async function speak(text) {
  if (!text) return;
  const token = ++speakToken;
  stopSpeaking(); // don't let lines overlap — new speech interrupts whatever was playing
  if (ttsMuted) return;

  if (ELEVENLABS_API_KEY) {
    ttsToggleBtn.classList.add("loading");
    try {
      const url = await fetchElevenLabsAudio(text);
      ttsToggleBtn.classList.remove("loading");
      // a newer speak() call (or a mute) happened while this fetch was in flight — drop this stale result
      if (token !== speakToken || ttsMuted) return;
      currentAudio = new Audio(url);
      currentAudio.onplay = () => {
        ttsToggleBtn.classList.add("speaking");
        AmbientAudio.duck(true);
      };
      currentAudio.onended = () => {
        ttsToggleBtn.classList.remove("speaking");
        AmbientAudio.duck(false);
      };
      currentAudio.onerror = () => {
        ttsToggleBtn.classList.remove("speaking");
        AmbientAudio.duck(false);
      };
      currentAudio.play();
      return;
    } catch (err) {
      ttsToggleBtn.classList.remove("loading");
      if (token !== speakToken) return;
      console.error("ElevenLabs TTS failed, falling back to browser voice:", err);
      // falls through to the browser voice below
    }
  }

  speakWithBrowserVoice(text);
}

function stopSpeaking() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  if (ttsSupported) window.speechSynthesis.cancel();
  ttsToggleBtn.classList.remove("speaking");
  ttsToggleBtn.classList.remove("loading");
  AmbientAudio.duck(false);
}

if (ttsSupported || ELEVENLABS_API_KEY) {
  ttsToggleBtn.addEventListener("click", () => {
    ttsMuted = !ttsMuted;
    localStorage.setItem("ttsMuted", String(ttsMuted));
    updateTtsButton();
    if (ttsMuted) {
      speakToken++; // invalidate any in-flight ElevenLabs fetch too
      stopSpeaking();
    }
  });
}

// ---------- procedural per-planet ambient soundscape (Web Audio API — no external audio files) ----------
// NOTE: these are stylized/artistic soundscapes, not real recordings — most of these bodies
// have no atmosphere for sound to travel through at all (the Moon, Mercury, the vacuum around
// the ISS), so "what a planet sounds like" is inherently a creative liberty, same spirit as the
// sim's other dramatized-for-engagement choices (stylized-fast ISS orbit, more-frequent-than-real
// eclipses). Each body gets a hand-tuned "profile": filtered noise (its texture) plus an optional
// low drone with slow pitch wobble (its "voice"). Swapping in real NASA plasma-wave recordings
// (Voyager/Cassini/Juno "sounds of the planets") instead of this synth is a valid future upgrade —
// see the context doc's Open items for the licensing/hosting tradeoffs that would involve.
const AmbientAudio = (() => {
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

const ambientToggleBtn = document.getElementById("ambientToggleBtn");
const ambientVolume = 0.6; // fixed master level; narration ducks it further via AmbientAudio.duck()
let ambientMuted = localStorage.getItem("ambientMuted") === "true";

function updateAmbientButton() {
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
  if (!ambientMuted && focusedTarget?.userData?.info) {
    AmbientAudio.start(focusedTarget.userData.info.name.toLowerCase());
  }
});

// NASA_API_KEY is used below by the Astronomy Picture of the Day (APOD) feature.
const NASA_API_KEY = "";

function formatNumber(n) {
  return Math.round(n).toLocaleString();
}

// ---------- real astronomical facts (Solar System OpenData API, no key needed) ----------
// Used two ways: (1) layered onto the info panel as verified numbers, and
// (2) sent to the n8n agent as grounding data so it answers with real figures
// instead of the LLM guessing when a planet is focused.
const SSOD_CACHE_KEY = "solar-system-body-facts-v1";
const SSOD_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // this data barely changes — cache a full day
const FACTS_ELIGIBLE = new Set(["mercury", "venus", "earth", "mars", "jupiter", "saturn", "uranus", "neptune", "sun", "moon"]);
let bodyFactsCache = {};

(function loadFactsCache() {
  try {
    const raw = localStorage.getItem(SSOD_CACHE_KEY);
    if (!raw) return;
    const { timestamp, facts } = JSON.parse(raw);
    if (Date.now() - timestamp <= SSOD_CACHE_TTL_MS) bodyFactsCache = facts || {};
  } catch {
    // corrupted/unavailable cache — start fresh, no big deal
  }
})();

function saveFactsCache() {
  try {
    localStorage.setItem(SSOD_CACHE_KEY, JSON.stringify({ timestamp: Date.now(), facts: bodyFactsCache }));
  } catch {
    // storage full/disabled — fine, it's only a cache
  }
}

function formatBodyFacts(raw) {
  if (!raw) return null;
  return {
    name: raw.englishName || raw.name,
    massText: raw.mass ? `${raw.mass.massValue}×10^${raw.mass.massExponent} kg` : null,
    gravity: typeof raw.gravity === "number" ? `${raw.gravity} m/s²` : null,
    meanRadiusKm: raw.meanRadius || null,
    moonCount: Array.isArray(raw.moons) ? raw.moons.length : 0,
    orbitalPeriodDays: raw.sideralOrbit || null,
    rotationHours: raw.sideralRotation || null,
    discoveredBy: raw.discoveredBy || null,
    avgTempK: raw.avgTemp || null,
  };
}

async function fetchBodyFacts(name) {
  const key = name.toLowerCase();
  if (!FACTS_ELIGIBLE.has(key)) return null;
  if (bodyFactsCache[key]) return bodyFactsCache[key];
  try {
    const res = await fetch(`https://api.le-systeme-solaire.net/rest/bodies/${key}`);
    if (!res.ok) throw new Error("Solar System OpenData error " + res.status);
    const raw = await res.json();
    const facts = formatBodyFacts(raw);
    bodyFactsCache[key] = facts;
    saveFactsCache();
    return facts;
  } catch {
    return null; // fine — the app just skips the real-data chips for this body
  }
}

// ---------- ISS live position (wheretheiss.at API — no key, CORS-enabled) ----------
// The ISS moves fast enough that a long localStorage cache would go stale
// within seconds, so this just uses a short in-memory cache to avoid
// hammering the API on rapid re-focus/re-open, not a persistent one.
const ISS_API_URL = "https://api.wheretheiss.at/v1/satellites/25544";
const ISS_LIVE_TTL_MS = 12 * 1000;
let issLiveCache = null;
let issLiveCachedAt = 0;

async function fetchISSLive() {
  if (issLiveCache && Date.now() - issLiveCachedAt < ISS_LIVE_TTL_MS) return issLiveCache;
  const res = await fetch(ISS_API_URL);
  if (!res.ok) throw new Error("ISS tracking API error " + res.status);
  const data = await res.json();
  issLiveCache = {
    latitude: data.latitude,
    longitude: data.longitude,
    altitudeKm: data.altitude,
    velocityKph: data.velocity,
    visibility: data.visibility,
  };
  issLiveCachedAt = Date.now();
  return issLiveCache;
}

// ---------- NASA Astronomy Picture of the Day ----------
const APOD_CACHE_KEY = "solar-system-apod-cache-v1";
const APOD_CACHE_TTL_MS = 12 * 60 * 60 * 1000; // APOD only changes once a day — half a day is a safe cache window
const apodModal = document.getElementById("apodModal");
const apodBody = document.getElementById("apodBody");
const apodBtn = document.getElementById("apodBtn");
const apodClose = document.getElementById("apodClose");
const apodBackdrop = document.getElementById("apodBackdrop");

function readApodCache() {
  try {
    const raw = localStorage.getItem(APOD_CACHE_KEY);
    if (!raw) return null;
    const { timestamp, apod } = JSON.parse(raw);
    if (Date.now() - timestamp > APOD_CACHE_TTL_MS) return null;
    return apod;
  } catch {
    return null;
  }
}

function writeApodCache(apod) {
  try {
    localStorage.setItem(APOD_CACHE_KEY, JSON.stringify({ timestamp: Date.now(), apod }));
  } catch {
    // ignore — cache is a nicety, not a requirement
  }
}

async function fetchApod() {
  const cached = readApodCache();
  if (cached) return cached;
  const res = await fetch(`https://api.nasa.gov/planetary/apod?api_key=${NASA_API_KEY}`);
  if (!res.ok) throw new Error("APOD error " + res.status);
  const apod = await res.json();
  writeApodCache(apod);
  return apod;
}

function renderApod(apod) {
  const isImage = apod.media_type === "image";
  const media = isImage
    ? `<img src="${apod.url}" alt="${apod.title}" />`
    : `<p><a href="${apod.url}" target="_blank" rel="noopener">Today's picture is a video — view it on NASA's site ↗</a></p>`;
  apodBody.innerHTML = `
    ${media}
    <h3>${apod.title}</h3>
    <div class="apod-date">${apod.date}</div>
    <p>${apod.explanation}</p>
    <div class="apod-credit">${apod.copyright ? `© ${apod.copyright} · ` : ""}Source: NASA APOD</div>
  `;
}

function openApodModal() {
  apodModal.classList.add("visible");
  apodBody.textContent = "Loading today's picture…";
  fetchApod()
    .then(renderApod)
    .catch(() => {
      apodBody.textContent = "Couldn't load today's picture right now — try again in a bit.";
    });
}

function closeApodModal() {
  apodModal.classList.remove("visible");
}

apodBtn?.addEventListener("click", openApodModal);
apodClose?.addEventListener("click", closeApodModal);
apodBackdrop?.addEventListener("click", closeApodModal);
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeApodModal();
});

// ---------- Spaceflight News ticker ----------
const NEWS_CACHE_KEY = "solar-system-news-cache-v1";
const NEWS_CACHE_TTL_MS = 30 * 60 * 1000; // news moves fast — refresh every 30 min
const newsTickerTrack = document.getElementById("newsTickerTrack");

function readNewsCache() {
  try {
    const raw = localStorage.getItem(NEWS_CACHE_KEY);
    if (!raw) return null;
    const { timestamp, articles } = JSON.parse(raw);
    if (Date.now() - timestamp > NEWS_CACHE_TTL_MS) return null;
    return articles;
  } catch {
    return null;
  }
}

function writeNewsCache(articles) {
  try {
    localStorage.setItem(NEWS_CACHE_KEY, JSON.stringify({ timestamp: Date.now(), articles }));
  } catch {
    // ignore
  }
}

async function fetchSpaceNews() {
  const cached = readNewsCache();
  if (cached) return cached;
  const res = await fetch("https://api.spaceflightnewsapi.net/v4/articles/?limit=8&ordering=-published_at");
  if (!res.ok) throw new Error("Spaceflight News error " + res.status);
  const data = await res.json();
  const articles = (data.results || []).map((a) => ({ title: a.title, url: a.url, site: a.news_site }));
  writeNewsCache(articles);
  return articles;
}

async function loadNewsTicker() {
  try {
    const articles = await fetchSpaceNews();
    if (!articles.length) throw new Error("No articles");
    const itemsHtml = articles
      .map(
        (a) =>
          `<a href="${a.url}" target="_blank" rel="noopener">${a.title} <span style="opacity:0.5">— ${a.site}</span></a>`
      )
      .join('<span class="ticker-sep">•</span>');
    // duplicate the sequence so the CSS marquee (translateX 0 → -50%) loops seamlessly
    newsTickerTrack.innerHTML = `${itemsHtml}<span class="ticker-sep">•</span>${itemsHtml}<span class="ticker-sep">•</span>`;
  } catch {
    newsTickerTrack.innerHTML = `<span id="newsTickerStatus">Space news unavailable right now.</span>`;
  }
}

loadNewsTicker();

// ---------- UI controls ----------
let speedMultiplier = 1;
let paused = false;
let orbitLinesVisible = true;

const speedSlider = document.getElementById("speed");
const speedVal = document.getElementById("speedVal");
speedSlider.addEventListener("input", () => {
  speedMultiplier = parseFloat(speedSlider.value);
  speedVal.textContent = speedMultiplier.toFixed(1) + "x";
});

const pauseBtn = document.getElementById("pauseBtn");
pauseBtn.addEventListener("click", () => {
  paused = !paused;
  pauseBtn.textContent = paused ? "Resume" : "Pause";
});

const orbitBtn = document.getElementById("orbitBtn");
orbitBtn.addEventListener("click", () => {
  orbitLinesVisible = !orbitLinesVisible;
  orbitLines.forEach((l) => (l.visible = orbitLinesVisible));
});

const moonsBtn = document.getElementById("moonsBtn");
let moonsVisible = true;
moonsBtn?.addEventListener("click", () => {
  moonsVisible = !moonsVisible;
  sceneRegistry.moons.setVisible(moonsVisible);
});

const constellationBtn = document.getElementById("constellationBtn");
let constellationsVisible = true;
constellationBtn?.addEventListener("click", () => {
  constellationsVisible = !constellationsVisible;
  sceneRegistry.constellations.setVisible(constellationsVisible);
});

const issBtn = document.getElementById("issBtn");
issBtn?.addEventListener("click", () => {
  if (!issProxyMesh) return;
  sceneRegistry.earth?.setVisible(true);
  sceneRegistry.iss?.setVisible(true);
  focusOnObject(issProxyMesh);
});

// ---------- AI scene-control agent ----------
// A local natural-language command interpreter that decides what to show/hide
// in the scene. It's not a hosted-LLM call (a static downloadable file has
// nowhere safe to keep an API key) — it's a rule-based parser that handles a
// wide range of phrasing. To upgrade it to a real LLM: replace the body of
// interpretCommand() with an `await fetch('/your-backend/agent', ...)` call
// to a server you control that holds the API key, and have that backend
// return the same { reply, actions } shape this function returns locally.

const PLANET_NAMES = planets.map((p) => p.data.name.toLowerCase());
const INNER_PLANETS = ["mercury", "venus", "earth", "mars"];
const OUTER_PLANETS = ["jupiter", "saturn", "uranus", "neptune"];

// name -> { setVisible(bool) }
const sceneRegistry = {};
planets.forEach(({ mesh, pivot, data }, i) => {
  const orbitLine = orbitLines[i];
  sceneRegistry[data.name.toLowerCase()] = {
    setVisible(v) {
      pivot.visible = v;
      orbitLine.visible = v && orbitLinesVisible;
    },
    isVisible() {
      return pivot.visible;
    },
  };
});
sceneRegistry["sun"] = {
  setVisible(v) {
    sun.visible = v;
  },
  isVisible() {
    return sun.visible;
  },
};
sceneRegistry["moon"] = {
  setVisible(v) {
    const earth = planets.find((p) => p.data.name === "Earth");
    if (earth?.data._moonPivot) earth.data._moonPivot.visible = v;
  },
  isVisible() {
    const earth = planets.find((p) => p.data.name === "Earth");
    return earth?.data._moonPivot?.visible ?? true;
  },
};

// Every major moon added for Mars/Jupiter/Saturn/Uranus/Neptune, registered
// individually by name (e.g. "titan", "europa") so the scene assistant can
// show/hide/target them just like a planet.
const MOON_NAMES = [];
planets.forEach(({ data }) => {
  if (!data._moons) return;
  data._moons.forEach((m) => {
    const key = m.mesh.name.toLowerCase();
    MOON_NAMES.push(key);
    sceneRegistry[key] = {
      setVisible(v) {
        m.pivot.visible = v;
        m.orbitLine.visible = v;
      },
      isVisible() {
        return m.pivot.visible;
      },
    };
  });
});
// "moons" as a group toggles every moon at once — Earth's Moon plus all majors above.
sceneRegistry["moons"] = {
  setVisible(v) {
    sceneRegistry.moon.setVisible(v);
    MOON_NAMES.forEach((n) => sceneRegistry[n].setVisible(v));
  },
  isVisible() {
    return sceneRegistry.moon.isVisible();
  },
};
sceneRegistry["iss"] = {
  setVisible(v) {
    const earth = planets.find((p) => p.data.name === "Earth");
    if (earth?.data._issPivot) earth.data._issPivot.visible = v;
  },
  isVisible() {
    const earth = planets.find((p) => p.data.name === "Earth");
    return earth?.data._issPivot?.visible ?? true;
  },
};
sceneRegistry["rings"] = {
  setVisible(v) {
    const saturn = planets.find((p) => p.data.name === "Saturn");
    if (saturn?.data._ringMesh) saturn.data._ringMesh.visible = v;
  },
  isVisible() {
    const saturn = planets.find((p) => p.data.name === "Saturn");
    return saturn?.data._ringMesh?.visible ?? true;
  },
};
sceneRegistry["belt"] = {
  setVisible(v) {
    if (asteroidBelt) asteroidBelt.visible = v;
  },
  isVisible() {
    return asteroidBelt ? asteroidBelt.visible : true;
  },
};
// "asteroids" kept as an alias to the decorative belt so existing scene-assistant
// phrasing ("hide asteroids", "show asteroids") still works now that the live
// NASA near-Earth-object feature has been removed.
sceneRegistry["asteroids"] = sceneRegistry["belt"];
sceneRegistry["constellations"] = {
  setVisible(v) {
    constellations.visible = v;
  },
  isVisible() {
    return constellations.visible;
  },
};

function setGroupVisible(names, visible) {
  names.forEach((n) => sceneRegistry[n]?.setVisible(visible));
}

function setAllPlanetsVisible(visible) {
  setGroupVisible(PLANET_NAMES, visible);
}

function setOrbitLinesVisible(visible) {
  orbitLinesVisible = visible;
  orbitLines.forEach((l, i) => {
    // respect individual planet visibility too
    l.visible = visible && planets[i].pivot.visible;
  });
}

// Resolve every recognizable target mentioned in the text (planets, sun, moon, rings, groups).
function extractTargets(text) {
  const found = new Set();
  PLANET_NAMES.forEach((name) => {
    if (text.includes(name)) found.add(name);
  });
  MOON_NAMES.forEach((name) => {
    if (text.includes(name)) found.add(name);
  });
  if (/\bsun\b/.test(text)) found.add("sun");
  if (/\bmoons\b/.test(text)) {
    found.add("moon");
    MOON_NAMES.forEach((n) => found.add(n));
  } else if (/\bmoon\b/.test(text)) {
    found.add("moon");
  }
  if (/\bring/.test(text)) found.add("rings");
  if (/\basteroid|asteroids|rocks|neos?\b/.test(text)) found.add("asteroids");
  if (/\bbelt\b/.test(text)) found.add("belt");
  if (/\biss\b|\bspace station\b/.test(text)) found.add("iss");
  if (/\bconstellations?\b/.test(text)) found.add("constellations");
  if (/\binner planets?\b/.test(text)) INNER_PLANETS.forEach((n) => found.add(n));
  if (/\bouter planets?\b/.test(text)) OUTER_PLANETS.forEach((n) => found.add(n));
  if (/\ball planets?\b|\beverything\b|\ball\b/.test(text)) PLANET_NAMES.forEach((n) => found.add(n));
  return [...found];
}

let lastReplyWasAnswer = false; // set by interpretCommand so the UI can style facts differently from command confirmations

function interpretCommand(raw) {
  lastReplyWasAnswer = false;
  const text = raw.toLowerCase().trim();

  // Reset / show everything
  if (/^(reset|show everything|show all|reset view|start over)/.test(text)) {
    setAllPlanetsVisible(true);
    sceneRegistry.sun.setVisible(true);
    sceneRegistry.moons.setVisible(true);
    sceneRegistry.rings.setVisible(true);
    sceneRegistry.asteroids.setVisible(true);
    sceneRegistry.belt.setVisible(true);
    sceneRegistry.iss.setVisible(true);
    setOrbitLinesVisible(true);
    clearFocus();
    return "Showing everything again — full solar system restored.";
  }

  // Informational questions ("tell me about Saturn", "what is this?") — answered
  // from local planet data so this works even with no webhook configured.
  const questionMatch = text.match(
    /\b(?:tell me about|what is|what's|who is|who's|explain)\s+(?:the\s+)?(international space station|space station|\w+)/
  );
  if (questionMatch) {
    const word = questionMatch[1];
    const target =
      word === "this" || word === "it" ? focusedTarget?.name?.toLowerCase() : word.includes("station") ? "iss" : word;
    const info =
      target === "sun"
        ? sunInfo
        : target === "iss"
        ? ISS_INFO
        : planets.find((p) => p.data.name.toLowerCase() === target)?.data;
    if (info) {
      lastReplyWasAnswer = true;
      return N8N_WEBHOOK_URL ? info.info : `${info.info} (Connect the AI webhook for open-ended astronomy questions beyond the planets.)`;
    }
  }

  // Focus / zoom on a specific body
  const focusMatch = text.match(
    /(?:focus on|zoom (?:in )?on|take me to|look at|go to)\s+(?:the\s+)?(international space station|space station|\w+)/
  );
  if (focusMatch) {
    const word = focusMatch[1];
    const target = word.includes("station") ? "iss" : word;
    const mesh = target === "sun" ? sun : target === "iss" ? issProxyMesh : planets.find((p) => p.data.name.toLowerCase() === target)?.mesh;
    if (mesh) {
      if (sceneRegistry[target] && !sceneRegistry[target].isVisible()) sceneRegistry[target].setVisible(true); // reveal if hidden
      focusOnObject(mesh);
      return `Focusing on ${mesh.name}.`;
    }
    return `I don't recognize "${target}" as something I can focus on.`;
  }

  const isHide = /\b(hide|remove|turn off|disable|don't show|get rid of)\b/.test(text);
  const isShow = /\b(show|display|turn on|enable|reveal|bring back|add)\b/.test(text);
  const isOnly = /\bonly\b|\bjust\b/.test(text);

  const targets = extractTargets(text);

  // Standalone orbit-line toggle
  if (/orbit lines?|orbits|paths/.test(text)) {
    if (isHide) {
      setOrbitLinesVisible(false);
      return "Hid the orbit lines.";
    }
    if (isShow) {
      setOrbitLinesVisible(true);
      return "Orbit lines are back on.";
    }
  }

  if (targets.length === 0) {
    return "I'm not sure what to show or hide — try something like \"hide Mars\", \"show only the outer planets\", or \"focus on Saturn\".";
  }

  if (isOnly) {
    // Hide every planet, then reveal only the mentioned ones
    setAllPlanetsVisible(false);
    setGroupVisible(targets, true);
    return `Showing only: ${targets.join(", ")}.`;
  }

  if (isHide) {
    setGroupVisible(targets, false);
    return `Hid: ${targets.join(", ")}.`;
  }

  if (isShow) {
    setGroupVisible(targets, true);
    return `Showing: ${targets.join(", ")}.`;
  }

  // Mentioned a target with no clear verb — default to showing it
  setGroupVisible(targets, true);
  return `Showing: ${targets.join(", ")}.`;
}

// ---------- optional: real LLM agent via an n8n webhook ----------
// Paste your n8n Production webhook URL here to upgrade from the local
// parser above to a real LLM-backed agent. Leave it empty ("") to keep
// using the local parser only.
const N8N_WEBHOOK_URL = "https://hamzah-07.app.n8n.cloud/webhook/solar-system-agent";

async function getSceneContext() {
  const visible = [];
  const hidden = [];
  Object.entries(sceneRegistry).forEach(([name, obj]) => {
    (obj.isVisible() ? visible : hidden).push(name);
  });
  const focused = focusedTarget?.name?.toLowerCase() || null;
  // Real numbers for whatever's currently focused, so the AI can ground an
  // answer instead of guessing — cached after the first lookup, so usually instant.
  const focusedFacts =
    focused === "iss" ? await fetchISSLive().catch(() => null) : focused ? await fetchBodyFacts(focused) : null;
  return { visible, hidden, orbitLinesVisible, focused, focusedFacts };
}

// Applies the { actions: [...] } array returned by the n8n webhook to the scene.
function applyActions(actions) {
  if (!Array.isArray(actions)) return;
  actions.forEach((action) => {
    switch (action.type) {
      case "show":
        setGroupVisible(action.targets || [], true);
        break;
      case "hide":
        setGroupVisible(action.targets || [], false);
        break;
      case "showOnly":
        setAllPlanetsVisible(false);
        setGroupVisible(action.targets || [], true);
        break;
      case "focus": {
        const target = (action.target || "").toLowerCase();
        const mesh =
          target === "sun"
            ? sun
            : target === "iss"
            ? issProxyMesh
            : planets.find((p) => p.data.name.toLowerCase() === target)?.mesh;
        if (mesh) {
          if (sceneRegistry[target] && !sceneRegistry[target].isVisible()) sceneRegistry[target].setVisible(true);
          focusOnObject(mesh);
        }
        break;
      }
      case "orbitLines":
        setOrbitLinesVisible(!!action.visible);
        break;
      case "reset":
        setAllPlanetsVisible(true);
        sceneRegistry.sun.setVisible(true);
        sceneRegistry.moons.setVisible(true);
        sceneRegistry.rings.setVisible(true);
        sceneRegistry.asteroids.setVisible(true);
        sceneRegistry.belt.setVisible(true);
        sceneRegistry.iss.setVisible(true);
        setOrbitLinesVisible(true);
        clearFocus();
        break;
    }
  });
}

async function callAgentWebhook(command) {
  const context = await getSceneContext();
  const res = await fetch(N8N_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ command, context }),
  });
  if (!res.ok) throw new Error("Webhook error " + res.status);
  const data = await res.json();
  // n8n's Structured Output Parser nests the result under "output"
  const result = data.output || data;
  applyActions(result.actions);
  // No actions returned means the AI just answered a question rather than
  // controlling the scene — flag it so the UI can style it as a fact, not a command reply.
  const isAnswer = !result.actions || result.actions.length === 0;
  return { text: result.reply || "Done.", isAnswer };
}

const agentLog = document.getElementById("agentLog");
const agentForm = document.getElementById("agentForm");
const agentInput = document.getElementById("agentInput");

function logMessage(text, who) {
  const div = document.createElement("div");
  div.className = `msg ${who}`;
  div.textContent = text;
  agentLog.appendChild(div);
  agentLog.scrollTop = agentLog.scrollHeight;
  return div;
}

async function runCommand(command) {
  if (!command.trim()) return;
  logMessage(command, "user");

  if (N8N_WEBHOOK_URL) {
    const pending = logMessage("…", "agent");
    try {
      const { text, isAnswer } = await callAgentWebhook(command);
      pending.textContent = text;
      if (isAnswer) pending.classList.add("answer");
      speak(text);
    } catch (err) {
      const fallback = interpretCommand(command);
      pending.textContent = `${fallback} (webhook unreachable — used local fallback)`;
      if (lastReplyWasAnswer) pending.classList.add("answer");
      speak(fallback);
    }
    return;
  }

  const reply = interpretCommand(command);
  const msgEl = logMessage(reply, "agent");
  if (lastReplyWasAnswer) msgEl.classList.add("answer");
  speak(reply);
}

agentForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const value = agentInput.value;
  agentInput.value = "";
  runCommand(value);
});

document.querySelectorAll(".chip").forEach((chip) => {
  chip.addEventListener("click", () => runCommand(chip.dataset.cmd));
});

// ---------- planetary alignments & Sun-Earth-Moon eclipses ----------
// Two related but independent things happen here:
// 1) In-scene detection: the sim's orbital speeds are based on real relative
//    ratios (just time-compressed), so as the animation runs from its random
//    starting angles, planets naturally drift into conjunction with each
//    other, and the Moon naturally drifts into the Sun-Earth line. Both are
//    detected purely from live angles/positions each frame — nothing here is
//    tied to a real calendar date.
// 2) Two demo buttons that *force* an alignment/eclipse into view (with a
//    smooth animated tween) so you don't have to wait for one to happen on
//    its own, plus a separate real-world eclipse calendar (static data, see
//    REAL_ECLIPSES below) sourced from actual NASA/USNO predictions.

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function normalizeAngleDeg(rad) {
  let d = THREE.MathUtils.radToDeg(rad) % 360;
  if (d < 0) d += 360;
  return d;
}

function circularDiffDeg(a, b) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

// ---- toast notifications (used by both auto-detection and the demo buttons) ----
const eventToast = document.getElementById("eventToast");
const eventToastTitle = document.getElementById("eventToastTitle");
const eventToastBody = document.getElementById("eventToastBody");
const eventToastClose = document.getElementById("eventToastClose");
let toastHideTimer = null;

function showToast(title, body, duration = 6000) {
  if (!eventToast) return;
  eventToastTitle.textContent = title;
  eventToastBody.textContent = body || "";
  eventToast.classList.add("visible");
  clearTimeout(toastHideTimer);
  toastHideTimer = setTimeout(() => eventToast.classList.remove("visible"), duration);
}
eventToastClose?.addEventListener("click", () => {
  eventToast.classList.remove("visible");
  clearTimeout(toastHideTimer);
});

// ---- planetary alignment (conjunction) detection ----
// Every frame, cluster planets whose heliocentric angle is within
// ALIGNMENT_THRESHOLD_DEG of each other. Toasts/highlights fire only when a
// group newly forms (tracked via activeAlignmentKeys), not on every frame
// it stays formed, so it doesn't spam while planets linger near alignment.
const ALIGNMENT_THRESHOLD_DEG = 6;
let activeAlignmentKeys = new Set();

function addAlignmentHighlight(mesh) {
  if (mesh.userData._alignGlow) return;
  const radius = mesh.geometry.parameters?.radius || 1;
  const glow = createGlow(radius * 7, 0x9dffc0, 0.65);
  mesh.add(glow);
  mesh.userData._alignGlow = glow;
}

function removeAlignmentHighlight(mesh) {
  const glow = mesh.userData._alignGlow;
  if (glow) {
    mesh.remove(glow);
    mesh.userData._alignGlow = null;
  }
}

function checkPlanetAlignments() {
  const infoList = planets.map(({ mesh, pivot, data }) => ({
    key: data.name.toLowerCase(),
    name: data.name,
    angle: normalizeAngleDeg(pivot.rotation.y),
    mesh,
  }));

  // union-find so 3+ mutually-close planets group together, not just pairs
  const n = infoList.length;
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  const union = (a, b) => {
    const ra = find(a), rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (circularDiffDeg(infoList[i].angle, infoList[j].angle) <= ALIGNMENT_THRESHOLD_DEG) union(i, j);
    }
  }
  const groups = {};
  infoList.forEach((p, i) => {
    const root = find(i);
    (groups[root] = groups[root] || []).push(p);
  });

  const newGroups = Object.values(groups).filter((g) => g.length >= 2);
  const newKeys = new Set(newGroups.map((g) => g.map((p) => p.key).sort().join(",")));

  newGroups.forEach((g) => {
    const key = g.map((p) => p.key).sort().join(",");
    if (!activeAlignmentKeys.has(key)) {
      const names = g.map((p) => p.name).join(" and ");
      showToast("✨ Planetary alignment", `${names} have lined up in their orbits, as seen from the Sun.`, 6000);
    }
    g.forEach((p) => addAlignmentHighlight(p.mesh));
  });

  const stillAligned = new Set(newGroups.flatMap((g) => g.map((p) => p.key)));
  infoList.forEach((p) => {
    if (!stillAligned.has(p.key)) removeAlignmentHighlight(p.mesh);
  });

  activeAlignmentKeys = newKeys;
}

// "✨ Align Planets" button — smoothly tweens every planet's orbital angle to
// the same heliocentric angle so you can see a conjunction on demand instead
// of waiting for one to happen naturally. Once the tween finishes, normal
// motion resumes and the drift-apart (and the alignment toast/glow above)
// happens exactly as it would if this had occurred on its own.
let alignTween = null; // { startTime, duration, items: [{pivot,start,delta}], pivots: Set }

function startAlignAnimation() {
  const targetAngle = 0;
  const items = planets.map(({ pivot }) => {
    const start = pivot.rotation.y;
    const delta = ((targetAngle - start + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
    return { pivot, start, delta };
  });
  alignTween = { startTime: performance.now(), duration: 2600, items, pivots: new Set(items.map((i) => i.pivot)) };
  showToast("✨ Aligning the planets…", "Watch them swing into a straight line from the Sun.", 3200);
}

// ---- Sun-Earth-Moon eclipse detection ----
// Both this sim's planet orbits and its Moon orbit sit flat on the same
// plane (no lunar orbital tilt is modeled), so "collinear" here just means
// the Earth->Moon direction matches (solar) or opposes (lunar) the
// Earth->Sun direction, computed from live world positions each frame.
const ECLIPSE_THRESHOLD_DEG = 5;
const ECLIPSE_MOON_COLOR = new THREE.Color(0x9a4a34);
let solarEclipseActive = false;
let lunarEclipseActive = false;
const SUN_LIGHT_BASE = sunLight.intensity;
const AMBIENT_BASE = ambient.intensity;
let sunLightTargetIntensity = SUN_LIGHT_BASE;
let ambientTargetIntensity = AMBIENT_BASE;

function checkEclipse() {
  if (!earthEntry?.data._moonMesh) return;
  const earthPos = new THREE.Vector3();
  earthEntry.mesh.getWorldPosition(earthPos);
  const moonPos = new THREE.Vector3();
  earthEntry.data._moonMesh.getWorldPosition(moonPos);

  const angleEarthToSun = Math.atan2(-earthPos.z, -earthPos.x);
  const angleEarthToMoon = Math.atan2(moonPos.z - earthPos.z, moonPos.x - earthPos.x);
  let diffDeg = THREE.MathUtils.radToDeg(angleEarthToSun - angleEarthToMoon);
  diffDeg = ((diffDeg + 180) % 360 + 360) % 360 - 180;

  const isSolar = Math.abs(diffDeg) < ECLIPSE_THRESHOLD_DEG; // Moon sits between Earth and the Sun
  const isLunar = Math.abs(Math.abs(diffDeg) - 180) < ECLIPSE_THRESHOLD_DEG; // Moon sits on Earth's far side, in its shadow

  if (isSolar && !solarEclipseActive) {
    solarEclipseActive = true;
    sunLightTargetIntensity = SUN_LIGHT_BASE * 0.4;
    ambientTargetIntensity = AMBIENT_BASE * 0.6;
    showToast("☀️🌑 Solar eclipse", "The Moon has passed directly between the Sun and Earth, briefly dimming the light.", 7000);
  } else if (!isSolar && solarEclipseActive) {
    solarEclipseActive = false;
    sunLightTargetIntensity = SUN_LIGHT_BASE;
    ambientTargetIntensity = AMBIENT_BASE;
  }

  if (isLunar && !lunarEclipseActive) {
    lunarEclipseActive = true;
    showToast("🌕🌑 Lunar eclipse", "The Moon has slipped into Earth's shadow, dimming and reddening it — a \u201cblood moon.\u201d", 7000);
  } else if (!isLunar && lunarEclipseActive) {
    lunarEclipseActive = false;
  }
}

// "☀️ Solar Eclipse" / "🌕 Lunar Eclipse" buttons — briefly freeze Earth in
// place and swing the Moon into the Sun-Earth line so either configuration
// can be previewed without waiting for it to line up on its own.
let eclipseTween = null; // { startTime, duration, moonPivot, startPhi, delta }

function previewEclipse(kind) {
  if (!earthEntry?.data._moonPivot || !earthEntry?.data._moonMesh) return;
  const thetaE = earthEntry.pivot.rotation.y;
  const psi = earthEntry.mesh.rotation.y;
  const targetAlpha = kind === "solar" ? thetaE + Math.PI : thetaE;
  const targetPhi = targetAlpha - psi;
  const startPhi = earthEntry.data._moonPivot.rotation.y;
  const delta = ((targetPhi - startPhi + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  eclipseTween = { startTime: performance.now(), duration: 2400, moonPivot: earthEntry.data._moonPivot, startPhi, delta };

  focusOnObject(kind === "solar" ? earthEntry.mesh : earthEntry.data._moonMesh);
  showToast(
    kind === "solar" ? "☀️ Lining up a solar eclipse…" : "🌕 Lining up a lunar eclipse…",
    "Watch the Moon swing into position.",
    3000
  );
}

document.getElementById("alignBtn")?.addEventListener("click", startAlignAnimation);
document.getElementById("solarEclipseBtn")?.addEventListener("click", () => previewEclipse("solar"));
document.getElementById("lunarEclipseBtn")?.addEventListener("click", () => previewEclipse("lunar"));

// ---- real eclipse calendar (static, curated data — NOT a live API) ----
// Solar/lunar eclipse predictions are exact years in advance, so unlike the
// live feeds elsewhere in this file there's no live source worth fetching
// here — this list is transcribed from NASA/USNO eclipse predictions and is
// accurate through early 2028. Extend it by hand for eclipses beyond that.
const REAL_ECLIPSES = [
  { date: "2026-08-12", kind: "solar", type: "Total", visibility: "Totality crosses Greenland, Iceland, northern Spain, a small part of Portugal, and a remote part of Arctic Russia. Partial phases visible across much of Europe, Africa, North America, and the Arctic/Atlantic/Pacific." },
  { date: "2026-08-27", kind: "lunar", type: "Partial", visibility: "Visible from the Americas, Europe, Africa, and western Asia." },
  { date: "2027-02-06", kind: "solar", type: "Annular", visibility: "Annularity crosses Chile, Argentina, Uruguay, Brazil, and parts of West Africa (Ivory Coast, Ghana, Togo, Benin, Nigeria). Partial phases visible across much of South America, Africa, and Antarctica." },
  { date: "2027-02-20", kind: "lunar", type: "Penumbral", visibility: "Visible from the Americas, Europe, Africa, Asia, Australia, and Antarctica — subtle dimming only." },
  { date: "2027-07-18", kind: "lunar", type: "Penumbral", visibility: "A very shallow, brief penumbral eclipse — barely noticeable to the eye." },
  { date: "2027-08-02", kind: "solar", type: "Total", visibility: "Totality crosses southern Spain, Morocco, Algeria, Tunisia, Libya, Egypt, Saudi Arabia, and Yemen. Partial phases visible across most of Europe, Africa, the Middle East, and parts of Southeast Asia." },
  { date: "2027-08-16", kind: "lunar", type: "Penumbral", visibility: "Visible from eastern North America, South America, Europe, Africa, and western Asia." },
  { date: "2028-01-12", kind: "lunar", type: "Partial", visibility: "Visible from the eastern Pacific, the Americas, the Atlantic, Europe, Africa, and western Asia." },
];

const eclipseCalModal = document.getElementById("eclipseCalModal");
const eclipseCalBody = document.getElementById("eclipseCalBody");
const eclipseCalBtn = document.getElementById("eclipseCalBtn");
const eclipseCalClose = document.getElementById("eclipseCalClose");
const eclipseCalBackdrop = document.getElementById("eclipseCalBackdrop");

function renderEclipseCalendar() {
  if (!eclipseCalBody) return;
  const todayStr = new Date().toISOString().split("T")[0];
  const upcoming = REAL_ECLIPSES.filter((e) => e.date >= todayStr);
  const list = upcoming.length ? upcoming : REAL_ECLIPSES; // fall back to the full list once we're past the last entry
  eclipseCalBody.innerHTML = list
    .map((e) => {
      const icon = e.kind === "solar" ? "☀️" : "🌕";
      const label = e.kind === "solar" ? "Solar" : "Lunar";
      const d = new Date(e.date + "T00:00:00Z");
      const dateStr = d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
      return `<div class="eclipse-row">
        <div class="eclipse-row-head">${icon} <strong>${e.type} ${label} Eclipse</strong> — ${dateStr}</div>
        <div class="eclipse-row-body">${e.visibility}</div>
      </div>`;
    })
    .join("");
}

function openEclipseCalModal() {
  renderEclipseCalendar();
  eclipseCalModal?.classList.add("visible");
}
function closeEclipseCalModal() {
  eclipseCalModal?.classList.remove("visible");
}
eclipseCalBtn?.addEventListener("click", openEclipseCalModal);
eclipseCalClose?.addEventListener("click", closeEclipseCalModal);
eclipseCalBackdrop?.addEventListener("click", closeEclipseCalModal);

// ---------- resize ----------
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- animation loop ----------
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();

  if (!paused) {
    const dt = delta * speedMultiplier;

    // sun self-rotation
    sun.rotation.y += 0.05 * dt;

    planets.forEach(({ mesh, pivot, data }) => {
      // While an eclipse preview is running we briefly freeze Earth's own
      // position/spin so the Sun-Earth-Moon geometry we tweened toward holds
      // still instead of drifting away the instant it's reached.
      const earthFrozenForEclipse = eclipseTween && data.name === "Earth";
      if (!(alignTween && alignTween.pivots.has(pivot))) {
        pivot.rotation.y += data.speed * ORBIT_SPEED_SCALE * dt;
      }
      if (!earthFrozenForEclipse) {
        mesh.rotation.y += (1 / data.radius) * SELF_SPIN_SCALE * dt;
      }
      if (data._moonPivot && !earthFrozenForEclipse) {
        data._moonPivot.rotation.y += 2.2 * dt;
      }
      if (data._moons) {
        data._moons.forEach((m) => {
          m.pivot.rotation.y += m.speed * dt;
        });
      }
      if (data._cloudMesh) {
        data._cloudMesh.rotation.y += 0.18 * dt;
      }
      if (data._issPivot) {
        data._issPivot.rotation.y += ISS_ORBIT_SPEED * dt;
      }
    });

    if (asteroidBelt) asteroidBelt.rotation.y += 0.015 * dt;

    // ---- "Align Planets" / eclipse-preview tweens override the normal
    // per-frame increments above with an eased interpolation instead ----
    if (alignTween) {
      const t = Math.min(1, (performance.now() - alignTween.startTime) / alignTween.duration);
      const eased = easeInOutCubic(t);
      alignTween.items.forEach(({ pivot, start, delta }) => {
        pivot.rotation.y = start + delta * eased;
      });
      if (t >= 1) alignTween = null;
    }
    if (eclipseTween) {
      const t = Math.min(1, (performance.now() - eclipseTween.startTime) / eclipseTween.duration);
      const eased = easeInOutCubic(t);
      eclipseTween.moonPivot.rotation.y = eclipseTween.startPhi + eclipseTween.delta * eased;
      if (t >= 1) eclipseTween = null;
    }

    // ---- detect real-time planetary alignments & Sun-Earth-Moon eclipses ----
    checkPlanetAlignments();
    checkEclipse();
  }

  // Ease sunlight/ambient toward their (possibly eclipse-dimmed) targets, and
  // the Moon's material toward its eclipse-red tint, independent of pause
  // state, so an in-progress fade doesn't just freeze if you hit Pause.
  sunLight.intensity += (sunLightTargetIntensity - sunLight.intensity) * 0.05;
  ambient.intensity += (ambientTargetIntensity - ambient.intensity) * 0.05;
  if (earthEntry?.data._moonMesh && earthEntry.data._moonBaseColor) {
    const targetColor = lunarEclipseActive ? ECLIPSE_MOON_COLOR : earthEntry.data._moonBaseColor;
    earthEntry.data._moonMesh.material.color.lerp(targetColor, 0.05);
  }

  if (focusedTarget) {
    const worldPos = new THREE.Vector3();
    focusedTarget.getWorldPosition(worldPos);
    controls.target.lerp(worldPos, 0.08);

    if (desiredZoomDistance !== null) {
      const currentDir = new THREE.Vector3()
        .subVectors(camera.position, controls.target)
        .normalize();
      const desiredPos = new THREE.Vector3()
        .copy(worldPos)
        .add(currentDir.multiplyScalar(desiredZoomDistance));
      camera.position.lerp(desiredPos, 0.05);
    }
  }

  controls.update();
  renderer.render(scene, camera);
}

animate();
