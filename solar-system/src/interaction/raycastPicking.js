import * as THREE from "three";
import { AppState } from "../core/state.js";
import { sun } from "../scene/sun.js";
import { planets, allMoonMeshes, earthEntry, issProxyMesh } from "../scene/planetFactory.js";
import { focusOnObject } from "./focus.js";
const { camera } = AppState;

// ---------- raycasting: hover + click ----------
export const raycaster = new THREE.Raycaster();
export const pointer = new THREE.Vector2();
export const tooltip = document.getElementById("tooltip");

export const clickableMeshes = [sun, ...planets.map((p) => p.mesh), ...allMoonMeshes];

if (issProxyMesh) clickableMeshes.push(issProxyMesh);



export function onPointerMove(event) {
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(pointer, camera);
  const intersects = raycaster.intersectObjects(clickableMeshes, false);

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
  const intersects = raycaster.intersectObjects(clickableMeshes, false);
  if (intersects.length > 0) {
    focusOnObject(intersects[0].object);
  }
}

window.addEventListener("pointermove", onPointerMove);
window.addEventListener("click", onClick);
