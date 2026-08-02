import * as THREE from "three";
import { AppState } from "./state.js";
import { sun } from "../scene/sun.js";
import { planets, earthEntry } from "../scene/planetFactory.js";
import { ORBIT_SPEED_SCALE, SELF_SPIN_SCALE, ISS_ORBIT_SPEED } from "../scene/planetData.js";
import { asteroidBelt } from "../scene/asteroidBelt.js";
import { paused, speedMultiplier } from "../ui/desktopControls.js";
import { updateFocus } from "../interaction/focus.js";
import { updateLocomotion } from "../xr/locomotion.js";
import { updateControllerRaycast } from "../xr/controllerRaycast.js";
import { updateVrControlPanel } from "../xr/vrControlPanel.js";
import { updateVrInfoPanel } from "../xr/vrInfoPanel.js";
import {
  checkPlanetAlignments, checkEclipse, easeInOutCubic,
  ECLIPSE_MOON_COLOR, lunarEclipseActive,
  sunLightTargetIntensity, ambientTargetIntensity,
} from "../scene/alignmentsAndEclipses.js";
const { scene, camera, renderer, controls, sunLight, ambient, rig } = AppState;

// ---------- animation loop ----------
export const clock = new THREE.Clock();

// Note there is no requestAnimationFrame call in here. The loop is driven by
// renderer.setAnimationLoop() at the bottom of this file, which is required
// for WebXR: once a session starts, frames must be scheduled by the headset's
// own XR frame loop (which runs at the device's refresh rate, e.g. 72/90/120Hz
// and continues while the browser tab is not the foreground page), not by the
// window's rAF. Outside a session three.js drives this with rAF internally,
// so desktop timing is unchanged.
export function animate() {
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

  if (AppState.xrSession) {
    // The renderer updates the camera and controllers' LOCAL transforms from
    // this frame's XR pose before our callback runs, but WORLD matrices
    // (matrixWorld) are otherwise only propagated inside renderer.render() —
    // which runs at the end of this function, after locomotion/raycasting
    // below have already read camera/controller world position and
    // orientation. Forcing it here rather than trusting undocumented
    // three.js internal ordering is what makes those reads reliably current
    // for this frame instead of one frame stale.
    rig.updateMatrixWorld(true);

    // Player-driven flight. Uses the raw, unscaled delta rather than the
    // simulation's speedMultiplier-scaled dt above — movement speed is a
    // property of the player, not of how fast the planets are orbiting, and
    // this must keep working even while the simulation is paused.
    updateLocomotion(delta);

    // Rig may have just moved/turned (locomotion) or eased toward a focus
    // target (below) — re-propagate so this frame's raycast uses the
    // controllers' post-movement transforms, not their pre-movement ones.
    rig.updateMatrixWorld(true);
    updateControllerRaycast();
  }

  // Both panel updates run every frame, not just while AppState.xrSession is
  // true — each checks that flag internally and hides itself when it's
  // false, the same pattern updateFocus() below already uses. Gating the
  // CALL itself behind xrSession (as an earlier version did) meant that once
  // a session ended, these functions never ran again at all, so their own
  // "hide when not in session" logic never got a chance to execute: the
  // panels stayed visible with mesh.visible stuck at whatever it was the
  // instant the session ended. sessionManager resets the rig to world
  // origin on exit, and both panels are rig/scene-anchored near it, so this
  // was not just an inert flag — a leftover-visible control panel would
  // actually render floating in the middle of the desktop 3D scene, near
  // the Sun, until the player entered VR again.
  updateVrControlPanel();

  // Camera focus. Desktop keeps following the target; in an XR session this
  // instead steps the one-shot rig fly-to. See interaction/focus.js.
  updateFocus();
  if (AppState.xrSession) rig.updateMatrixWorld(true); // focus may have moved the rig again just above
  updateVrInfoPanel();

  // OrbitControls is meaningless during an XR session — the headset owns the
  // camera — and sessionManager disables it on session start, but this guard
  // means the loop is correct on its own terms regardless.
  if (!AppState.xrSession) controls.update();
  renderer.render(scene, camera);
}

// Starts the loop, and hands frame scheduling to the XR device automatically
// whenever a session is active. Passing the function here (rather than calling
// animate() once and self-scheduling with rAF) is what makes VR possible at
// all — three.js swaps the underlying scheduler on session start/end for us.
renderer.setAnimationLoop(animate);
