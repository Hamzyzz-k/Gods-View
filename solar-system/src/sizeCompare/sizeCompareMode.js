import * as THREE from "three";
import { AppState } from "../core/state.js";
import { SIZE_COMPARE_STOPS } from "./sizeCompareData.js";
import { buildStopContent } from "./sizeCompareScene.js";

// ---------- size-compare mode ----------
// A full-scene takeover (per the approved plan): while open, core/loop.js's
// render call swaps AppState.activeScene to a dedicated scene built here,
// the same "swap what gets rendered, leave the orbital sim running quietly
// underneath" trick cosmic tiers and Surface Mode already use — nothing
// downstream needs to know or resync when this closes. Reuses the app's
// single existing AppState.camera (just repositioned) rather than a second
// camera object, so core/loop.js's render() call needs no changes.
//
// Manual Prev/Next only — no auto-dwell timer, unlike Guided Tour
// (tour/tourMode.js), per the approved plan's explicit choice.

const scene = new THREE.Scene();
scene.name = "sizeCompareScene";
scene.add(new THREE.AmbientLight(0x445566, 0.9));
scene.add(new THREE.PointLight(0xffffff, 1.2, 0, 0));

let stepIndex = 0;
let currentGroup = null;
let saved = null; // { activeScene, cameraPos, controlsTarget, controlsEnabled, rigParent, rigPos }

function clearScene() {
  if (currentGroup) {
    scene.remove(currentGroup);
    currentGroup = null;
  }
}

function renderStep() {
  clearScene();
  const stop = SIZE_COMPARE_STOPS[stepIndex];
  const { group, reuseMainScene, cameraDistance, cameraHeight } = buildStopContent(stop);

  if (reuseMainScene) {
    AppState.activeScene = AppState.scene;
  } else {
    currentGroup = group;
    scene.add(group);
    AppState.activeScene = scene;
  }

  const { camera, controls } = AppState;
  const target = new THREE.Vector3(0, cameraHeight || 0, 0);
  camera.position.set(0, (cameraHeight || 0) + cameraDistance * 0.28, cameraDistance);
  if (!AppState.xrSession) {
    controls.target.copy(target);
    controls.enabled = true;
    controls.update();
  }

  updateChrome();
}

function updateChrome() {
  const stop = SIZE_COMPARE_STOPS[stepIndex];
  const titleEl = document.getElementById("sizeCompareTitle");
  const stepEl = document.getElementById("sizeCompareStepLabel");
  const prevBtn = document.getElementById("sizeComparePrevBtn");
  const nextBtn = document.getElementById("sizeCompareNextBtn");
  if (titleEl) titleEl.textContent = stop.title;
  if (stepEl) stepEl.textContent = `${stepIndex + 1} / ${SIZE_COMPARE_STOPS.length}`;
  if (prevBtn) prevBtn.disabled = stepIndex <= 0;
  if (nextBtn) nextBtn.disabled = stepIndex >= SIZE_COMPARE_STOPS.length - 1;
}

export function isSizeCompareOpen() {
  return AppState.sizeCompareOpen;
}

export function startSizeCompare() {
  if (AppState.sizeCompareOpen) return;
  const { camera, controls, rig } = AppState;
  saved = {
    activeScene: AppState.activeScene,
    cameraPos: camera.position.clone(),
    controlsTarget: controls.target.clone(),
    controlsEnabled: controls.enabled,
    rigParent: rig?.parent || null,
  };

  AppState.sizeCompareOpen = true;
  stepIndex = 0;
  if (rig && !AppState.xrSession) {
    // Desktop doesn't move the rig at all normally (identity transform —
    // see core/sceneSetup.js), but reparenting it alongside the camera
    // keeps it consistent with wherever activeScene points, the same
    // invariant tier navigation already maintains.
    scene.add(rig);
  } else if (rig && AppState.xrSession) {
    scene.add(rig); // real VR reparent — lets the player walk the diorama in stereo depth
  }

  document.getElementById("sizeCompareBar")?.classList.add("visible");
  renderStep();
}

export function exitSizeCompare() {
  if (!AppState.sizeCompareOpen) return;
  AppState.sizeCompareOpen = false;
  clearScene();

  const { camera, controls, rig } = AppState;
  AppState.activeScene = saved.activeScene;
  camera.position.copy(saved.cameraPos);
  controls.target.copy(saved.controlsTarget);
  controls.enabled = saved.controlsEnabled;
  controls.update();
  if (rig && saved.rigParent) saved.rigParent.add(rig);

  saved = null;
  document.getElementById("sizeCompareBar")?.classList.remove("visible");
}

export function nextStep() {
  if (!AppState.sizeCompareOpen || stepIndex >= SIZE_COMPARE_STOPS.length - 1) return;
  stepIndex++;
  renderStep();
}

export function prevStep() {
  if (!AppState.sizeCompareOpen || stepIndex <= 0) return;
  stepIndex--;
  renderStep();
}

export function toggleSizeCompare() {
  if (AppState.sizeCompareOpen) exitSizeCompare();
  else startSizeCompare();
}

export function getCurrentStop() {
  return SIZE_COMPARE_STOPS[stepIndex];
}

export function getStepInfo() {
  return { index: stepIndex, total: SIZE_COMPARE_STOPS.length };
}

const openBtn = document.getElementById("sizeCompareBtn");
const prevBtn = document.getElementById("sizeComparePrevBtn");
const nextBtn = document.getElementById("sizeCompareNextBtn");
const exitBtn = document.getElementById("sizeCompareExitBtn");

export function initSizeCompareMode() {
  openBtn?.addEventListener("click", toggleSizeCompare);
  prevBtn?.addEventListener("click", prevStep);
  nextBtn?.addEventListener("click", nextStep);
  exitBtn?.addEventListener("click", exitSizeCompare);
}
