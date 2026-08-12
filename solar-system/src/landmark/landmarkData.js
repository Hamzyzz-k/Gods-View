// ---------- Earth landmark photospheres ----------
// Real, individually verified equirectangular (2:1 aspect ratio — the
// telltale sign of a genuine 360° panorama, not just a wide photo)
// panoramas from Wikimedia Commons, checked via WebFetch against the
// actual file pages (dimensions + license), not guessed. A candidate ISS
// interior photo was considered and dropped specifically because its
// dimensions (4928x3280) don't fit that 2:1 ratio — it's a normal
// rectilinear photo, and would look visibly wrong wrapped onto a sky
// dome the way a true equirectangular image does.
//
// Deliberately small (2 entries): this is the honest set that was
// actually verified in this pass, not a padded list. Add more by hand the
// same way — confirm the real dimensions before trusting a "360 panorama"
// label.
export const LANDMARK_DATA = [
  {
    name: "Taj Mahal",
    location: "Agra, India",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/f/fb/Taj_Mahal_360%C2%B0_View.jpg",
    meta: { Location: "Agra, India", Built: "1632-1653" },
    info: "A white marble mausoleum built by the Mughal emperor Shah Jahan for his wife Mumtaz Mahal. One of the most recognized buildings in the world and a UNESCO World Heritage Site.",
  },
  {
    name: "Alte Nationalgalerie",
    location: "Berlin, Germany",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/7/7c/Alte_Nationalgalerie%2C_Berlin-Mitte%2C_360_Grad_Panorama%2C_160101%2C_ako.jpg",
    meta: { Location: "Berlin, Germany", Built: "1876" },
    info: "A museum on Berlin's Museum Island, home to a major collection of Neoclassical, Romantic, Biedermeier, Impressionist, and early Modernist art.",
  },
];

export function getLandmark(name) {
  return LANDMARK_DATA.find((l) => l.name === name) || null;
}
