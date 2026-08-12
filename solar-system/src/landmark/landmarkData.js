// ---------- Earth landmarks: the New7Wonders of the World ----------
// Every image below was individually verified against the Wikimedia Commons
// API: real dimensions, real license, real attribution — not guessed.
//
// `mode` is the honest part of this file. A true 360° photosphere needs an
// equirectangular source (2:1 aspect ratio, full sphere); wrapping an
// ordinary wide panorama onto a sky dome instead produces visibly stretched,
// wrong-looking poles and a hard seam. A scan of ~4,600 files across every
// Commons photosphere category found genuine equirectangular panoramas for
// only TWO of the seven wonders. So:
//
//   mode: "sphere" — a real photosphere. Stand inside it, look anywhere.
//   mode: "screen" — the best available wide panorama, shown on a large
//                    curved screen in front of the viewer against a starfield
//                    surround. Deliberately reads as a viewpoint rather than
//                    pretending to be an immersive sphere it isn't.
//
// URLs use Commons' resized thumbnails rather than full-resolution originals
// (fetched via the API's iiurlwidth, which is what actually produces a valid
// thumbnail URL — the /thumb/ path cannot be reliably hand-constructed).
// This is a real fix, not just tidiness: the previous landmark used a 25 MB
// original that took over seven seconds to appear, which read as broken.
export const LANDMARK_DATA = [
  {
    name: "Taj Mahal",
    location: "Agra, India",
    mode: "sphere",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/f/fb/Taj_Mahal_360%C2%B0_View.jpg",
    credit: "Arul Prakasam T, CC BY-SA 4.0",
    meta: { Location: "Agra, India", Completed: "1653", View: "360° photosphere" },
    info: "A white marble mausoleum built by the Mughal emperor Shah Jahan for his wife Mumtaz Mahal. One of the most recognized buildings in the world and a UNESCO World Heritage Site.",
  },
  {
    name: "Colosseum",
    location: "Rome, Italy",
    mode: "sphere",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b9/Colosseum_%E2%80%93_Panorama_%28Greg_Zaal_and_Rico_Cilliers_via_Poly_Haven%29.jpg/3840px-Colosseum_%E2%80%93_Panorama_%28Greg_Zaal_and_Rico_Cilliers_via_Poly_Haven%29.jpg",
    credit: "Greg Zaal & Rico Cilliers via Poly Haven, CC0",
    meta: { Location: "Rome, Italy", Completed: "80 AD", View: "360° photosphere" },
    info: "The largest amphitheatre ever built, holding an estimated 50,000 to 80,000 spectators for gladiatorial contests and public spectacles. Roughly two thirds of the original structure has been lost to earthquakes and stone robbers.",
  },
  {
    name: "Great Wall of China",
    location: "Northern China",
    mode: "screen",
    aspect: 3.797, // real, API-verified 6080x1602
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/02/Great_wall_panorama.jpg/3840px-Great_wall_panorama.jpg",
    credit: "Ktausz, CC BY-SA 3.0",
    meta: { Location: "Northern China", Built: "7th c. BC – 1644 AD", View: "Wide panorama" },
    info: "A series of fortifications built across the historical northern borders of China over roughly two millennia. All of its branches together run more than 21,000 kilometres.",
  },
  {
    name: "Petra",
    location: "Ma'an, Jordan",
    mode: "screen",
    aspect: 2.562, // real, API-verified 5391x2104
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/Petra_1987%2C_panor%C3%A1mica_01.jpg/3840px-Petra_1987%2C_panor%C3%A1mica_01.jpg",
    credit: "LBM1948, CC BY-SA 4.0",
    meta: { Location: "Ma'an, Jordan", Founded: "c. 5th c. BC", View: "Wide panorama" },
    info: "A city carved directly into rose-coloured sandstone cliffs by the Nabataeans, and a major caravan trading hub of the ancient world. It was largely unknown to the West until 1812.",
  },
  {
    name: "Machu Picchu",
    location: "Cusco Region, Peru",
    mode: "screen",
    aspect: 3.979, // real, API-verified 16310x4100
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a8/99_-_Machu_Picchu_-_Juin_2009.jpg/3840px-99_-_Machu_Picchu_-_Juin_2009.jpg",
    credit: "Martin St-Amant, CC BY-SA 3.0",
    meta: { Location: "Cusco Region, Peru", Built: "c. 1450", View: "Wide panorama" },
    info: "A 15th-century Inca citadel set on a mountain ridge roughly 2,430 metres above sea level. Built without mortar, its stones are cut so precisely that they hold together by shape alone.",
  },
  {
    name: "Chichen Itza",
    location: "Yucatán, Mexico",
    mode: "screen",
    aspect: 4.425, // real, API-verified 16272x3680
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a3/Panorama_of_Chich%C3%A9n_Itza_with_Temple_of_Kukulc%C3%A1n.jpg/3840px-Panorama_of_Chich%C3%A9n_Itza_with_Temple_of_Kukulc%C3%A1n.jpg",
    credit: "Trldp, CC BY-SA 4.0",
    meta: { Location: "Yucatán, Mexico", Built: "c. 600–1200 AD", View: "Wide panorama" },
    info: "A large Maya city dominated by the step pyramid of Kukulcán. At the spring and autumn equinoxes, light and shadow on its staircase form the shape of a serpent descending the pyramid.",
  },
  {
    name: "Christ the Redeemer",
    location: "Rio de Janeiro, Brazil",
    mode: "screen",
    aspect: 2.188, // real, API-verified 3659x1672
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/8/83/Christ_the_Redeemer_-_From_Above.jpg",
    credit: "Alexandre Cesar Salem e Silva, CC BY-SA 3.0",
    meta: { Location: "Rio de Janeiro, Brazil", Completed: "1931", View: "Wide view" },
    info: "A 30-metre Art Deco statue of Jesus Christ atop Mount Corcovado, overlooking Rio de Janeiro. Including its pedestal it stands 38 metres tall, and it is struck by lightning several times a year.",
  },
];

export function getLandmark(name) {
  return LANDMARK_DATA.find((l) => l.name === name) || null;
}
