import * as THREE from "three";
import { getTexture, issPanelTexture } from "../textures/proceduralTextures.js";

export function createISSModel() {
  const group = new THREE.Group();

  const trussMat = new THREE.MeshStandardMaterial({ color: 0xd8d8dc, metalness: 0.7, roughness: 0.35 });
  const moduleMat = new THREE.MeshStandardMaterial({ color: 0xe4dcc8, metalness: 0.3, roughness: 0.5 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xcf9d4f, metalness: 0.6, roughness: 0.4 });
  const panelMat = new THREE.MeshStandardMaterial({
    map: getTexture("ISSPanel", () => issPanelTexture(128, 64)),
    color: 0x6f9fd8,
    metalness: 0.2,
    roughness: 0.5,
    side: THREE.DoubleSide,
  });
  const radiatorMat = new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.6 });

  // central integrated truss
  const truss = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.09, 0.09), trussMat);
  group.add(truss);

  // pressurized module cluster (stand-in for Unity/Zarya/Zvezda)
  const moduleGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.55, 12);
  [-1, 0, 1].forEach((i) => {
    const m = new THREE.Mesh(moduleGeo, i === 0 ? goldMat : moduleMat);
    m.rotation.z = Math.PI / 2;
    m.position.set(i * 0.35, -0.15, 0);
    group.add(m);
  });

  // four solar-array wings, two pairs near each end of the truss
  [-1.05, 1.05].forEach((x) => {
    [-1, 1].forEach((side) => {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.55, 1.3), panelMat);
      wing.position.set(x, 0, side * 0.75);
      group.add(wing);
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 6), trussMat);
      mast.rotation.x = Math.PI / 2;
      mast.position.set(x, 0, side * 0.15);
      group.add(mast);
    });
  });

  // radiator panels along the truss
  [-0.55, 0.55].forEach((x) => {
    const rad = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.02), radiatorMat);
    rad.position.set(x, 0.15, 0);
    group.add(rad);
  });

  group.scale.setScalar(0.42); // keep it small and subtle next to Earth
  return group;
}

