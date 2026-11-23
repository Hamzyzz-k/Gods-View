import { ASSISTANT_ENDPOINT } from "./config.js";
import { AppState } from "../core/state.js";
import { sun } from "../scene/sun.js";
import { planets, issProxyMesh } from "../scene/planetFactory.js";
import { sceneRegistry, setGroupVisible, setAllPlanetsVisible, setOrbitLinesVisible } from "./sceneRegistry.js";
import { interpretCommand, lastReplyWasAnswer } from "./localParser.js";
import { focusOnObject, clearFocus } from "../interaction/focus.js";
import { fetchBodyFacts } from "../data/bodyFacts.js";
import { fetchISSLive } from "../data/issLive.js";
import { speak } from "../voice/tts.js";
import { startTour, nextStop, prevStop, pauseTour, resumeTour, exitTour, jumpToPlanet } from "../tour/tourMode.js";
import { enterSurface, exitSurface } from "../surface/surfaceMode.js";
import { getSurfaceData } from "../surface/surfaceData.js";
import { ascendTierCinematic, descendTierCinematic, jumpToTierCinematic } from "../cosmos/tierTransition.js";
import { locateAndShow } from "./entityLocator.js";

// ---------- LLM agent via the Gemini-backed Netlify Function ----------

export async function getSceneContext() {
  const visible = [];
  const hidden = [];
  Object.entries(sceneRegistry).forEach(([name, obj]) => {
    (obj.isVisible() ? visible : hidden).push(name);
  });
  const focused = AppState.focusedTarget?.name?.toLowerCase() || null;
  // Real numbers for whatever's currently focused, so the AI can ground an
  // answer instead of guessing — cached after the first lookup, so usually instant.
  const focusedFacts =
    focused === "iss" ? await fetchISSLive().catch(() => null) : focused ? await fetchBodyFacts(focused) : null;
  return {
    visible,
    hidden,
    orbitLinesVisible: AppState.orbitLinesVisible,
    focused,
    focusedFacts,
    mode: AppState.mode,
    tourState: AppState.tourState,
    tier: AppState.tier,
  };
}

// Applies the { actions: [...] } array returned by the assistant to the scene.
export function applyActions(actions) {
  if (!Array.isArray(actions)) return;
  actions.forEach((action) => {
    switch (action.type) {
      case "show":
        setGroupVisible(action.targets || [], true);
        break;
      case "hide":
        setGroupVisible(action.targets || [], false);
        break;
      case "showOnly":
        setAllPlanetsVisible(false);
        setGroupVisible(action.targets || [], true);
        break;
      case "focus": {
        const target = (action.target || "").toLowerCase();
        const mesh =
          target === "sun"
            ? sun
            : target === "iss"
            ? issProxyMesh
            : planets.find((p) => p.data.name.toLowerCase() === target)?.mesh;
        if (mesh) {
          if (sceneRegistry[target] && !sceneRegistry[target].isVisible()) sceneRegistry[target].setVisible(true);
          focusOnObject(mesh);
        }
        break;
      }
      case "orbitLines":
        setOrbitLinesVisible(!!action.visible);
        break;
      case "reset":
        setAllPlanetsVisible(true);
        sceneRegistry.sun.setVisible(true);
        sceneRegistry.moons.setVisible(true);
        sceneRegistry.rings.setVisible(true);
        sceneRegistry.asteroids.setVisible(true);
        sceneRegistry.belt.setVisible(true);
        sceneRegistry.iss.setVisible(true);
        // Also clears any per-galaxy/cluster override (galaxyFactory.js's
        // setAllGalaxiesVisible resets that map) — without this, "reset"
        // never touched anything outside the solar system at all, not even
        // the collective galaxies toggle.
        sceneRegistry.galaxies.setVisible(true);
        setOrbitLinesVisible(true);
        clearFocus();
        break;
      // Guided Tour actions. Delegate to tour/tourMode.js's own state-machine
      // guards (e.g. startTour() refusing to run from Surface Mode) rather
      // than re-checking anything here.
      case "startTour":
        startTour();
        break;
      case "nextStop":
        nextStop();
        break;
      case "prevStop":
        prevStop();
        break;
      case "pauseTour":
        pauseTour();
        break;
      case "resumeTour":
        resumeTour();
        break;
      case "exitTour":
        exitTour();
        break;
      case "jumpToPlanet":
        jumpToPlanet(action.target || "");
        break;
      // Surface Mode actions.
      case "land": {
        const target = (action.target || "").toLowerCase();
        const name = planets.find((p) => p.data.name.toLowerCase() === target)?.data.name;
        if (name && getSurfaceData(name)) enterSurface(name);
        break;
      }
      case "exitSurface":
        exitSurface();
        break;
      // Cosmic scale-ladder actions. Same delegation pattern as the tour
      // actions above — cosmos/tierTransition.js's own guards (blocked
      // mid-transition, blocked outside the orbital mode, blocked past
      // either end of the ladder) are the single source of truth.
      case "ascendTier":
        ascendTierCinematic();
        break;
      case "descendTier":
        descendTierCinematic();
        break;
      case "jumpToTier":
        jumpToTierCinematic(action.target || "");
        break;
      case "startCosmicTour":
        startTour("cosmic");
        break;
      // Any named galaxy, black hole, or Earth landmark, from wherever the
      // user currently is — jumps tiers (or back to the solar system, for a
      // landmark) first if needed, rather than requiring the model to
      // sequence a separate jumpToTier action itself first. See
      // assistant/entityLocator.js's own header for why that hand-off is
      // more reliable done here than left to the model to get the ordering
      // right on every request.
      case "locate":
        locateAndShow(action.target || "");
        break;
    }
  });
}

// A plain static server on this machine (no Netlify runtime) answers every
// assistant call with 404. There, skip the backend after the first 404 so the
// console doesn't fill with one 404 per message. On the real site a 404 is a
// transient blip (cold start, mid-deploy), so it only pauses the backend for
// a short while and the next message after that tries again, instead of
// leaving the AI switched off until a reload.
const IS_LOCAL = ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);
const RETRY_AFTER_MS = 30_000;
const REQUEST_TIMEOUT_MS = 20_000;
let backendPausedUntil = 0;
let backendMissingLocally = false;

export async function callAssistant(command) {
  if (backendMissingLocally || Date.now() < backendPausedUntil) throw new Error("Assistant backend unavailable");
  const context = await getSceneContext();
  // A hung request would leave the reply stuck on "Thinking" forever; give up
  // after a while and answer offline instead.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(ASSISTANT_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command, context }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 404) {
    if (IS_LOCAL) backendMissingLocally = true;
    else backendPausedUntil = Date.now() + RETRY_AFTER_MS;
    throw new Error("Assistant function not found");
  }
  if (!res.ok) throw new Error("Assistant error " + res.status);
  const data = await res.json();
  // Tolerate a result nested under "output" as well as a flat body.
  const result = data.output || data;
  applyActions(result.actions);
  // No actions returned means the AI just answered a question rather than
  // controlling the scene — flag it so the UI can style it as a fact, not a command reply.
  const isAnswer = !result.actions || result.actions.length === 0;
  return { text: result.reply || "Done.", isAnswer };
}

export const agentLog = document.getElementById("agentLog");
export const agentForm = document.getElementById("agentForm");
export const agentInput = document.getElementById("agentInput");

export function logMessage(text, who) {
  const div = document.createElement("div");
  div.className = `msg ${who}`;
  div.textContent = text;
  agentLog.appendChild(div);
  agentLog.scrollTop = agentLog.scrollHeight;
  return div;
}

export async function runCommand(command) {
  if (!command.trim()) return;
  logMessage(command, "user");

  if (ASSISTANT_ENDPOINT) {
    const pending = logMessage("Thinking", "agent");
    pending.classList.add("thinking");
    try {
      const { text, isAnswer } = await callAssistant(command);
      pending.classList.remove("thinking");
      pending.textContent = text;
      if (isAnswer) pending.classList.add("answer");
      speak(text);
    } catch (err) {
      pending.classList.remove("thinking");
      const fallback = interpretCommand(command);
      // The `netlify dev` hint is only for a developer running the site from
      // plain static files on their own machine; visitors to the real site
      // just get told the AI is briefly unavailable.
      const reason = backendMissingLocally
        ? "offline mode — run `netlify dev` for AI answers"
        : "AI briefly unavailable, answered offline — try again in a moment";
      pending.textContent = `${fallback} (${reason})`;
      if (lastReplyWasAnswer) pending.classList.add("answer");
      speak(fallback);
    }
    return;
  }

  const reply = interpretCommand(command);
  const msgEl = logMessage(reply, "agent");
  if (lastReplyWasAnswer) msgEl.classList.add("answer");
  speak(reply);
}

agentForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const value = agentInput.value;
  agentInput.value = "";
  runCommand(value);
});

document.querySelectorAll(".chip").forEach((chip) => {
  chip.addEventListener("click", () => runCommand(chip.dataset.cmd));
});
