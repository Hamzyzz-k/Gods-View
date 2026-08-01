import { AppState } from "../core/state.js";
import { sceneRegistry } from "../assistant/sceneRegistry.js";
import { issProxyMesh } from "../scene/planetFactory.js";
import { focusOnObject } from "../interaction/focus.js";
import { orbitLines } from "../scene/planetFactory.js";
const { controls } = AppState;

// ---------- UI controls ----------
export let speedMultiplier = 1;
export let paused = false;

export const speedSlider = document.getElementById("speed");
export const speedVal = document.getElementById("speedVal");
speedSlider.addEventListener("input", () => {
  speedMultiplier = parseFloat(speedSlider.value);
  speedVal.textContent = speedMultiplier.toFixed(1) + "x";
});

export const pauseBtn = document.getElementById("pauseBtn");
pauseBtn.addEventListener("click", () => {
  paused = !paused;
  pauseBtn.textContent = paused ? "Resume" : "Pause";
});

export const orbitBtn = document.getElementById("orbitBtn");
orbitBtn.addEventListener("click", () => {
  AppState.orbitLinesVisible = !AppState.orbitLinesVisible;
  orbitLines.forEach((l) => (l.visible = AppState.orbitLinesVisible));
});

export const moonsBtn = document.getElementById("moonsBtn");
export let moonsVisible = true;
moonsBtn?.addEventListener("click", () => {
  moonsVisible = !moonsVisible;
  sceneRegistry.moons.setVisible(moonsVisible);
});

export const constellationBtn = document.getElementById("constellationBtn");
export let constellationsVisible = true;
constellationBtn?.addEventListener("click", () => {
  constellationsVisible = !constellationsVisible;
  sceneRegistry.constellations.setVisible(constellationsVisible);
});

export const issBtn = document.getElementById("issBtn");
issBtn?.addEventListener("click", () => {
  if (!issProxyMesh) return;
  sceneRegistry.earth?.setVisible(true);
  sceneRegistry.iss?.setVisible(true);
  focusOnObject(issProxyMesh);
});
