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

  // Pluto + the 19 non-Earth major moons. Same Wikimedia-CORS reasoning as
  // the pack above, but these are real NASA/ESA mission photos rather than
  // the Solar System Scope illustration pack — URLs copied verbatim from
  // data/sizeData.js, where each was already individually verified against
  // the live Wikimedia Commons API (see that file's header). Every one of
  // these checked out at <=1280px on its longest side (several are raw,
  // un-thumbed originals under 1100px — nothing here needed a thumb swap).
  Pluto: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ef/Pluto_in_True_Color_-_High-Res.jpg/1280px-Pluto_in_True_Color_-_High-Res.jpg",
  Phobos: "https://upload.wikimedia.org/wikipedia/commons/5/54/Phobos_Full.png",
  Deimos: "https://upload.wikimedia.org/wikipedia/commons/4/4a/Deimos2.jpg",
  Io: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/Io_highest_resolution_true_color.jpg/1280px-Io_highest_resolution_true_color.jpg",
  Europa: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6c/PIA19048_realistic_color_Europa_mosaic_edited.jpg/1280px-PIA19048_realistic_color_Europa_mosaic_edited.jpg",
  Ganymede: "https://upload.wikimedia.org/wikipedia/commons/2/2e/Ganymede_g1_true.jpg",
  Callisto: "https://upload.wikimedia.org/wikipedia/commons/e/e9/Callisto.jpg",
  Mimas: "https://upload.wikimedia.org/wikipedia/commons/7/76/PIA06256_Mimas_full_view.jpg",
  Enceladus: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0f/Enceladus.jpg/1280px-Enceladus.jpg",
  Tethys: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Tethys_PIA07738.jpg/1280px-Tethys_PIA07738.jpg",
  Dione: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/88/20121023_dione_global_mosaic_20100407_canale.jpg/1280px-20121023_dione_global_mosaic_20100407_canale.jpg",
  Rhea: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/PIA07763_Rhea_full_globe5.jpg/1280px-PIA07763_Rhea_full_globe5.jpg",
  Titan: "https://upload.wikimedia.org/wikipedia/commons/2/2f/PIA14602.jpg",
  Iapetus: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c9/Iapetus_as_seen_by_the_Cassini_probe_-_20071008.jpg/1280px-Iapetus_as_seen_by_the_Cassini_probe_-_20071008.jpg",
  Miranda: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Miranda_as_seen_by_Voyager_2_-_GPN-2003-000005.jpg/1280px-Miranda_as_seen_by_Voyager_2_-_GPN-2003-000005.jpg",
  Ariel: "https://upload.wikimedia.org/wikipedia/commons/5/59/Ariel_%28moon%29.jpg",
  Umbriel: "https://upload.wikimedia.org/wikipedia/commons/5/50/Umbriel_%28moon%29.jpg",
  Titania: "https://upload.wikimedia.org/wikipedia/commons/5/50/Titania_%28moon%29_color.jpg",
  Oberon: "https://upload.wikimedia.org/wikipedia/commons/d/d7/Voyager_2_picture_of_Oberon_mod.jpg",
  Triton: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/Triton_moon_mosaic_Voyager_2_%28large%29.jpg/1280px-Triton_moon_mosaic_Voyager_2_%28large%29.jpg",
  Charon: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/Charon_in_True_Color_-_High-Res.jpg/1280px-Charon_in_True_Color_-_High-Res.jpg",
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
