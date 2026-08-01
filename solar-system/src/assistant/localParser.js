import { ASSISTANT_ENDPOINT } from "./config.js";
import { issProxyMesh } from "../scene/planetFactory.js";
import { sun } from "../scene/sun.js";
import { planets } from "../scene/planetFactory.js";
import { planetData, sunInfo, ISS_INFO } from "../scene/planetData.js";
import { sceneRegistry, PLANET_NAMES, INNER_PLANETS, OUTER_PLANETS, MOON_NAMES, setGroupVisible, setAllPlanetsVisible, setOrbitLinesVisible } from "./sceneRegistry.js";
import { focusOnObject, clearFocus } from "../interaction/focus.js";
import { AppState } from "../core/state.js";

// Resolve every recognizable target mentioned in the text (planets, sun, moon, rings, groups).
export function extractTargets(text) {
  const found = new Set();
  PLANET_NAMES.forEach((name) => {
    if (text.includes(name)) found.add(name);
  });
  MOON_NAMES.forEach((name) => {
    if (text.includes(name)) found.add(name);
  });
  if (/\bsun\b/.test(text)) found.add("sun");
  if (/\bmoons\b/.test(text)) {
    found.add("moon");
    MOON_NAMES.forEach((n) => found.add(n));
  } else if (/\bmoon\b/.test(text)) {
    found.add("moon");
  }
  if (/\bring/.test(text)) found.add("rings");
  if (/\basteroid|asteroids|rocks|neos?\b/.test(text)) found.add("asteroids");
  if (/\bbelt\b/.test(text)) found.add("belt");
  if (/\biss\b|\bspace station\b/.test(text)) found.add("iss");
  if (/\bconstellations?\b/.test(text)) found.add("constellations");
  if (/\binner planets?\b/.test(text)) INNER_PLANETS.forEach((n) => found.add(n));
  if (/\bouter planets?\b/.test(text)) OUTER_PLANETS.forEach((n) => found.add(n));
  if (/\ball planets?\b|\beverything\b|\ball\b/.test(text)) PLANET_NAMES.forEach((n) => found.add(n));
  return [...found];
}

export let lastReplyWasAnswer = false; // set by interpretCommand so the UI can style facts differently from command confirmations

export function interpretCommand(raw) {
  lastReplyWasAnswer = false;
  const text = raw.toLowerCase().trim();

  // Reset / show everything
  if (/^(reset|show everything|show all|reset view|start over)/.test(text)) {
    setAllPlanetsVisible(true);
    sceneRegistry.sun.setVisible(true);
    sceneRegistry.moons.setVisible(true);
    sceneRegistry.rings.setVisible(true);
    sceneRegistry.asteroids.setVisible(true);
    sceneRegistry.belt.setVisible(true);
    sceneRegistry.iss.setVisible(true);
    setOrbitLinesVisible(true);
    clearFocus();
    return "Showing everything again — full solar system restored.";
  }

  // Informational questions ("tell me about Saturn", "what is this?") — answered
  // from local planet data so this works even with no backend configured.
  const questionMatch = text.match(
    /\b(?:tell me about|what is|what's|who is|who's|explain)\s+(?:the\s+)?(international space station|space station|\w+)/
  );
  if (questionMatch) {
    const word = questionMatch[1];
    const target =
      word === "this" || word === "it" ? AppState.focusedTarget?.name?.toLowerCase() : word.includes("station") ? "iss" : word;
    const info =
      target === "sun"
        ? sunInfo
        : target === "iss"
        ? ISS_INFO
        : planets.find((p) => p.data.name.toLowerCase() === target)?.data;
    if (info) {
      lastReplyWasAnswer = true;
      return ASSISTANT_ENDPOINT ? info.info : `${info.info} (Connect the AI assistant for open-ended astronomy questions beyond the planets.)`;
    }
  }

  // Focus / zoom on a specific body
  const focusMatch = text.match(
    /(?:focus on|zoom (?:in )?on|take me to|look at|go to)\s+(?:the\s+)?(international space station|space station|\w+)/
  );
  if (focusMatch) {
    const word = focusMatch[1];
    const target = word.includes("station") ? "iss" : word;
    const mesh = target === "sun" ? sun : target === "iss" ? issProxyMesh : planets.find((p) => p.data.name.toLowerCase() === target)?.mesh;
    if (mesh) {
      if (sceneRegistry[target] && !sceneRegistry[target].isVisible()) sceneRegistry[target].setVisible(true); // reveal if hidden
      focusOnObject(mesh);
      return `Focusing on ${mesh.name}.`;
    }
    return `I don't recognize "${target}" as something I can focus on.`;
  }

  const isHide = /\b(hide|remove|turn off|disable|don't show|get rid of)\b/.test(text);
  const isShow = /\b(show|display|turn on|enable|reveal|bring back|add)\b/.test(text);
  const isOnly = /\bonly\b|\bjust\b/.test(text);

  const targets = extractTargets(text);

  // Standalone orbit-line toggle
  if (/orbit lines?|orbits|paths/.test(text)) {
    if (isHide) {
      setOrbitLinesVisible(false);
      return "Hid the orbit lines.";
    }
    if (isShow) {
      setOrbitLinesVisible(true);
      return "Orbit lines are back on.";
    }
  }

  if (targets.length === 0) {
    return "I'm not sure what to show or hide — try something like \"hide Mars\", \"show only the outer planets\", or \"focus on Saturn\".";
  }

  if (isOnly) {
    // Hide every planet, then reveal only the mentioned ones
    setAllPlanetsVisible(false);
    setGroupVisible(targets, true);
    return `Showing only: ${targets.join(", ")}.`;
  }

  if (isHide) {
    setGroupVisible(targets, false);
    return `Hid: ${targets.join(", ")}.`;
  }

  if (isShow) {
    setGroupVisible(targets, true);
    return `Showing: ${targets.join(", ")}.`;
  }

  // Mentioned a target with no clear verb — default to showing it
  setGroupVisible(targets, true);
  return `Showing: ${targets.join(", ")}.`;
}
