import * as THREE from "three";
import { AppState } from "../core/state.js";
import { clickableMeshes } from "../interaction/raycastPicking.js";
import { focusOnObject } from "../interaction/focus.js";

// ---------- VR controller laser-pointer picking ----------
// Reuses the exact same clickableMeshes array desktop mouse-picking already
// raycasts against (interaction/raycastPicking.js), plus every registered
// panel mesh, so a controller's laser can hit either a body to focus or a
// button to press with one raycast.
//
// Desktop's hover feedback is a cursor change + tooltip; there's no cursor
// in VR, so the laser itself recolors on hover instead — gold over a
// focusable body, blue over a pressable button — as the direct equivalent.

const LASER_COLOR_IDLE = 0xffffff;
const LASER_COLOR_HOVER_BODY = 0xffd27a; // matches COLORS.gold in vrPanel.js
const LASER_COLOR_HOVER_BUTTON = 0x7ab8ff; // matches COLORS.blue
const LASER_MAX_LENGTH = 40; // scene units, when nothing is hit

// A small registry rather than one hardcoded panel: originally just the
// control panel, now also the info panel's in-world Land button (Phase D),
// and the VR tour panel (Phase F) joins the same way. Each entry is
// { mesh, getHitRects(): [{domId,x,y,w,h}], uvToCanvasPx(uv), afterClick?() }.
// Populated once at startup via registerPanel(), before the frame loop
// starts, so raycastTargets below only needs building once, not every frame.
const registeredPanels = [];
const raycastTargets = [...clickableMeshes];

export function registerPanel(panel) {
  registeredPanels.push(panel);
  raycastTargets.push(panel.mesh);
}

function panelFor(mesh) {
  return registeredPanels.find((p) => p.mesh === mesh) || null;
}

// One raycaster reused for both controllers — they're processed one after
// another within the same frame, never concurrently, so there's no risk of
// one controller's in-progress raycast being clobbered by the other's.
const _raycaster = new THREE.Raycaster();
const _origin = new THREE.Vector3();
const _direction = new THREE.Vector3();

function makeLaser() {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array([0, 0, 0, 0, 0, -LASER_MAX_LENGTH]);
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  const material = new THREE.LineBasicMaterial({ color: LASER_COLOR_IDLE, transparent: true, opacity: 0.85 });
  const line = new THREE.Line(geometry, material);
  line.frustumCulled = false; // its bounding sphere is degenerate/stale as the endpoint moves every frame; cheap enough to always draw
  return line;
}

function setLaserLength(laser, length) {
  laser.geometry.attributes.position.setZ(1, -length);
  laser.geometry.attributes.position.needsUpdate = true;
}

function findHitButton(panel, uv) {
  const { x, y } = panel.uvToCanvasPx(uv);
  return panel.getHitRects().find((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) || null;
}

function updateController(controller) {
  const laser = controller.userData.laser;
  controller.getWorldPosition(_origin);
  _direction.set(0, 0, -1).transformDirection(controller.matrixWorld);
  _raycaster.set(_origin, _direction);

  const hits = _raycaster.intersectObjects(raycastTargets, false);
  controller.userData.hoveredBody = null;
  controller.userData.hoveredButton = null;
  controller.userData.hoveredPanel = null;

  if (hits.length === 0) {
    setLaserLength(laser, LASER_MAX_LENGTH);
    laser.material.color.setHex(LASER_COLOR_IDLE);
    return;
  }

  const hit = hits[0];
  setLaserLength(laser, hit.distance);

  const panel = panelFor(hit.object);
  if (panel) {
    const button = hit.uv ? findHitButton(panel, hit.uv) : null;
    controller.userData.hoveredButton = button;
    controller.userData.hoveredPanel = panel;
    laser.material.color.setHex(button ? LASER_COLOR_HOVER_BUTTON : LASER_COLOR_IDLE);
  } else {
    controller.userData.hoveredBody = hit.object;
    laser.material.color.setHex(LASER_COLOR_HOVER_BODY);
  }
}

function onSelectStart(event) {
  const controller = event.target;
  const button = controller.userData.hoveredButton;
  const panel = controller.userData.hoveredPanel;
  const body = controller.userData.hoveredBody;

  if (button) {
    document.getElementById(button.domId)?.click();
    // Not every button's click handler mutates its own DOM (see the comment
    // in vrControlPanel.js on which ones don't), so this can't rely solely
    // on a MutationObserver to know something changed.
    panel?.afterClick?.();
  } else if (body) {
    focusOnObject(body);
  }
}

// Called once at startup, after locomotion.js has already acquired and
// parented these same controller objects — three.js's getController(index)
// returns the same cached XRTargetRaySpace on every call for a given index,
// so this attaches to the identical objects rather than creating duplicates.
export function initControllerRaycast() {
  const { renderer } = AppState;
  [renderer.xr.getController(0), renderer.xr.getController(1)].forEach((controller) => {
    const laser = makeLaser();
    controller.userData.laser = laser;
    controller.add(laser);
    controller.addEventListener("selectstart", onSelectStart);
  });
}

// Called once per frame, only while a session is active.
export function updateControllerRaycast() {
  const { renderer } = AppState;
  updateController(renderer.xr.getController(0));
  updateController(renderer.xr.getController(1));
}
