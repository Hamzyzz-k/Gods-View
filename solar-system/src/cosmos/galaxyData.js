// ---------- galaxy zoo data ----------
// Real (approximate) right ascension/declination and distance for each
// object — the same "approximate real coordinates, not live-catalog-exact"
// bar core/starfield.js's constellation data already sets and documents.
// `distanceLy` is used for the tiered log-distance compression in
// cosmos/galaxyFactory.js, not for literal to-scale placement (nothing at
// this scale ever is — see planetData.js's own header for the same policy
// one scale level down).
//
// `imageUrl` is a verified real Wikimedia Commons direct file URL (CORS-
// permissive, same reasoning textures/realTextures.js already documents)
// where sourced; entries without one simply stay on the procedural
// fallback sprite (cosmos/galaxyFactory.js) — a real gap, not a hidden one.
//
// `tier` says which rung of the ladder (cosmos/tierData.js) this object
// belongs to.
export const GALAXY_DATA = [
  {
    name: "Andromeda Galaxy",
    altName: "M31",
    tier: "localGroup",
    raHours: 0.712,
    decDeg: 41.27,
    distanceLy: 2537000,
    type: "Spiral galaxy",
    color: 0xbcd4ff,
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/f/ff/Andromeda_galaxy.jpg",
    meta: { Type: "Spiral galaxy", Distance: "~2.5 million ly", Diameter: "~220,000 ly" },
    info: "The nearest large spiral galaxy to the Milky Way, and the most distant object visible to the naked eye. Andromeda and the Milky Way are approaching each other and are expected to merge in roughly 4-5 billion years.",
    blackHole: {
      name: "Andromeda's Nucleus (P2)",
      meta: { Type: "Supermassive black hole", Mass: "~140 million M☉", Host: "Andromeda Galaxy" },
      info: "The supermassive black hole at Andromeda's center, embedded in a dense, off-center double nucleus (P1 and P2) — a lopsided structure thought to be a ring of old stars orbiting the black hole eccentrically. At roughly 140 million solar masses, it dwarfs the Milky Way's own Sagittarius A*.",
    },
  },
  {
    name: "Triangulum Galaxy",
    altName: "M33",
    tier: "localGroup",
    raHours: 1.564,
    decDeg: 30.66,
    distanceLy: 2730000,
    type: "Spiral galaxy",
    color: 0xcfe0ff,
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/e/ea/M33_-_Triangulum_Galaxy.jpg",
    meta: { Type: "Spiral galaxy", Distance: "~2.7 million ly", Diameter: "~60,000 ly" },
    info: "The third-largest member of the Local Group, after Andromeda and the Milky Way. It may be a satellite of Andromeda, gravitationally bound to it.",
  },
  {
    name: "Large Magellanic Cloud",
    altName: "LMC",
    tier: "localGroup",
    raHours: 5.393,
    decDeg: -69.75,
    distanceLy: 163000,
    type: "Irregular dwarf galaxy",
    color: 0xffe8c9,
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/9/93/Large_Magellanic_Cloud.jpg",
    meta: { Type: "Irregular dwarf galaxy", Distance: "~163,000 ly" },
    info: "A satellite galaxy of the Milky Way, visible to the naked eye from the Southern Hemisphere. Home to the Tarantula Nebula, one of the most active star-forming regions known.",
  },
  {
    name: "Small Magellanic Cloud",
    altName: "SMC",
    tier: "localGroup",
    raHours: 0.879,
    decDeg: -72.83,
    distanceLy: 200000,
    type: "Irregular dwarf galaxy",
    color: 0xffe0c0,
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/d/d3/Small_Magellanic_Cloud_%28SMC%29.jpg",
    meta: { Type: "Irregular dwarf galaxy", Distance: "~200,000 ly" },
    info: "The Milky Way's other naked-eye satellite galaxy, forming a pair with the Large Magellanic Cloud low in the southern sky.",
  },
  {
    name: "Whirlpool Galaxy",
    altName: "M51",
    tier: "supercluster",
    raHours: 13.498,
    decDeg: 47.20,
    distanceLy: 23000000,
    type: "Spiral galaxy",
    color: 0xa8c8ff,
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/8/87/Whirlpool_Galaxy.jpg",
    meta: { Type: "Spiral galaxy", Distance: "~23 million ly" },
    info: "One of the clearest examples of a grand-design spiral galaxy, its shape sharpened by an ongoing gravitational interaction with a smaller companion galaxy, NGC 5195, visible at the tip of one of its arms.",
  },
  {
    name: "Sombrero Galaxy",
    altName: "M104",
    tier: "supercluster",
    raHours: 12.667,
    decDeg: -11.62,
    distanceLy: 29300000,
    type: "Spiral galaxy",
    color: 0xffdca8,
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/6/67/The_Sombrero_Galaxy.jpg",
    meta: { Type: "Spiral galaxy", Distance: "~29 million ly" },
    info: "Named for its resemblance to the wide-brimmed hat: a bright central bulge wrapped in a dust lane so sharp it's visible even in modest amateur telescopes. Home to an unusually massive central black hole for a galaxy its size.",
  },
  {
    name: "Centaurus A",
    altName: "NGC 5128",
    tier: "supercluster",
    raHours: 13.425,
    decDeg: -43.02,
    distanceLy: 12000000,
    type: "Elliptical galaxy",
    color: 0xffcfa0,
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/e/e5/Centaurus_A.jpg",
    meta: { Type: "Elliptical galaxy", Distance: "~12 million ly" },
    info: "One of the closest active galaxies to Earth, split by a dramatic dark dust lane — the aftermath of a collision with a smaller spiral galaxy. Its core hosts a supermassive black hole launching a jet of particles thousands of light-years long.",
    blackHole: {
      name: "Centaurus A's Central Black Hole",
      meta: { Type: "Supermassive black hole", Mass: "~55 million M☉", Host: "Centaurus A" },
      info: "The active supermassive black hole powering Centaurus A, one of the closest and brightest radio galaxies to Earth. Matter falling toward it launches a relativistic jet of particles thousands of light-years long — visible across the radio, X-ray, and gamma-ray spectrum.",
    },
  },
  {
    name: "Virgo Cluster",
    altName: "anchored by M87",
    tier: "supercluster",
    raHours: 12.514,
    decDeg: 12.39,
    distanceLy: 53500000,
    type: "Galaxy cluster",
    color: 0xd8e4ff,
    // A real, individually-verified wide-field photo DOES exist for this one
    // (unlike a true "photo of the whole cluster," this is the actual sky
    // region — NASA/ESA/Digitized Sky Survey, public domain), so it no
    // longer has to stay purely procedural like Andromeda's/Centaurus A's
    // unresolved black hole nuclei do.
    imageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Wide-field_view_of_the_Virgo_cluster_of_galaxies_%28ground-based_image%29_%28heic0815i%29.jpg/1280px-Wide-field_view_of_the_Virgo_cluster_of_galaxies_%28ground-based_image%29_%28heic0815i%29.jpg",
    meta: { Type: "Galaxy cluster (~1,300+ members)", Distance: "~53.5 million ly" },
    info: "The nearest large galaxy cluster to the Local Group, anchored by the giant elliptical galaxy M87. The Local Group is gravitationally drawn toward the Virgo Cluster as part of the larger Virgo Supercluster.",
    blackHole: {
      name: "M87*",
      meta: { Type: "Supermassive black hole", Mass: "~6.5 billion M☉", Host: "M87, Virgo Cluster" },
      info: "The first black hole ever directly imaged, by the Event Horizon Telescope in 2019 — the famous glowing orange ring around a dark center. At roughly 6.5 billion solar masses, it anchors the giant elliptical galaxy M87 at the heart of the Virgo Cluster and powers a jet of particles over 5,000 light-years long.",
    },
  },
  {
    name: "Cygnus A",
    altName: "3C 405",
    tier: "observableUniverse",
    raHours: 19.991,
    decDeg: 40.734,
    distanceLy: 700000000,
    type: "Elliptical galaxy",
    color: 0xffcfa0,
    // NASA/Chandra/STScI/NRAO composite (X-ray + optical + radio), public
    // domain, individually verified against the live Wikimedia Commons API
    // — same URL used in data/sizeData.js's entry for this galaxy.
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/a/a4/Cygnus_A_composite.jpg",
    meta: { Type: "Elliptical radio galaxy", Distance: "~700 million ly" },
    info: "One of the closest powerful radio galaxies to Earth — its two vast lobes of radio-emitting plasma, launched by jets from its central black hole, were among the first sources ever detected by radio astronomy. Chandra X-ray imaging revealed a giant bubble of hot gas surrounding the whole system.",
    blackHole: {
      name: "Cygnus A's Central Black Hole",
      meta: { Type: "Supermassive black hole", Mass: "~2.5 billion M☉", Host: "Cygnus A" },
      info: "The supermassive black hole powering Cygnus A's twin radio jets and lobes — one of the most powerful known sources of radio emission in the sky, discovered before its host galaxy was even identified.",
    },
  },
  {
    name: "Cartwheel Galaxy",
    tier: "observableUniverse",
    raHours: 0.628,
    decDeg: -33.71,
    distanceLy: 500000000,
    type: "Ring galaxy",
    color: 0xffb6a0,
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/2/26/Cartwheel_Galaxy.jpg",
    meta: { Type: "Ring galaxy", Distance: "~500 million ly" },
    info: "Its striking ring shape is the aftermath of a direct collision with a smaller galaxy tens of millions of years ago, which sent a wave of star formation rippling outward like a stone dropped in a pond.",
  },
  {
    name: "Bullet Cluster",
    altName: "1E 0657-56",
    tier: "observableUniverse",
    raHours: 6.977,
    decDeg: -55.95,
    distanceLy: 3800000000,
    type: "Colliding galaxy clusters",
    color: 0xc9d8ff,
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/e/ea/Bullet_cluster.jpg",
    meta: { Type: "Colliding galaxy clusters", Distance: "~3.8 billion ly" },
    info: "Two galaxy clusters caught mid-collision, famous as some of the strongest direct observational evidence for dark matter: gravitational lensing shows most of the mass has passed through the collision separately from the visible, X-ray-glowing hot gas, which collided and lagged behind.",
  },
];

export function getGalaxiesForTier(tierId) {
  return GALAXY_DATA.filter((g) => g.tier === tierId);
}
