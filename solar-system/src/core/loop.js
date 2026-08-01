import * as THREE from "three";
import { AppState } from "./state.js";
import { sun } from "../scene/sun.js";
import { planets, earthEntry } from "../scene/planetFactory.js";
import { ORBIT_SPEED_SCALE, SELF_SPIN_SCALE, ISS_ORBIT_SPEED } from "../scene/planetData.js";
import { asteroidBelt } from "../scene/asteroidBelt.js";
import { paused, speedMultiplier } from "../ui/desktopControls.js";
import {
  checkPlanetAlignments, checkEclipse, easeInOutCubic, alignTween,
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
      if (!(alignTween && alignTween.pivots.has(pivot))) {
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
    if (alignTween) {
      const t = Math.min(1, (performance.now() - alignTween.startTime) / alignTween.duration);
      const eased = easeInOutCubic(t);
      alignTween.items.forEach(({ pivot, start, delta }) => {
        pivot.rotation.y = start + delta * eased;
      });
      if (t >= 1) alignTween = null;
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

  if (AppState.focusedTarget) {
    const worldPos = new THREE.Vector3();
    AppState.focusedTarget.getWorldPosition(worldPos);
    controls.target.lerp(worldPos, 0.08);

    if (AppState.desiredZoomDistance !== null) {
      const currentDir = new THREE.Vector3()
        .subVectors(camera.position, controls.target)
        .normalize();
      const desiredPos = new THREE.Vector3()
        .copy(worldPos)
        .add(currentDir.multiplyScalar(AppState.desiredZoomDistance));
      camera.position.lerp(desiredPos, 0.05);
    }
  }

  controls.update();
  renderer.render(scene, camera);
}

animate();
