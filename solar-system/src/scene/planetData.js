import * as THREE from "three";

// ---------- planet data ----------
// distance/size are visually scaled (NOT to real astronomical scale) so the scene reads well.
export const planetData = [
  // Mercury has no atmosphere, but it does have a tenuous sodium exosphere
  // that glows faintly orange (the same 589nm emission as a sodium lamp), so
  // the rim glow here is kept very weak and warm rather than skipped outright.
  // Deliberately far dimmer than the real-atmosphere planets below.
  { name: "Mercury", radius: 0.6, distance: 14, speed: 4.15, color: 0x9b9b9b, tilt: 0.03,
    roughness: 0.95, metalness: 0.04, bumpScale: 0.045,
    atmosphere: 0xffb066, atmosphereOpts: { scale: 1.05, power: 4.0, opacity: 0.18 },
    meta: { "Order": "1st from Sun", "Day length": "59 Earth days", "Year length": "88 Earth days" },
    info: "The smallest and fastest planet, Mercury is a cratered, airless rock baked by the Sun and scarred by extreme temperature swings between day and night." },
  { name: "Venus",   radius: 1.0, distance: 19, speed: 1.62, color: 0xe6c58c, tilt: 177.4,
    roughness: 0.9, metalness: 0.0, bumpScale: 0.012, atmosphere: 0xf3dfa8,
    meta: { "Order": "2nd from Sun", "Day length": "243 Earth days", "Year length": "225 Earth days" },
    info: "Venus is the hottest planet in the solar system thanks to a runaway greenhouse effect, hidden beneath thick clouds of sulfuric acid. It spins backwards compared to most planets." },
  { name: "Earth",   radius: 1.1, distance: 25, speed: 1.0,  color: 0x3a86ff, tilt: 23.4, hasMoon: true, hasISS: true,
    roughness: 0.75, metalness: 0.08, bumpScale: 0.02, atmosphere: 0x6ab7ff,
    meta: { "Order": "3rd from Sun", "Day length": "24 hours", "Year length": "365.25 days" },
    info: "Our home. The only known planet with liquid water on its surface and life, protected by a magnetic field and orbited by one large moon." },
  // Thin CO2 atmosphere with suspended dust — a pale butterscotch haze, and
  // genuinely faint, so a low opacity is the accurate look as well as a cheap one.
  { name: "Mars",    radius: 0.7, distance: 31, speed: 0.53, color: 0xd1543e, tilt: 25.2,
    roughness: 0.96, metalness: 0.02, bumpScale: 0.035,
    atmosphere: 0xe8a87c, atmosphereOpts: { scale: 1.08, power: 3.4, opacity: 0.34 },
    meta: { "Order": "4th from Sun", "Day length": "24.6 hours", "Year length": "687 Earth days" },
    info: "The Red Planet, colored by iron oxide dust. Home to the largest volcano and canyon in the solar system, and a major target for future human exploration.",
    moons: [
      { name: "Phobos", radius: 0.05, distance: 1.1, speed: 5.5, hue: 25, sat: 10, baseLight: 38, craterCount: 40,
        meta: { "Diameter": "~22 km", "Orbital period": "7h 39m", "Discovered": "1877" },
        info: "Phobos is the larger and inner of Mars's two moons, a heavily cratered, potato-shaped rock orbiting so close it will eventually break apart or crash into Mars." },
      { name: "Deimos", radius: 0.035, distance: 1.6, speed: 3.2, hue: 25, sat: 8, baseLight: 42, craterCount: 25,
        meta: { "Diameter": "~12 km", "Orbital period": "30h 18m", "Discovered": "1877" },
        info: "Deimos is the smaller, outer moon of Mars, a smooth, dusty fragment thought to be a captured asteroid." },
    ] },
  // A gas giant is effectively all atmosphere, so the halo is thicker and
  // stronger than the rocky planets' — warm cream from ammonia cloud tops.
  { name: "Jupiter", radius: 3.4, distance: 42, speed: 0.084, color: 0xd8ba8a, tilt: 3.1,
    atmosphere: 0xf0d9a8, atmosphereOpts: { scale: 1.09, power: 2.8, opacity: 0.5 },
    roughness: 0.95, metalness: 0.0, bumpScale: 0.015,
    meta: { "Order": "5th from Sun", "Day length": "10 hours", "Year length": "12 Earth years" },
    info: "The largest planet in the solar system, a gas giant with a Great Red Spot storm bigger than Earth and dozens of moons, including four large Galilean moons.",
    moons: [
      { name: "Io", radius: 0.32, distance: 5.5, speed: 2.6, hue: 48, sat: 55, baseLight: 60, craterCount: 12,
        meta: { "Diameter": "3,643 km", "Orbital period": "1.8 days" },
        info: "Io is the most volcanically active body in the solar system, its surface coated in sulfur compounds that give it a yellow-orange hue." },
      { name: "Europa", radius: 0.28, distance: 6.8, speed: 1.85, hue: 200, sat: 15, baseLight: 75, craterCount: 8,
        meta: { "Diameter": "3,122 km", "Orbital period": "3.6 days" },
        info: "Europa is an icy moon with a smooth, cracked surface hiding a vast subsurface ocean, making it a top target in the search for life beyond Earth." },
      { name: "Ganymede", radius: 0.4, distance: 8.4, speed: 1.15, hue: 35, sat: 15, baseLight: 50, craterCount: 30,
        meta: { "Diameter": "5,268 km", "Orbital period": "7.2 days" },
        info: "Ganymede is the largest moon in the solar system, bigger than the planet Mercury, with a mix of ancient cratered terrain and grooved icy ridges." },
      { name: "Callisto", radius: 0.38, distance: 10.2, speed: 0.75, hue: 30, sat: 10, baseLight: 35, craterCount: 55,
        meta: { "Diameter": "4,821 km", "Orbital period": "16.7 days" },
        info: "Callisto is one of the most heavily cratered objects in the solar system, an ancient icy-rock world largely unchanged for billions of years." },
    ] },
  // Saturn's upper haze is paler and softer than Jupiter's banding.
  { name: "Saturn",  radius: 2.9, distance: 55, speed: 0.034, color: 0xe6d2a3, tilt: 26.7, hasRing: true,
    atmosphere: 0xf2e3b8, atmosphereOpts: { scale: 1.09, power: 2.9, opacity: 0.44 },
    roughness: 0.9, metalness: 0.0, bumpScale: 0.015,
    meta: { "Order": "6th from Sun", "Day length": "10.7 hours", "Year length": "29 Earth years" },
    info: "Famous for its spectacular ring system made of ice and rock particles. Saturn is the least dense planet — it would float in water.",
    moons: [
      { name: "Mimas", radius: 0.12, distance: 8.2, speed: 2.3, hue: 0, sat: 0, baseLight: 55, craterCount: 20,
        meta: { "Diameter": "396 km", "Orbital period": "0.9 days" },
        info: "Mimas is a small icy moon dominated by a giant impact crater that gives it a distinctive Death Star-like appearance." },
      { name: "Enceladus", radius: 0.14, distance: 9.2, speed: 1.9, hue: 200, sat: 10, baseLight: 85, craterCount: 10,
        meta: { "Diameter": "504 km", "Orbital period": "1.4 days" },
        info: "Enceladus is a bright, icy moon that vents geysers of water vapor from its south pole, suggesting a subsurface ocean beneath its shell." },
      { name: "Tethys", radius: 0.17, distance: 10.3, speed: 1.5, hue: 0, sat: 0, baseLight: 65, craterCount: 25,
        meta: { "Diameter": "1,062 km", "Orbital period": "1.9 days" },
        info: "Tethys is an icy moon marked by a giant canyon, Ithaca Chasma, that stretches most of the way around it." },
      { name: "Dione", radius: 0.18, distance: 11.4, speed: 1.2, hue: 0, sat: 0, baseLight: 55, craterCount: 30,
        meta: { "Diameter": "1,123 km", "Orbital period": "2.7 days" },
        info: "Dione is an icy moon with bright, wispy cliffs of ice streaking across its trailing hemisphere." },
      { name: "Rhea", radius: 0.2, distance: 12.8, speed: 0.95, hue: 0, sat: 0, baseLight: 50, craterCount: 35,
        meta: { "Diameter": "1,527 km", "Orbital period": "4.5 days" },
        info: "Rhea is Saturn's second-largest moon, a heavily cratered ball of ice and rock." },
      { name: "Titan", radius: 0.45, distance: 16, speed: 0.5, hue: 35, sat: 45, baseLight: 55, craterCount: 5,
        meta: { "Diameter": "5,150 km", "Orbital period": "16 days" },
        info: "Titan is Saturn's largest moon and the only moon in the solar system with a thick atmosphere, complete with lakes and rivers of liquid methane." },
      { name: "Iapetus", radius: 0.2, distance: 19.5, speed: 0.27, hue: 30, sat: 15, baseLight: 45, craterCount: 30,
        meta: { "Diameter": "1,469 km", "Orbital period": "79 days" },
        info: "Iapetus is a strikingly two-toned moon, dramatically darker on its leading hemisphere than its trailing one." },
    ] },
  { name: "Uranus",  radius: 1.9, distance: 66, speed: 0.012, color: 0x9fe3e8, tilt: 97.8,
    roughness: 0.6, metalness: 0.12, bumpScale: 0.01, atmosphere: 0x9fe3e8,
    meta: { "Order": "7th from Sun", "Day length": "17 hours", "Year length": "84 Earth years" },
    info: "An ice giant that rotates almost completely on its side. Its pale blue-green color comes from methane in its atmosphere.",
    moons: [
      { name: "Miranda", radius: 0.09, distance: 3.3, speed: 2.2, hue: 220, sat: 10, baseLight: 55, craterCount: 20,
        meta: { "Diameter": "472 km", "Orbital period": "1.4 days" },
        info: "Miranda has some of the tallest cliffs in the solar system and a jumbled, patchwork surface suggesting a violent past." },
      { name: "Ariel", radius: 0.14, distance: 4.1, speed: 1.7, hue: 220, sat: 8, baseLight: 60, craterCount: 15,
        meta: { "Diameter": "1,158 km", "Orbital period": "2.5 days" },
        info: "Ariel is the brightest of Uranus's major moons, with a surface of ice-carved canyons and relatively few large craters." },
      { name: "Umbriel", radius: 0.14, distance: 4.9, speed: 1.35, hue: 220, sat: 5, baseLight: 32, craterCount: 30,
        meta: { "Diameter": "1,169 km", "Orbital period": "4.1 days" },
        info: "Umbriel is the darkest of Uranus's major moons, an ancient, heavily cratered world." },
      { name: "Titania", radius: 0.19, distance: 5.9, speed: 1.0, hue: 220, sat: 8, baseLight: 50, craterCount: 25,
        meta: { "Diameter": "1,578 km", "Orbital period": "8.7 days" },
        info: "Titania is the largest moon of Uranus, scarred by canyons that suggest a geologically active past." },
      { name: "Oberon", radius: 0.18, distance: 6.9, speed: 0.8, hue: 220, sat: 8, baseLight: 40, craterCount: 35,
        meta: { "Diameter": "1,523 km", "Orbital period": "13.5 days" },
        info: "Oberon is the outermost major moon of Uranus, an old, heavily cratered surface with a few mysterious dark patches." },
    ] },
  { name: "Neptune", radius: 1.85, distance: 76, speed: 0.006, color: 0x4f6fe0, tilt: 28.3,
    roughness: 0.55, metalness: 0.14, bumpScale: 0.01, atmosphere: 0x4f6fe0,
    meta: { "Order": "8th from Sun", "Day length": "16 hours", "Year length": "165 Earth years" },
    info: "The windiest planet, with storms reaching supersonic speeds. Neptune is the most distant known major planet, a deep blue ice giant.",
    moons: [
      { name: "Triton", radius: 0.3, distance: 4.3, speed: -1.1, hue: 350, sat: 15, baseLight: 65, craterCount: 8,
        meta: { "Diameter": "2,707 km", "Orbital period": "5.9 days (retrograde)" },
        info: "Triton is Neptune's largest moon and orbits backwards compared to Neptune's rotation, evidence that it's a captured world from the Kuiper Belt." },
    ] },
  // Pluto really does have a tenuous nitrogen atmosphere: New Horizons
  // photographed its layered blue haze backlit by the Sun in 2015, which is
  // why the tint here is blue rather than matching its tan surface.
  { name: "Pluto", radius: 0.55, distance: 88, speed: 0.004, color: 0xd9c7a1, tilt: 122.5,
    atmosphere: 0x9fc4e8, atmosphereOpts: { scale: 1.07, power: 3.6, opacity: 0.3 },
    roughness: 0.94, metalness: 0.02, bumpScale: 0.03,
    meta: { "Order": "Dwarf planet, Kuiper Belt", "Day length": "6.4 Earth days", "Year length": "248 Earth years" },
    info: "Pluto is the best-known dwarf planet, a small icy-rocky world in the Kuiper Belt with a heart-shaped nitrogen-ice plain called Tombaugh Regio. Reclassified from a planet to a dwarf planet in 2006.",
    moons: [
      { name: "Charon", radius: 0.26, distance: 1.3, speed: 1.6, hue: 220, sat: 5, baseLight: 50, craterCount: 20,
        meta: { "Diameter": "1,212 km", "Orbital period": "6.4 days" },
        info: "Charon is Pluto's largest moon, so big relative to Pluto that the two are tidally locked to each other and sometimes called a double dwarf-planet system." },
    ] },
];

export const sunInfo = {
  meta: { "Type": "G-type star", "Age": "~4.6 billion years", "Surface temp": "~5,500°C" },
  info: "The Sun is the star at the center of our solar system, containing 99.8% of the system's mass. Nuclear fusion in its core powers all life on Earth.",
};

export const ISS_INFO = {
  meta: { "Orbit": "Low Earth Orbit", "Inclination": "51.6°", "Orbital period": "~92 minutes" },
  info: "The International Space Station is a crewed research outpost orbiting Earth roughly every 92 minutes. It's a joint project of NASA, Roscosmos, ESA, JAXA and CSA. Live position, altitude and speed below come from a real-time satellite-tracking API.",
};

export const ORBIT_SPEED_SCALE = 0.2; // base multiplier so motion is visible but not too fast (halved for a calmer default pace)
export const SELF_SPIN_SCALE = 0.6;
export const ISS_ORBIT_SPEED = 3; // stylized orbit so it's satisfying to watch — not real-time (real period is ~92 min), slowed from its original stylized pace
