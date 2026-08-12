import * as THREE from "three";
import { registerTierClickables } from "../interaction/raycastPicking.js";
import { buildBlackHole } from "./blackHole.js";

// ---------- Milky Way tier content ----------
// Stylized, not scientifically accurate — the same "plausible, not to
// scale" bar every other data file in this app already commits to
// (scene/planetData.js's header comment states it outright for the solar
// system; this just applies it one scale level up). A THREE.Points
// logarithmic-spiral field stands in for ~100 billion real stars; a
// clickable core represents Sagittarius A*; a small marker shows roughly
// where the Sun sits in a real spiral galaxy (an outer arm, not the
// center — a detail worth keeping even though the rest is stylized).

const GALAXY_RADIUS = 4000; // scene units at this tier's scale (cameraFar 20000, controlsMax 6000 — cosmos/tierData.js)
const ARM_COUNT = 4;
const ARM_JITTER = 0.35; // radians of random scatter around each arm's ideal angle
const SPIRAL_TIGHTNESS = 0.35; // b in the logarithmic spiral theta = ln(r) / b
const STAR_COUNT = 60000;
const BULGE_FRACTION = 0.12; // fraction of stars in the central spherical bulge rather than an arm

function spiralPosition(armIndex, t) {
  // t in [0,1): fraction of the way out from center to the galaxy's edge.
  const armAngle = (armIndex / ARM_COUNT) * Math.PI * 2;
  const r = Math.pow(t, 0.7) * GALAXY_RADIUS; // denser toward the center, same falloff feel as a real disk profile
  const theta = armAngle + Math.log(1 + r / 200) / SPIRAL_TIGHTNESS + (Math.random() - 0.5) * ARM_JITTER * (1.4 - t * 0.8);
  return { r, theta };
}

function buildStarField() {
  const positions = new Float32Array(STAR_COUNT * 3);
  const colors = new Float32Array(STAR_COUNT * 3);
  const color = new THREE.Color();

  for (let i = 0; i < STAR_COUNT; i++) {
    let x, y, z, radiusFrac;

    if (Math.random() < BULGE_FRACTION) {
      const r = Math.pow(Math.random(), 0.5) * GALAXY_RADIUS * 0.12;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      x = r * Math.sin(phi) * Math.cos(theta);
      y = r * Math.cos(phi) * 0.6; // flattened bulge, not a perfect sphere
      z = r * Math.sin(phi) * Math.sin(theta);
      radiusFrac = r / GALAXY_RADIUS;
    } else {
      const armIndex = i % ARM_COUNT;
      const t = Math.random();
      const { r, theta } = spiralPosition(armIndex, t);
      const thickness = (1 - t) * 60 + 20; // thinner disk further from the core
      x = r * Math.cos(theta);
      z = r * Math.sin(theta);
      y = (Math.random() - 0.5) * thickness;
      radiusFrac = t;
    }

    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;

    // Warm core (hue ~0.11, orange-gold) fading to cooler blue-white arms
    // (hue ~0.6) — the same visual cue real spiral galaxy photos show
    // (older, redder stars concentrated in the bulge; young, hot blue
    // stars tracing the arms).
    const hue = THREE.MathUtils.lerp(0.11, 0.6, Math.min(1, radiusFrac * 1.3));
    const sat = THREE.MathUtils.lerp(0.6, 0.35, radiusFrac);
    const light = THREE.MathUtils.lerp(0.75, 0.55, radiusFrac);
    color.setHSL(hue, sat, light);
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.PointsMaterial({ size: 6, vertexColors: true, sizeAttenuation: true, transparent: true, opacity: 0.9, depthWrite: false });
  const points = new THREE.Points(geo, mat);
  points.name = "milkyWaySpiral";
  return points;
}

// Small radial-gradient sprite, the same "canvas gradient wrapped in a
// CanvasTexture" glow technique scene/sun.js's corona and
// surface/skyObjects.js's neighbour-planet glow already use.
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

function makeLabelSprite(text) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  ctx.font = "bold 48px 'Segoe UI', Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(232,236,247,0.9)";
  ctx.fillText(text, 256, 64);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(canvas), transparent: true, depthWrite: false, fog: false,
  }));
  sprite.scale.set(200, 50, 1);
  return sprite;
}

function buildGalacticCore() {
  const group = new THREE.Group();
  group.name = "milkyWayCore";

  // Same info-panel contract every clickable body in this app uses
  // (scene/planetData.js) — showInfoFor() reads userData.info directly and
  // unconditionally iterates `meta`, so it must always be a real object.
  const mesh = buildBlackHole(
    "Sagittarius A*",
    { Type: "Supermassive black hole", Mass: "~4.1 million M☉", "Distance from Sun": "~26,000 ly" },
    "The supermassive black hole at the center of the Milky Way. Its presence was inferred from the orbits of stars swinging around an invisible point at extreme speed — work recognized by the 2020 Nobel Prize in Physics. Real telescopes see only the glow of infalling matter swirling around it, not the hole itself — this accretion-disk marker stands in for that glow rather than the (invisible) horizon alone.",
    40,
    0.5
  );
  group.add(mesh);
  group.add(makeGlowSprite(0xffd27a, 260, 0.6));

  registerTierClickables("milkyWay", [mesh]);
  return group;
}

// Roughly where the real Sun sits: not the center, but out on one of the
// spiral's outer arms (the real Orion Arm is a minor spur about 2/3 of the
// way to the disk's edge) — a genuine detail worth keeping even though the
// rest of this tier's placement is stylized.
function buildYouAreHereMarker() {
  const group = new THREE.Group();
  group.name = "milkyWayYouAreHere";
  const { r, theta } = spiralPosition(0, 0.62);
  group.position.set(r * Math.cos(theta), 0, r * Math.sin(theta));

  group.add(makeGlowSprite(0x7ab8ff, 90, 0.85));
  const label = makeLabelSprite("You Are Here — the Sun");
  label.position.y = 70;
  group.add(label);

  return group;
}

// A generic "you're home / this way back" marker for outer tiers that want
// to point at whatever the previous, more-zoomed-in tier's own content was,
// without pulling in that tier's full scene. Reuses the same glow+label
// sprite helpers the Milky Way tier's own You-Are-Here marker above uses.
export function buildHomeMarker(label, hexColor) {
  const group = new THREE.Group();
  group.name = "homeMarker";
  group.add(makeGlowSprite(hexColor, 220, 0.6));
  const labelSprite = makeLabelSprite(label);
  labelSprite.position.y = 160;
  group.add(labelSprite);
  return group;
}

// The Local Group tier's specific instance — kept as a named export (rather
// than every caller re-passing the same label/color) since it's the one
// used in more than one place already.
export function buildMilkyWayHomeMarker() {
  const group = buildHomeMarker("Milky Way (Home)", 0xffe0b0);
  group.name = "milkyWayHomeMarker";
  return group;
}

export function buildMilkyWayContent() {
  const group = new THREE.Group();
  group.name = "milkyWayContent";
  group.add(buildStarField());
  group.add(buildGalacticCore());
  group.add(buildYouAreHereMarker());
  return group;
}
