import * as THREE from "three";

// ---------- reusable canvas-texture-on-a-plane panel ----------
// Regular HTML/CSS does not render inside an active WebXR session — the DOM
// overlay path WebXR does offer is AR-only — so every in-world surface here
// is the same trick already used throughout this app for planet textures and
// constellation labels: draw onto an offscreen <canvas>, wrap it in a
// CanvasTexture, put that on a plane. Nothing new, just pointed at UI instead
// of terrain.
//
// Color tokens match the desktop panels' CSS (style.css) so the VR and
// desktop UI read as the same design rather than two different apps.
export const COLORS = {
  bg: "rgba(10,12,24,0.90)",
  border: "rgba(255,255,255,0.16)",
  text: "rgba(255,255,255,0.92)",
  textDim: "rgba(255,255,255,0.6)",
  blue: "#7ab8ff",
  gold: "#ffd27a",
  purple: "#b98bff",
  pillBg: "rgba(255,255,255,0.08)",
  pillBgActive: "rgba(122,184,255,0.28)",
  pillBorder: "rgba(255,255,255,0.18)",
};

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export class VRPanel {
  // worldWidth/worldHeight are in scene units (the same units planet radii
  // are in); canvasWidth/canvasHeight are pixels for the backing texture.
  // A higher canvas resolution buys crisper text at the cost of a bigger
  // texture upload on every redraw — 3-4x the plane's rendered pixel size at
  // a normal viewing distance is plenty, so panels here stay well under 1600px.
  constructor({ worldWidth, worldHeight, canvasWidth = 1024, canvasHeight = null }) {
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight ?? worldWidth * 0.6;
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight ?? Math.round(canvasWidth * (this.worldHeight / this.worldWidth));

    this.canvas = document.createElement("canvas");
    this.canvas.width = this.canvasWidth;
    this.canvas.height = this.canvasHeight;
    this.ctx = this.canvas.getContext("2d");

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace; // matches every other drawn-texture in this app

    this.geometry = new THREE.PlaneGeometry(this.worldWidth, this.worldHeight);
    this.material = new THREE.MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      depthWrite: false, // a see-through panel shouldn't occlude what's behind it in the depth buffer
    });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.visible = false;
    this.mesh.userData.vrPanel = this; // lets raycast hit-testing map a Mesh back to its panel
  }

  markDirty() {
    this.texture.needsUpdate = true;
  }

  // Converts a raycaster intersection's UV (0..1, origin bottom-left, three.js
  // convention for PlaneGeometry) into canvas pixel coordinates (origin
  // top-left, canvas convention) so hit-testing can compare against the same
  // pixel rectangles the drawing code used.
  uvToCanvasPx(uv) {
    return { x: uv.x * this.canvasWidth, y: (1 - uv.y) * this.canvasHeight };
  }
}
