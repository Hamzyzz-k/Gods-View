import { AppState } from "../core/state.js";
import { sceneRegistry } from "../assistant/sceneRegistry.js";
import { issProxyMesh } from "../scene/planetFactory.js";
import { locateAndFocus } from "../interaction/locate.js";
import { stepMoveSpeed, getMoveSpeedLabel, canStepMoveSpeed } from "../core/moveSpeed.js";
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

// ---------- flight speed ----------
// The player's movement speed, not the simulation rate the slider above
// controls. These are the real DOM buttons the VR control panel dispatches
// clicks on (xr/vrControlPanel.js), so both surfaces drive the same value
// through the same path — the contract every other VR control already uses.
export const moveSpeedDownBtn = document.getElementById("moveSpeedDownBtn");
export const moveSpeedUpBtn = document.getElementById("moveSpeedUpBtn");
const moveSpeedVal = document.getElementById("moveSpeedVal");

function syncMoveSpeedUI() {
  if (moveSpeedVal) moveSpeedVal.textContent = getMoveSpeedLabel();
  // Disabled at the ends rather than wrapping, matching stepMoveSpeed()'s
  // clamp — and it's what tells the VR panel to grey the button out too,
  // since that reads this same disabled state.
  if (moveSpeedDownBtn) moveSpeedDownBtn.disabled = !canStepMoveSpeed(-1);
  if (moveSpeedUpBtn) moveSpeedUpBtn.disabled = !canStepMoveSpeed(1);
}

moveSpeedDownBtn?.addEventListener("click", () => { stepMoveSpeed(-1); syncMoveSpeedUI(); });
moveSpeedUpBtn?.addEventListener("click", () => { stepMoveSpeed(1); syncMoveSpeedUI(); });
syncMoveSpeedUI();

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
  // Routed through the tier-aware locator rather than focusing directly: the
  // ISS only exists in the solar-system scene, so pressing this from any
  // other tier used to lerp the view toward its coordinates inside a scene
  // that wasn't being rendered. locateAndFocus() hops tiers first when it
  // needs to (interaction/locate.js).
  locateAndFocus(issProxyMesh);
});
