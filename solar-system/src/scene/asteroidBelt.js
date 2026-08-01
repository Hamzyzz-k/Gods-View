import * as THREE from "three";
import { rand } from "../textures/proceduralTextures.js";
import { planetData } from "./planetData.js";
import { AppState } from "../core/state.js";
const { scene } = AppState;

// ---------- main asteroid belt (decorative — sits between Mars and Jupiter) ----------
// This is NOT live data, just a dense instanced field for visual realism;
// the live NASA rocks (below) are the near-Earth ones you can click for info.
export let asteroidBelt = null;

export function createAsteroidBelt() {
  const mars = planetData.find((p) => p.name === "Mars").distance; // 31
  const jupiter = planetData.find((p) => p.name === "Jupiter").distance; // 42
  const innerR = mars + 3;
  const outerR = jupiter - 2;
  const midR = (innerR + outerR) / 2;
  const halfSpan = (outerR - innerR) / 2;
  const count = 2200;

  const geo = new THREE.IcosahedronGeometry(1, 0);
  const mat = new THREE.MeshStandardMaterial({ color: 0x9a8f80, roughness: 1, metalness: 0 });
  const mesh = new THREE.InstancedMesh(geo, mat, count);

  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const r = rand(innerR, outerR);
    const theta = rand(0, Math.PI * 2);
    const thickness = 1.3 * (1 - Math.abs(r - midR) / halfSpan); // thicker mid-belt, thinner at edges
    const y = rand(-thickness, thickness);
    dummy.position.set(Math.cos(theta) * r, y, Math.sin(theta) * r);
    dummy.rotation.set(rand(0, Math.PI), rand(0, Math.PI), rand(0, Math.PI));
    dummy.scale.setScalar(rand(0.05, 0.32));
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    color.setHSL(0.08, 0.12, rand(0.32, 0.55));
    mesh.setColorAt(i, color);
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  scene.add(mesh);
  asteroidBelt = mesh;
}
createAsteroidBelt();
