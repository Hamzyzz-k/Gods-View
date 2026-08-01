import { AppState } from "../core/state.js";
import { sun } from "../scene/sun.js";
import { planets, orbitLines, allMoonMeshes } from "../scene/planetFactory.js";
import { asteroidBelt } from "../scene/asteroidBelt.js";
const { scene } = AppState;

// ---------- AI scene-control agent ----------
// A local natural-language command interpreter that decides what to show/hide
// in the scene. It's not a hosted-LLM call (a static downloadable file has
// nowhere safe to keep an API key) — it's a rule-based parser that handles a
// wide range of phrasing. To upgrade it to a real LLM: replace the body of
// interpretCommand() with an `await fetch('/your-backend/agent', ...)` call
// to a server you control that holds the API key, and have that backend
// return the same { reply, actions } shape this function returns locally.

export const PLANET_NAMES = planets.map((p) => p.data.name.toLowerCase());
export const INNER_PLANETS = ["mercury", "venus", "earth", "mars"];
// Pluto is included here to match how people actually say "outer planets",
// even though it is a dwarf planet and not one of the eight IAU planets.
// Keep this in sync with the vocabulary in netlify/functions/assistant.js.
export const OUTER_PLANETS = ["jupiter", "saturn", "uranus", "neptune", "pluto"];

// name -> { setVisible(bool) }
export const sceneRegistry = {};
planets.forEach(({ mesh, pivot, data }, i) => {
  const orbitLine = orbitLines[i];
  sceneRegistry[data.name.toLowerCase()] = {
    setVisible(v) {
      pivot.visible = v;
      orbitLine.visible = v && AppState.orbitLinesVisible;
    },
    isVisible() {
      return pivot.visible;
    },
  };
});
sceneRegistry["sun"] = {
  setVisible(v) {
    sun.visible = v;
  },
  isVisible() {
    return sun.visible;
  },
};
sceneRegistry["moon"] = {
  setVisible(v) {
    const earth = planets.find((p) => p.data.name === "Earth");
    if (earth?.data._moonPivot) earth.data._moonPivot.visible = v;
  },
  isVisible() {
    const earth = planets.find((p) => p.data.name === "Earth");
    return earth?.data._moonPivot?.visible ?? true;
  },
};

// Every major moon added for Mars/Jupiter/Saturn/Uranus/Neptune, registered
// individually by name (e.g. "titan", "europa") so the scene assistant can
// show/hide/target them just like a planet.
export const MOON_NAMES = [];
planets.forEach(({ data }) => {
  if (!data._moons) return;
  data._moons.forEach((m) => {
    const key = m.mesh.name.toLowerCase();
    MOON_NAMES.push(key);
    sceneRegistry[key] = {
      setVisible(v) {
        m.pivot.visible = v;
        m.orbitLine.visible = v;
      },
      isVisible() {
        return m.pivot.visible;
      },
    };
  });
});
// "moons" as a group toggles every moon at once — Earth's Moon plus all majors above.
sceneRegistry["moons"] = {
  setVisible(v) {
    sceneRegistry.moon.setVisible(v);
    MOON_NAMES.forEach((n) => sceneRegistry[n].setVisible(v));
  },
  isVisible() {
    return sceneRegistry.moon.isVisible();
  },
};
sceneRegistry["iss"] = {
  setVisible(v) {
    const earth = planets.find((p) => p.data.name === "Earth");
    if (earth?.data._issPivot) earth.data._issPivot.visible = v;
  },
  isVisible() {
    const earth = planets.find((p) => p.data.name === "Earth");
    return earth?.data._issPivot?.visible ?? true;
  },
};
sceneRegistry["rings"] = {
  setVisible(v) {
    const saturn = planets.find((p) => p.data.name === "Saturn");
    if (saturn?.data._ringMesh) saturn.data._ringMesh.visible = v;
  },
  isVisible() {
    const saturn = planets.find((p) => p.data.name === "Saturn");
    return saturn?.data._ringMesh?.visible ?? true;
  },
};
sceneRegistry["belt"] = {
  setVisible(v) {
    if (asteroidBelt) asteroidBelt.visible = v;
  },
  isVisible() {
    return asteroidBelt ? asteroidBelt.visible : true;
  },
};
// "asteroids" kept as an alias to the decorative belt so existing scene-assistant
// phrasing ("hide asteroids", "show asteroids") still works now that the live
// NASA near-Earth-object feature has been removed.
sceneRegistry["asteroids"] = sceneRegistry["belt"];
sceneRegistry["constellations"] = {
  setVisible(v) {
    AppState.constellations.visible = v;
  },
  isVisible() {
    return AppState.constellations.visible;
  },
};

export function setGroupVisible(names, visible) {
  names.forEach((n) => sceneRegistry[n]?.setVisible(visible));
}

export function setAllPlanetsVisible(visible) {
  setGroupVisible(PLANET_NAMES, visible);
}

export function setOrbitLinesVisible(visible) {
  AppState.orbitLinesVisible = visible;
  orbitLines.forEach((l, i) => {
    // respect individual planet visibility too
    l.visible = visible && planets[i].pivot.visible;
  });
}

