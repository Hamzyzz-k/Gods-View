import * as THREE from "three";

// ---------- black holes ----------
// One reusable builder for every black hole in the app (Sagittarius A* at
// the Milky Way's center, plus one marker each for Andromeda, Centaurus A,
// and the Virgo Cluster/M87 — cosmos/galaxyData.js's `blackHole` field says
// which galaxies get one). Visually: a black event-horizon sphere (the
// clickable proxy — real geometry, so focus.js's bounding-sphere framing
// and raycastPicking.js's hit-testing both work exactly like every other
// clickable body) wrapped in a tilted, radially-gradiented accretion disk
// and a soft glow, rather than the old plain flat-shaded sphere.
//
// The disk reuses planetFactory.js's Saturn-ring technique verbatim: a
// RingGeometry's default UVs are a planar (x,y) projection, not polar, but
// since that projection is linear it still preserves radial distance from
// center proportionally — so remapping U to true radial fraction (inner
// edge = 0, outer edge = 1) makes a centered radial-gradient canvas texture
// read as a smooth inner-to-outer falloff instead of the two-tone band a
// naive UV would produce.

function buildDiskCanvas() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d");
  const cx = 128, cy = 128;
  // White-hot inner edge (matter moving fastest, closest to the horizon)
  // fading through orange to a dim red outer edge — the standard accretion
  // disk temperature gradient real EHT/simulated imagery shows.
  const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, 128);
  grd.addColorStop(0, "rgba(20,10,10,0)");
  grd.addColorStop(0.34, "rgba(255,255,255,0.95)");
  grd.addColorStop(0.5, "rgba(255,210,140,0.9)");
  grd.addColorStop(0.72, "rgba(255,130,60,0.65)");
  grd.addColorStop(1, "rgba(140,40,20,0)");
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, 256, 256);
  return canvas;
}

function buildAccretionDisk(radius, tiltRad) {
  const innerR = radius * 1.15; // starts just outside the event horizon, not flush against it
  const outerR = radius * 3.4;
  const geo = new THREE.RingGeometry(innerR, outerR, 96);
  const pos = geo.attributes.position;
  const v3 = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v3.fromBufferAttribute(pos, i);
    const u = THREE.MathUtils.clamp((v3.length() - innerR) / (outerR - innerR), 0, 1);
    geo.attributes.uv.setXY(i, u, 1);
  }
  const mat = new THREE.MeshBasicMaterial({
    map: new THREE.CanvasTexture(buildDiskCanvas()),
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending, // hot plasma should glow, not just tint
  });
  const disk = new THREE.Mesh(geo, mat);
  disk.rotation.x = Math.PI / 2 - tiltRad; // near edge-on with a slight tilt, the classic accretion-disk angle
  disk.name = "accretionDisk";
  return disk;
}

// Same "canvas radial gradient wrapped in a CanvasTexture" glow technique
// every other cosmos/ file already uses (milkyWay.js, galaxyFactory.js).
function makeGlowSprite(hexColor, scale, opacity) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext("2d");
  const c = new THREE.Color(hexColor);
  const grd = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, `rgba(${c.r * 255},${c.g * 255},${c.b * 255},${opacity})`);
  grd.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, 128, 128);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(canvas), transparent: true, depthWrite: false, fog: false,
  }));
  sprite.scale.setScalar(scale);
  return sprite;
}

// Builds one black hole: a real clickable Mesh (the event horizon) with the
// accretion disk and glow as decorative children — the same "Mesh you can
// click, everything else is a non-clickable child" shape galaxyFactory.js's
// proxy+Sprite pair and surface/skyObjects.js's neighbour planets already
// use. Returns the Mesh directly (not a wrapping Group) so callers can drop
// it straight into registerTierClickables() alongside every other clickable
// body, unchanged from how they already do it.
export function buildBlackHole(name, meta, info, radius = 40, tiltRad = 0.5) {
  const geo = new THREE.SphereGeometry(radius, 24, 24);
  const mat = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = name;
  mesh.userData.info = { name, meta, info };

  mesh.add(buildAccretionDisk(radius, tiltRad));
  mesh.add(makeGlowSprite(0xffb060, radius * 9, 0.35)); // wide, faint ambient glow from the disk
  mesh.add(makeGlowSprite(0xfff2d0, radius * 2.4, 0.55)); // tighter, brighter glow right at the horizon's edge

  return mesh;
}
