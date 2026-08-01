import * as THREE from "three";
import { AppState } from "./state.js";
import { sun } from "../scene/sun.js";
import { planets, earthEntry } from "../scene/planetFactory.js";
import { ORBIT_SPEED_SCALE, SELF_SPIN_SCALE, ISS_ORBIT_SPEED } from "../scene/planetData.js";
import { asteroidBelt } from "../scene/asteroidBelt.js";
import { paused, speedMultiplier } from "../ui/desktopControls.js";
import { updateFocus } from "../interaction/focus.js";
import {
  checkPlanetAlignments, checkEclipse, easeInOutCubic,
  ECLIPSE_MOON_COLOR, lunarEclipseActive,
  sunLightTargetIntensity, ambientTargetIntensity,
} from "../scene/alignmentsAndEclipses.js";
const { scene, camera, renderer, controls, sunLight, ambient } = AppState;

// ---------- animation loop ----------
export const clock = new THREE.Clock();

export function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();

  if (!paused) {
    const dt = delta * speedMultiplier;

    // sun self-rotation
    sun.rotation.y += 0.05 * dt;

    planets.forEach(({ mesh, pivot, data }) => {
      if (!(AppState.alignTween && AppState.alignTween.pivots.has(pivot))) {
        pivot.rotation.y += data.speed * ORBIT_SPEED_SCALE * dt;
      }
      mesh.rotation.y += (1 / data.radius) * SELF_SPIN_SCALE * dt;
      if (data._moonPivot) {
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

    // ---- the "Align Planets" tween overrides the normal per-frame
    // increments above with an eased interpolation instead ----
    if (AppState.alignTween) {
      const t = Math.min(1, (performance.now() - AppState.alignTween.startTime) / AppState.alignTween.duration);
      const eased = easeInOutCubic(t);
      AppState.alignTween.items.forEach(({ pivot, start, delta }) => {
        pivot.rotation.y = start + delta * eased;
      });
      if (t >= 1) AppState.alignTween = null;
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

  // Camera focus. Desktop keeps following the target; in an XR session this
  // instead steps the one-shot rig fly-to. See interaction/focus.js.
  updateFocus();

  // OrbitControls is meaningless during an XR session — the headset owns the
  // camera — and sessionManager disables it on session start, but this guard
  // means the loop is correct on its own terms regardless.
  if (!AppState.xrSession) controls.update();
  renderer.render(scene, camera);
}

animate();
