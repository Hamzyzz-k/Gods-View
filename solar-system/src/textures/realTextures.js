import { showToast } from "../ui/toast.js";
import * as THREE from "three";

// ---------- real photographic textures (progressive upgrade) ----------
// The scene renders immediately with the procedural canvas textures above
// (so it never depends on network access), then quietly swaps in real
// NASA-derived equirectangular maps as they finish downloading. Source:
// Solar System Scope's texture pack, CC BY 4.0, mirrored on Wikimedia
// Commons — chosen specifically because upload.wikimedia.org serves images
// with permissive CORS headers, which WebGL textures require.
export const REAL_TEXTURE_URLS = {
  Sun: "https://upload.wikimedia.org/wikipedia/commons/c/cb/Solarsystemscope_texture_2k_sun.jpg",
  Mercury: "https://upload.wikimedia.org/wikipedia/commons/9/92/Solarsystemscope_texture_2k_mercury.jpg",
  Venus: "https://upload.wikimedia.org/wikipedia/commons/4/40/Solarsystemscope_texture_2k_venus_surface.jpg",
  Earth: "https://upload.wikimedia.org/wikipedia/commons/c/c3/Solarsystemscope_texture_2k_earth_daymap.jpg",
  EarthClouds: "https://upload.wikimedia.org/wikipedia/commons/e/ed/Solarsystemscope_texture_2k_earth_clouds.jpg",
  Mars: "https://upload.wikimedia.org/wikipedia/commons/4/46/Solarsystemscope_texture_2k_mars.jpg",
  Jupiter: "https://upload.wikimedia.org/wikipedia/commons/b/be/Solarsystemscope_texture_2k_jupiter.jpg",
  Saturn: "https://upload.wikimedia.org/wikipedia/commons/e/ea/Solarsystemscope_texture_2k_saturn.jpg",
  SaturnRing: "https://upload.wikimedia.org/wikipedia/commons/7/7d/Solarsystemscope_texture_2k_saturn_ring_alpha.png",
  Uranus: "https://upload.wikimedia.org/wikipedia/commons/9/95/Solarsystemscope_texture_2k_uranus.jpg",
  Neptune: "https://upload.wikimedia.org/wikipedia/commons/1/1e/Solarsystemscope_texture_2k_neptune.jpg",
  Moon: "https://upload.wikimedia.org/wikipedia/commons/2/26/Solarsystemscope_texture_2k_moon.jpg",
};

const realTextureLoader = new THREE.TextureLoader();
realTextureLoader.crossOrigin = "anonymous";

// Tracks how many real-texture fetches succeeded/failed so we can surface a
// single, visible summary (via the existing toast UI) once they've all
// settled — without needing the browser dev console open. Debounced with a
// short timer since ~12 requests fire in quick succession at startup.
const realTextureStats = { requested: 0, settled: 0, loaded: 0 };
let realTextureReportTimer = null;
export function reportRealTextureStatus() {
  clearTimeout(realTextureReportTimer);
  realTextureReportTimer = setTimeout(() => {
    const { requested, settled, loaded } = realTextureStats;
    if (settled < requested) return; // more still in flight
    if (loaded === 0) {
      showToast(
        "Real textures unavailable",
        "Couldn't fetch photo textures from Wikimedia — check your internet connection, or that this page is being served over http(s) rather than opened directly as a local file (module scripts are blocked on file://). Using the built-in procedural textures instead.",
        10000
      );
    } else if (loaded < requested) {
      showToast("Real textures partly loaded", `${loaded}/${requested} loaded; the rest fell back to procedural textures.`, 6000);
    } else {
      showToast("Real textures loaded", `All ${loaded} NASA-derived textures loaded successfully.`, 5000);
    }
  }, 500);
}

// Loads a real texture and hands it to `onLoad` once ready. If the request
// fails for any reason (offline, blocked, slow network timeout) it just
// logs a warning and leaves whatever procedural texture is already on the
// material in place — the scene degrades gracefully instead of breaking.
export function loadRealTexture(url, onLoad) {
  realTextureStats.requested++;
  realTextureLoader.load(
    url,
    (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.wrapS = THREE.RepeatWrapping;
      onLoad(tex);
      realTextureStats.settled++;
      realTextureStats.loaded++;
      reportRealTextureStatus();
    },
    undefined,
    (err) => {
      console.warn(`Real texture unavailable, keeping procedural texture: ${url}`, err);
      realTextureStats.settled++;
      reportRealTextureStatus();
    }
  );
}
