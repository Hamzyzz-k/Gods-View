import * as THREE from "three";

export function createStarfield(scene) {
  const starGeo = new THREE.BufferGeometry();
  const starCount = 6000;
  const positions = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const r = 900 * Math.random() + 200;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);
  }
  starGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const starMat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 1.1,
    sizeAttenuation: true,
  });
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);
  return stars;
}

// ---------- background constellations ----------
// Faint stick-figure constellations drawn on the celestial sphere, in the
// spirit of NASA's Eyes on the Solar System background. Star positions are
// real (approximate) right-ascension/declination coordinates for each
// constellation's brightest stars; `lines` connects star indices into the
// familiar stick-figure asterism. Purely decorative — not tied to any real
// date/time, so it doesn't attempt to match tonight's actual sky.
const CONSTELLATIONS = [
  { name: "Ursa Major", stars: [
      { ra: 11.03, dec: 61.75 }, { ra: 11.03, dec: 56.38 }, { ra: 11.90, dec: 53.70 },
      { ra: 12.25, dec: 57.03 }, { ra: 12.90, dec: 55.96 }, { ra: 13.40, dec: 54.93 },
      { ra: 13.79, dec: 49.31 },
    ], lines: [[0,1],[1,2],[2,3],[3,0],[3,4],[4,5],[5,6]] },
  { name: "Orion", stars: [
      { ra: 5.92, dec: 7.41 }, { ra: 5.42, dec: 6.35 }, { ra: 5.53, dec: -0.30 },
      { ra: 5.60, dec: -1.20 }, { ra: 5.68, dec: -1.94 }, { ra: 5.80, dec: -9.67 },
      { ra: 5.24, dec: -8.20 },
    ], lines: [[0,3],[1,2],[2,3],[3,4],[4,5],[2,6]] },
  { name: "Cassiopeia", stars: [
      { ra: 0.15, dec: 59.15 }, { ra: 0.67, dec: 56.54 }, { ra: 0.95, dec: 60.72 },
      { ra: 1.43, dec: 60.24 }, { ra: 1.91, dec: 63.67 },
    ], lines: [[0,1],[1,2],[2,3],[3,4]] },
  { name: "Leo", stars: [
      { ra: 10.14, dec: 11.97 }, { ra: 10.33, dec: 19.84 }, { ra: 11.24, dec: 20.52 },
      { ra: 11.24, dec: 15.43 }, { ra: 11.82, dec: 14.57 },
    ], lines: [[0,1],[1,2],[2,3],[3,0],[3,4]] },
  { name: "Scorpius", stars: [
      { ra: 16.09, dec: -19.80 }, { ra: 16.00, dec: -22.62 }, { ra: 16.49, dec: -26.43 },
      { ra: 17.62, dec: -42.99 }, { ra: 17.56, dec: -37.10 },
    ], lines: [[0,1],[1,2],[2,4],[4,3]] },
  { name: "Cygnus", stars: [
      { ra: 20.69, dec: 45.28 }, { ra: 20.37, dec: 40.26 }, { ra: 19.51, dec: 27.96 },
      { ra: 20.77, dec: 33.97 }, { ra: 19.75, dec: 45.13 },
    ], lines: [[0,1],[1,2],[3,1],[1,4]] },
  { name: "Taurus", stars: [
      { ra: 4.60, dec: 16.51 }, { ra: 5.44, dec: 28.61 }, { ra: 4.30, dec: 12.49 },
      { ra: 4.48, dec: 15.87 },
    ], lines: [[2,3],[3,0],[0,1]] },
  { name: "Pegasus", stars: [
      { ra: 23.08, dec: 15.21 }, { ra: 23.06, dec: 28.08 }, { ra: 0.14, dec: 29.09 },
      { ra: 0.22, dec: 15.18 },
    ], lines: [[0,1],[1,2],[2,3],[3,0]] },
];

function raDecToVec3(raHours, decDeg, radius) {
  const raRad = THREE.MathUtils.degToRad(raHours * 15);
  const decRad = THREE.MathUtils.degToRad(decDeg);
  return new THREE.Vector3(
    radius * Math.cos(decRad) * Math.cos(raRad),
    radius * Math.sin(decRad),
    radius * Math.cos(decRad) * Math.sin(raRad)
  );
}

function createConstellationLabel(text) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  ctx.font = "28px sans-serif";
  ctx.fillStyle = "rgba(170,195,255,0.55)";
  ctx.textAlign = "center";
  ctx.fillText(text, 128, 40);
  const texture = new THREE.CanvasTexture(canvas);
  const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.scale.set(70, 17.5, 1);
  return sprite;
}

export function createConstellations(scene) {
  const group = new THREE.Group();
  const R = 980; // just inside the outer edge of the starfield shell
  const lineMat = new THREE.LineBasicMaterial({ color: 0x5d7fc7, transparent: true, opacity: 0.35 });
  const starGeo = new THREE.SphereGeometry(1.6, 6, 6);
  const starMat = new THREE.MeshBasicMaterial({ color: 0xdfe9ff });

  CONSTELLATIONS.forEach((c) => {
    const points = c.stars.map((s) => raDecToVec3(s.ra, s.dec, R));

    points.forEach((p) => {
      const starMesh = new THREE.Mesh(starGeo, starMat);
      starMesh.position.copy(p);
      group.add(starMesh);
    });

    c.lines.forEach(([a, b]) => {
      const geo = new THREE.BufferGeometry().setFromPoints([points[a], points[b]]);
      group.add(new THREE.Line(geo, lineMat));
    });

    const centroid = new THREE.Vector3();
    points.forEach((p) => centroid.add(p));
    centroid.divideScalar(points.length);
    const label = createConstellationLabel(c.name);
    label.position.copy(centroid);
    group.add(label);
  });

  scene.add(group);
  return group;
}
