import * as THREE from "three";

// A real large-scale-structure simulation frame (Millennium-Simulation-
// style dark-matter web) — Volker Springel / Max Planck Institute for
// Astrophysics, CC BY-SA 4.0, individually verified against the live
// Wikimedia Commons API. Attribution required (unlike the public-domain
// NASA imagery used elsewhere in this app) — see the credit comment on its
// use below.
const COSMIC_WEB_PHOTO_URL = "https://upload.wikimedia.org/wikipedia/commons/0/0f/Cosmic_web.jpg";
const COSMIC_WEB_CREDIT = "Volker Springel / Max Planck Institute for Astrophysics, CC BY-SA 4.0";

// ---------- Observable Universe tier content ----------
// The finale tier: a single shell wrapping the whole tier — the closest
// thing to an "edge" of the observable universe — carrying the real
// large-scale filament structure as its own surface texture rather than
// separate floating geometry layered on top of it.
//
// The real photo is a single 678x452 frame, so it can't just be wrapped
// around a sphere: stretched once it's a blurred smear, and tiled with
// texture.repeat it shows an obvious rectangular grid (which is exactly
// what it did before this). Instead buildSeamlessWebCanvas() below composes
// ONE large equirectangular texture out of many feathered, rotated,
// varied-scale stamps of that photo, additively blended — so the filaments
// read as one continuous organic web with no repeating unit and no seam,
// while still being made entirely of the real image.

export const WEB_RADIUS = 8000;

const TEX_W = 2048;
const TEX_H = 1024; // 2:1, the aspect an equirectangular sphere map needs
const STAMPS = 110;

function makeCanvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

// Deterministic, so the universe looks the same every visit rather than
// reshuffling itself each time the tier is built.
function makeRandom(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// The photo with its edges faded to nothing, so stamps blend into each
// other instead of showing their rectangular borders. destination-in keeps
// only where the radial gradient is opaque, turning the square frame into a
// soft-edged blob.
function makeFeatheredStamp(img, size) {
  const c = makeCanvas(size, size);
  const ctx = c.getContext("2d");
  ctx.drawImage(img, 0, 0, size, size);
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(0,0,0,1)");
  g.addColorStop(0.5, "rgba(0,0,0,0.9)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.globalCompositeOperation = "destination-in";
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return c;
}

function stampAt(ctx, stamp, x, y, size, rot) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.drawImage(stamp, -size / 2, -size / 2, size, size);
  ctx.restore();
}

function buildSeamlessWebCanvas(img) {
  const canvas = makeCanvas(TEX_W, TEX_H);
  const ctx = canvas.getContext("2d");

  // Base is the source photo itself, stretched to fill. It gives every pixel
  // a plausible starting colour straight from the real image, so the stamps
  // on top only need to break up the repetition rather than build the whole
  // surface out of nothing.
  ctx.drawImage(img, 0, 0, TEX_W, TEX_H);

  const stamp = makeFeatheredStamp(img, 512);
  const rand = makeRandom(0x5eed);

  // Normal blending, NOT additive. Additive was the obvious choice — glowing
  // filaments should add up — but with this many overlapping stamps the
  // channels accumulate past the source's own values and the whole sphere
  // drifts magenta-pink, nothing like the photo it came from. source-over
  // averages overlaps instead of summing them, so the composed texture keeps
  // the real image's colour balance while still killing the visible
  // repetition.
  ctx.globalCompositeOperation = "source-over";

  for (let i = 0; i < STAMPS; i++) {
    const size = 300 + rand() * 520;
    const x = rand() * TEX_W;
    const y = rand() * TEX_H;
    const rot = rand() * Math.PI * 2;

    // Equirectangular mapping crushes the texture horizontally toward the
    // poles, so stamps up there would smear into streaks. Fading them out
    // keeps the visible band (where the viewer actually looks) detailed and
    // lets the poles settle into a soft haze instead of a mess of streaks.
    const polar = 1 - Math.abs(y / TEX_H - 0.5) * 2;
    ctx.globalAlpha = 0.25 + polar * 0.4;

    stampAt(ctx, stamp, x, y, size, rot);

    // The left and right edges of an equirect texture are the SAME meridian
    // on the sphere. Any stamp overlapping an edge is drawn again on the
    // opposite side so the structure continues across that join instead of
    // being cut off — this is what removes the vertical seam.
    if (x < size / 2) stampAt(ctx, stamp, x + TEX_W, y, size, rot);
    else if (x > TEX_W - size / 2) stampAt(ctx, stamp, x - TEX_W, y, size, rot);
  }

  ctx.globalAlpha = 1;
  return canvas;
}

function buildCmbShell() {
  const geo = new THREE.SphereGeometry(WEB_RADIUS * 1.1, 48, 32);
  // Starts as a plain dark sphere — a perfectly reasonable placeholder for
  // the moment it takes the real photo to arrive, same "harmless no-op
  // fallback" pattern every other real-image upgrade in this app uses.
  const mat = new THREE.MeshBasicMaterial({ color: 0x05060c, side: THREE.BackSide, fog: false, depthWrite: false });
  const shell = new THREE.Mesh(geo, mat);
  shell.name = "cmbShell";
  shell.userData.credit = COSMIC_WEB_CREDIT; // CC BY-SA 4.0 — attribution required, unlike the public-domain NASA imagery elsewhere in this app

  // Loaded as a plain Image rather than through textures/realTextures.js's
  // loadRealTexture(), because this needs the raw pixels to compose with —
  // it isn't used as a texture directly. crossOrigin must be set before src
  // for the canvas to stay readable (Wikimedia sends the CORS headers).
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => {
    let tex;
    try {
      tex = new THREE.CanvasTexture(buildSeamlessWebCanvas(img));
    } catch {
      return; // unreadable for any reason — the plain dark shell simply stays
    }
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping; // the canvas is already seamless left-to-right; this just makes the join exact
    mat.map = tex;
    mat.color.set(0xffffff);
    mat.needsUpdate = true;
  };
  img.src = COSMIC_WEB_PHOTO_URL;

  return shell;
}

export function buildObservableUniverseBackdrop() {
  const group = new THREE.Group();
  group.name = "observableUniverseBackdrop";
  group.add(buildCmbShell());
  return group;
}
