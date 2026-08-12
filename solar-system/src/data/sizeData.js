// ---------- size comparison data ----------
// One flat, real-world-diameter (km) entry per clickable body already in the
// app — Sun, planets, moons, the ISS, galaxies, and black holes — so the
// size comparison panel (ui/sizeComparePanel.js, xr/vrSizeComparePanel.js)
// has a single source of numbers to search and plot, independent of
// whichever tier/scene a body's 3D mesh happens to live in right now.
// Real, sourceable diameters throughout (NASA planetary fact sheets for the
// solar system, standard published figures for galaxies) — the same
// "approximate, not live-catalog-exact" bar every other real-data file in
// this app already sets (core/starfield.js's constellations, cosmos/
// galaxyData.js's distances). Never literal 3D-scene scale, which this app
// deliberately never uses for anything (see scene/planetData.js's header).
//
// `imageUrl` — a REAL photo of that specific body, individually verified
// against the live Wikimedia Commons API (never hand-constructed — see
// landmark/landmarkData.js's header for why that reliably 400s in this
// project). Solar-system bodies reuse the exact URLs already verified and
// in production use in textures/realTextures.js; galaxies reuse
// cosmos/galaxyData.js's own verified URLs; the 20 moons, Pluto, the ISS,
// and the two black holes below were newly sourced and verified for this
// panel specifically. `color` is a representative real-world tint used as
// a fallback (and for the glow/shading around the photo) for the couple of
// bodies with no real photo available.
//
// Two black holes intentionally have NO imageUrl: Andromeda's nucleus and
// Centaurus A's central black hole have never actually been directly
// imaged by any telescope (only Sagittarius A* and M87 have, by the Event
// Horizon Telescope) — so those two stay on the procedural accretion-disk
// rendering rather than pretending a photo exists. Same for Virgo Cluster
// (a whole cluster, not a single photographable object).
//
// `credit` is only set where attribution is legally required (the two EHT
// images are CC BY 4.0, not public domain like the NASA mission photos) —
// same "only where actually needed" precedent landmark/landmarkData.js and
// cosmos/galaxyData.js's own credit fields already follow.

const LY_KM = 9.4607e12; // 1 light-year in kilometres

export const SIZE_ENTITIES = [
  // ---- Sun ----
  {
    name: "Sun", category: "Star", diameterKm: 1392700, color: "#ffcf5c",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/c/cb/Solarsystemscope_texture_2k_sun.jpg",
  },

  // ---- planets + Pluto ----
  {
    name: "Mercury", category: "Planet", diameterKm: 4879, color: "#9c9a94",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/9/92/Solarsystemscope_texture_2k_mercury.jpg",
  },
  {
    name: "Venus", category: "Planet", diameterKm: 12104, color: "#e8cfa0",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/4/40/Solarsystemscope_texture_2k_venus_surface.jpg",
  },
  {
    name: "Earth", category: "Planet", diameterKm: 12742, color: "#3f8fd1",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/c/c3/Solarsystemscope_texture_2k_earth_daymap.jpg",
  },
  {
    name: "Mars", category: "Planet", diameterKm: 6779, color: "#c1440e",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/4/46/Solarsystemscope_texture_2k_mars.jpg",
  },
  {
    name: "Jupiter", category: "Planet", diameterKm: 139820, color: "#d8a870",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/b/be/Solarsystemscope_texture_2k_jupiter.jpg",
  },
  {
    name: "Saturn", category: "Planet", diameterKm: 116460, color: "#e3c88f",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/e/ea/Solarsystemscope_texture_2k_saturn.jpg",
  },
  {
    name: "Uranus", category: "Planet", diameterKm: 50724, color: "#7fd8d8",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/9/95/Solarsystemscope_texture_2k_uranus.jpg",
  },
  {
    name: "Neptune", category: "Planet", diameterKm: 49244, color: "#3d5fcf",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/1/1e/Solarsystemscope_texture_2k_neptune.jpg",
  },
  {
    name: "Pluto", category: "Dwarf Planet", diameterKm: 2377, color: "#cbb79a",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ef/Pluto_in_True_Color_-_High-Res.jpg/1280px-Pluto_in_True_Color_-_High-Res.jpg",
  },

  // ---- moons ----
  {
    name: "Moon", category: "Moon", diameterKm: 3474, note: "Earth's Moon", color: "#b8b8b8",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/2/26/Solarsystemscope_texture_2k_moon.jpg",
  },
  {
    name: "Phobos", category: "Moon", diameterKm: 22.2, note: "Mars", color: "#8a7f70",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/5/54/Phobos_Full.png",
  },
  {
    name: "Deimos", category: "Moon", diameterKm: 12.4, note: "Mars", color: "#8a7f70",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/4/4a/Deimos2.jpg",
  },
  {
    name: "Io", category: "Moon", diameterKm: 3643.2, note: "Jupiter", color: "#e2c76b",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/Io_highest_resolution_true_color.jpg/1280px-Io_highest_resolution_true_color.jpg",
  },
  {
    name: "Europa", category: "Moon", diameterKm: 3121.6, note: "Jupiter", color: "#d8cfc0",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6c/PIA19048_realistic_color_Europa_mosaic_edited.jpg/1280px-PIA19048_realistic_color_Europa_mosaic_edited.jpg",
  },
  {
    name: "Ganymede", category: "Moon", diameterKm: 5268.2, note: "Jupiter", color: "#9a8f7f",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/2/2e/Ganymede_g1_true.jpg",
  },
  {
    name: "Callisto", category: "Moon", diameterKm: 4820.6, note: "Jupiter", color: "#6f6459",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/e/e9/Callisto.jpg",
  },
  {
    name: "Mimas", category: "Moon", diameterKm: 396.4, note: "Saturn", color: "#b8b0a0",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/7/76/PIA06256_Mimas_full_view.jpg",
  },
  {
    name: "Enceladus", category: "Moon", diameterKm: 504.2, note: "Saturn", color: "#eef2f5",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0f/Enceladus.jpg/1280px-Enceladus.jpg",
  },
  {
    name: "Tethys", category: "Moon", diameterKm: 1066, note: "Saturn", color: "#c8c4bc",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Tethys_PIA07738.jpg/1280px-Tethys_PIA07738.jpg",
  },
  {
    name: "Dione", category: "Moon", diameterKm: 1122.8, note: "Saturn", color: "#bcb8b0",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/88/20121023_dione_global_mosaic_20100407_canale.jpg/1280px-20121023_dione_global_mosaic_20100407_canale.jpg",
  },
  {
    name: "Rhea", category: "Moon", diameterKm: 1527.6, note: "Saturn", color: "#c4c0b8",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/PIA07763_Rhea_full_globe5.jpg/1280px-PIA07763_Rhea_full_globe5.jpg",
  },
  {
    name: "Titan", category: "Moon", diameterKm: 5149.5, note: "Saturn", color: "#e0b96a",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/2/2f/PIA14602.jpg",
  },
  {
    name: "Iapetus", category: "Moon", diameterKm: 1469, note: "Saturn", color: "#a89e8e",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c9/Iapetus_as_seen_by_the_Cassini_probe_-_20071008.jpg/1280px-Iapetus_as_seen_by_the_Cassini_probe_-_20071008.jpg",
  },
  {
    name: "Miranda", category: "Moon", diameterKm: 471.6, note: "Uranus", color: "#a8a8b0",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Miranda_as_seen_by_Voyager_2_-_GPN-2003-000005.jpg/1280px-Miranda_as_seen_by_Voyager_2_-_GPN-2003-000005.jpg",
  },
  {
    name: "Ariel", category: "Moon", diameterKm: 1157.8, note: "Uranus", color: "#b0b4b8",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/5/59/Ariel_%28moon%29.jpg",
  },
  {
    name: "Umbriel", category: "Moon", diameterKm: 1169.4, note: "Uranus", color: "#807c78",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/5/50/Umbriel_%28moon%29.jpg",
  },
  {
    name: "Titania", category: "Moon", diameterKm: 1578.4, note: "Uranus", color: "#a8a4a0",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/5/50/Titania_%28moon%29_color.jpg",
  },
  {
    name: "Oberon", category: "Moon", diameterKm: 1522.8, note: "Uranus", color: "#948c84",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/d/d7/Voyager_2_picture_of_Oberon_mod.jpg",
  },
  {
    name: "Triton", category: "Moon", diameterKm: 2706.8, note: "Neptune", color: "#cfd8e0",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/Triton_moon_mosaic_Voyager_2_%28large%29.jpg/1280px-Triton_moon_mosaic_Voyager_2_%28large%29.jpg",
  },
  {
    name: "Charon", category: "Moon", diameterKm: 1212, note: "Pluto", color: "#9a9088",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/Charon_in_True_Color_-_High-Res.jpg/1280px-Charon_in_True_Color_-_High-Res.jpg",
  },

  // ---- spacecraft ----
  // Not a sphere — its largest dimension (the solar-array truss span) is
  // used instead, the only real "size" a non-spherical object has for a
  // single-number comparison like this.
  {
    name: "ISS", category: "Spacecraft", diameterKm: 0.109, note: "truss span, tip to tip", color: "#d0d0d8",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/80/ISS_March_2009.jpg/1280px-ISS_March_2009.jpg",
  },

  // ---- galaxies ----
  // diameterLy values match cosmos/galaxyData.js's `meta.Diameter` where it
  // states one; the rest are standard published estimates, same
  // "approximate real number" policy that file's own header documents.
  // imageUrl values are copied from that same file's own verified URLs.
  { name: "Milky Way", category: "Galaxy", diameterKm: 100000 * LY_KM, color: "#8fb8ff" }, // no single outside photo of our own galaxy exists — stays procedural
  {
    name: "Andromeda Galaxy", category: "Galaxy", diameterKm: 220000 * LY_KM, color: "#bcd4ff",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/f/ff/Andromeda_galaxy.jpg",
  },
  {
    name: "Triangulum Galaxy", category: "Galaxy", diameterKm: 60000 * LY_KM, color: "#cfe0ff",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/e/ea/M33_-_Triangulum_Galaxy.jpg",
  },
  {
    name: "Large Magellanic Cloud", category: "Galaxy", diameterKm: 14000 * LY_KM, color: "#ffe8c9",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/9/93/Large_Magellanic_Cloud.jpg",
  },
  {
    name: "Small Magellanic Cloud", category: "Galaxy", diameterKm: 7000 * LY_KM, color: "#ffe0c0",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/d/d3/Small_Magellanic_Cloud_%28SMC%29.jpg",
  },
  {
    name: "Whirlpool Galaxy", category: "Galaxy", diameterKm: 60000 * LY_KM, color: "#a8c8ff",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/8/87/Whirlpool_Galaxy.jpg",
  },
  {
    name: "Sombrero Galaxy", category: "Galaxy", diameterKm: 50000 * LY_KM, color: "#ffdca8",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/6/67/The_Sombrero_Galaxy.jpg",
  },
  {
    name: "Centaurus A", category: "Galaxy", diameterKm: 60000 * LY_KM, color: "#ffcfa0",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/e/e5/Centaurus_A.jpg",
  },
  {
    name: "Cartwheel Galaxy", category: "Galaxy", diameterKm: 150000 * LY_KM, color: "#ffb6a0",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/2/26/Cartwheel_Galaxy.jpg",
  },
  // These two are whole clusters, not single galaxies — real span across
  // their many members, included specifically for the contrast: even
  // Andromeda is a rounding error next to a cluster's full extent.
  { name: "Virgo Cluster", category: "Galaxy Cluster", diameterKm: 15000000 * LY_KM, note: "full cluster span", color: "#d8e4ff" }, // a ~1,300-galaxy cluster has no single "photo of it" — stays procedural
  {
    name: "Bullet Cluster", category: "Galaxy Cluster", diameterKm: 7000000 * LY_KM, note: "full system span", color: "#c9d8ff",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/e/ea/Bullet_cluster.jpg",
  },

  // ---- black holes ----
  // Diameter = the Schwarzschild (event horizon) diameter, computed from
  // each hole's mass via the standard relation 2GM/c² ≈ 5.906 km per
  // solar mass — not guessed, and consistent with the masses already shown
  // in each hole's own info panel (cosmos/milkyWay.js, cosmos/galaxyData.js).
  // Deliberately included on the SAME scale as everything above: a black
  // hole with a mass millions of times the Sun's still has a physical
  // horizon smaller than a single star system — the whole point of
  // comparing it here rather than by mass.
  {
    name: "Sagittarius A*", category: "Black Hole", diameterKm: 4.1e6 * 5.906, note: "event horizon", color: "#ff8c3a",
    // The real 2022 Event Horizon Telescope image — not an illustration.
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/96/EHT_Saggitarius_A_black_hole.tif/lossy-page1-1280px-EHT_Saggitarius_A_black_hole.tif.jpg",
    credit: "EHT Collaboration / ESO, CC BY 4.0",
  },
  // No telescope has ever directly imaged this hole's horizon (only
  // Sagittarius A* and M87* have been, by the EHT) — stays on the
  // procedural accretion-disk rendering rather than faking a photo.
  { name: "Andromeda's Nucleus (P2)", category: "Black Hole", diameterKm: 1.4e8 * 5.906, note: "event horizon", color: "#ff8c3a" },
  { name: "Centaurus A's Central Black Hole", category: "Black Hole", diameterKm: 5.5e7 * 5.906, note: "event horizon", color: "#ff8c3a" },
  {
    name: "M87*", category: "Black Hole", diameterKm: 6.5e9 * 5.906, note: "event horizon", color: "#ff8c3a",
    // The real 2019 Event Horizon Telescope image — the first black hole ever imaged.
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/cf/Black_hole_-_Messier_87.jpg/1280px-Black_hole_-_Messier_87.jpg",
    credit: "Event Horizon Telescope / ESO, CC BY 4.0",
  },
];

export function searchSizeEntities(query) {
  const q = query.trim().toLowerCase();
  if (!q) return SIZE_ENTITIES;
  return SIZE_ENTITIES.filter(
    (e) => e.name.toLowerCase().includes(q) || e.category.toLowerCase().includes(q)
  );
}

export function getSizeRange() {
  const diameters = SIZE_ENTITIES.map((e) => e.diameterKm);
  return { min: Math.min(...diameters), max: Math.max(...diameters) };
}
