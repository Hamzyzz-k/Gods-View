import * as THREE from "three";
import { makeCanvas, blobLayer, noiseGrain } from "../textures/proceduralTextures.js";

// ---------- Observable Universe tier content ----------
// The finale tier. Stylized, same bar as every other tier: a cosmic-web
// filament lattice standing in for the real large-scale structure survey
// maps (galaxy clusters aren't scattered randomly — they trace filaments
// around vast voids, the way this app already represents everything else
// it can't render at true scale or true galaxy-count), plus a Cosmic
// Microwave Background shell at the outer boundary — the closest thing to
// an "edge" of the observable universe, the relic light from ~380,000
// years after the Big Bang.

export const WEB_RADIUS = 8000;
const NODE_COUNT = 220;
const LINKS_PER_NODE = 2;
const MAX_LINK_DIST = 1400;

function buildCosmicWeb() {
  const nodes = [];
  for (let i = 0; i < NODE_COUNT; i++) {
    const r = Math.pow(Math.random(), 0.6) * WEB_RADIUS;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    nodes.push(new THREE.Vector3(
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.sin(phi) * Math.sin(theta) * 0.6, // flattened slightly — a loose slice through the structure, not a perfect sphere
      r * Math.cos(phi)
    ));
  }

  // Filaments: each node links to its couple of nearest neighbors within
  // range, rather than every pair — real large-scale structure is sparse
  // strands around voids, not a dense uniform mesh.
  const linePositions = [];
  nodes.forEach((a, i) => {
    const nearest = nodes
      .map((b, j) => (i === j ? null : { d: a.distanceTo(b), j }))
      .filter(Boolean)
      .sort((x, y) => x.d - y.d)
      .slice(0, LINKS_PER_NODE);
    nearest.forEach(({ d, j }) => {
      if (d < MAX_LINK_DIST) {
        linePositions.push(a.x, a.y, a.z, nodes[j].x, nodes[j].y, nodes[j].z);
      }
    });
  });

  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(linePositions), 3));
  const lineMat = new THREE.LineBasicMaterial({ color: 0x6a7fd8, transparent: true, opacity: 0.35 });
  const filaments = new THREE.LineSegments(lineGeo, lineMat);
  filaments.name = "cosmicWebFilaments";

  const nodePositions = new Float32Array(nodes.length * 3);
  nodes.forEach((n, i) => {
    nodePositions[i * 3] = n.x;
    nodePositions[i * 3 + 1] = n.y;
    nodePositions[i * 3 + 2] = n.z;
  });
  const pointGeo = new THREE.BufferGeometry();
  pointGeo.setAttribute("position", new THREE.BufferAttribute(nodePositions, 3));
  const pointMat = new THREE.PointsMaterial({ color: 0xffe8c0, size: 30, sizeAttenuation: true, transparent: true, opacity: 0.85, depthWrite: false });
  const clusters = new THREE.Points(pointGeo, pointMat);
  clusters.name = "cosmicWebClusters";

  const group = new THREE.Group();
  group.name = "cosmicWeb";
  group.add(filaments);
  group.add(clusters);
  return group;
}

function buildCmbCanvas() {
  const w = 1024, h = 512;
  const canvas = makeCanvas(w, h);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "hsl(220,40%,15%)";
  ctx.fillRect(0, 0, w, h);
  // The mottled orange/blue speckle of a real CMB all-sky map (WMAP/Planck)
  // — hot and cold spots in the relic radiation's temperature variation.
  blobLayer(ctx, w, h, { count: 500, hue: 30, sat: 60, lightRange: [40, 60], radiusRange: [4, 14], alpha: 0.35 });
  blobLayer(ctx, w, h, { count: 500, hue: 220, sat: 50, lightRange: [15, 30], radiusRange: [4, 14], alpha: 0.35 });
  noiseGrain(ctx, w, h, 20);
  return canvas;
}

function buildCmbShell() {
  const geo = new THREE.SphereGeometry(WEB_RADIUS * 1.1, 32, 24);
  const tex = new THREE.CanvasTexture(buildCmbCanvas());
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false, depthWrite: false });
  const shell = new THREE.Mesh(geo, mat);
  shell.name = "cmbShell";
  return shell;
}

export function buildObservableUniverseBackdrop() {
  const group = new THREE.Group();
  group.name = "observableUniverseBackdrop";
  group.add(buildCmbShell());
  group.add(buildCosmicWeb());
  return group;
}
