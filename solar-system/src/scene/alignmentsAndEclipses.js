import { showToast } from "../ui/toast.js";
import * as THREE from "three";
import { AppState } from "../core/state.js";
import { createGlow } from "./sun.js";
import { planets, earthEntry } from "./planetFactory.js";
const { scene, sunLight, ambient } = AppState;

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

export function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function normalizeAngleDeg(rad) {
  let d = THREE.MathUtils.radToDeg(rad) % 360;
  if (d < 0) d += 360;
  return d;
}

export function circularDiffDeg(a, b) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

// ---- planetary alignment (conjunction) detection ----
// Every frame, cluster planets whose heliocentric angle is within
// ALIGNMENT_THRESHOLD_DEG of each other. Toasts/highlights fire only when a
// group newly forms (tracked via activeAlignmentKeys), not on every frame
// it stays formed, so it doesn't spam while planets linger near alignment.
export const ALIGNMENT_THRESHOLD_DEG = 6;
export let activeAlignmentKeys = new Set();

export function addAlignmentHighlight(mesh) {
  if (mesh.userData._alignGlow) return;
  const radius = mesh.geometry.parameters?.radius || 1;
  const glow = createGlow(radius * 7, 0x9dffc0, 0.65);
  mesh.add(glow);
  mesh.userData._alignGlow = glow;
}

export function removeAlignmentHighlight(mesh) {
  const glow = mesh.userData._alignGlow;
  if (glow) {
    mesh.remove(glow);
    mesh.userData._alignGlow = null;
  }
}

export function checkPlanetAlignments() {
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
      showToast("Planetary alignment", `${names} have lined up in their orbits, as seen from the Sun.`, 6000);
    }
    g.forEach((p) => addAlignmentHighlight(p.mesh));
  });

  const stillAligned = new Set(newGroups.flatMap((g) => g.map((p) => p.key)));
  infoList.forEach((p) => {
    if (!stillAligned.has(p.key)) removeAlignmentHighlight(p.mesh);
  });

  activeAlignmentKeys = newKeys;
}

// "Align Planets" button — smoothly tweens every planet's orbital angle to
// the same heliocentric angle so you can see a conjunction on demand instead
// of waiting for one to happen naturally. Once the tween finishes, normal
// motion resumes and the drift-apart (and the alignment toast/glow above)
// happens exactly as it would if this had occurred on its own.
// alignTween lives on AppState, not as a module-level `let`: the frame loop
// clears it when the tween finishes, and an imported binding is read-only to
// the importer, so assigning to it from loop.js would throw every frame.
// AppState.alignTween = { startTime, duration, items: [{pivot,start,delta}], pivots: Set }

export function startAlignAnimation() {
  const targetAngle = 0;
  const items = planets.map(({ pivot }) => {
    const start = pivot.rotation.y;
    const delta = ((targetAngle - start + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
    return { pivot, start, delta };
  });
  AppState.alignTween = { startTime: performance.now(), duration: 2600, items, pivots: new Set(items.map((i) => i.pivot)) };
  showToast("Aligning the planets…", "Watch them swing into a straight line from the Sun.", 3200);
}

// ---- Sun-Earth-Moon eclipse detection ----
// Both this sim's planet orbits and its Moon orbit sit flat on the same
// plane (no lunar orbital tilt is modeled), so "collinear" here just means
// the Earth->Moon direction matches (solar) or opposes (lunar) the
// Earth->Sun direction, computed from live world positions each frame.
export const ECLIPSE_THRESHOLD_DEG = 5;
export const ECLIPSE_MOON_COLOR = new THREE.Color(0x9a4a34);
export let solarEclipseActive = false;
export let lunarEclipseActive = false;
export const SUN_LIGHT_BASE = sunLight.intensity;
export const AMBIENT_BASE = ambient.intensity;
export let sunLightTargetIntensity = SUN_LIGHT_BASE;
export let ambientTargetIntensity = AMBIENT_BASE;

export function checkEclipse() {
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
    showToast("Solar eclipse", "The Moon has passed directly between the Sun and Earth, briefly dimming the light.", 7000);
  } else if (!isSolar && solarEclipseActive) {
    solarEclipseActive = false;
    sunLightTargetIntensity = SUN_LIGHT_BASE;
    ambientTargetIntensity = AMBIENT_BASE;
  }

  if (isLunar && !lunarEclipseActive) {
    lunarEclipseActive = true;
    showToast("Lunar eclipse", "The Moon has slipped into Earth's shadow, dimming and reddening it — a \u201cblood moon.\u201d", 7000);
  } else if (!isLunar && lunarEclipseActive) {
    lunarEclipseActive = false;
  }
}

// "Solar Eclipse" / "Lunar Eclipse" buttons — briefly freeze Earth in
// place and swing the Moon into the Sun-Earth line so either configuration
// can be previewed without waiting for it to line up on its own.
