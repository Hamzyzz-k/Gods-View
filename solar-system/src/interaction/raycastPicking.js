import * as THREE from "three";
import { AppState } from "../core/state.js";
import { sun } from "../scene/sun.js";
import { planets, allMoonMeshes, earthEntry, issProxyMesh } from "../scene/planetFactory.js";
import { focusOnObject } from "./focus.js";
import { getSurfaceData } from "../surface/surfaceData.js";
import { enterSurface } from "../surface/surfaceMode.js";
const { camera } = AppState;

// ---------- raycasting: hover + click ----------
export const raycaster = new THREE.Raycaster();
export const pointer = new THREE.Vector2();
export const tooltip = document.getElementById("tooltip");

export const clickableMeshes = [sun, ...planets.map((p) => p.mesh), ...allMoonMeshes];

if (issProxyMesh) clickableMeshes.push(issProxyMesh);

// Per-tier pickable sets — desktop raycasting and the VR laser
// (xr/controllerRaycast.js) both only test the ACTIVE tier's meshes, so
// clicking through to a body that isn't even in the scene currently on
// screen (cosmos/tierNavigation.js) is structurally impossible rather than
// merely unlikely. The solar system's set is exactly the array above;
// every other tier registers its own via registerTierClickables() as its
// content is built (see cosmos/galaxyFactory.js).
const tierClickables = new Map();
tierClickables.set("solarSystem", clickableMeshes);
export function registerTierClickables(tierId, meshes) {
  tierClickables.set(tierId, meshes);
}
export function activeClickables() {
  return tierClickables.get(AppState.tier) || [];
}

export function onPointerMove(event) {
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(pointer, camera);
  const intersects = raycaster.intersectObjects(activeClickables(), false);

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


// Click-to-select. Registered here (rather than in focus.js) because the
// raycaster, pointer and clickableMeshes it needs all live in this module;
// focus.js only owns what happens *after* something is picked.
export function onClick(event) {
  raycaster.setFromCamera(pointer, camera);
  const intersects = raycaster.intersectObjects(activeClickables(), false);
  if (intersects.length > 0) {
    focusOnObject(intersects[0].object);
  }
}

// Double-click to land on a planet's surface. A single click keeps its
// existing focus behavior above (this fires in addition to two click events,
// not instead of them — the info panel opens as normal and then Surface
// Mode takes over). Landable bodies are the 9 planets in
// surface/surfaceData.js; double-clicking the Sun, a moon, or the ISS is a
// no-op rather than an error, since none of those have a surface scene.
// Guarded to orbital mode only — there is nothing double-clickable while
// already walking on a surface, and the pointer is likely lock-captured
// there besides.
export function onDoubleClick(event) {
  // Desktop-only trigger. VR has no double-click gesture and uses a
  // dedicated Land button on the in-world info panel instead (Phase D) — if
  // a VR session happens to be active on a device that also has a mouse
  // (Quest Link, an emulator with mouse passthrough), this stays out of its way.
  // Also solar-system-tier only: landing only makes sense on one of the 9
  // planets, which only exist in that tier's clickable set (cosmos/
  // tierNavigation.js) — explicit here rather than relying on that set
  // incidentally being empty at other tiers.
  if (AppState.mode !== "orbital" || AppState.xrSession || AppState.tier !== "solarSystem") return;
  raycaster.setFromCamera(pointer, camera);
  const intersects = raycaster.intersectObjects(activeClickables(), false);
  if (intersects.length === 0) return;
  const obj = intersects[0].object;
  if (getSurfaceData(obj.name)) enterSurface(obj.name);
}

window.addEventListener("pointermove", onPointerMove);
window.addEventListener("click", onClick);
window.addEventListener("dblclick", onDoubleClick);
