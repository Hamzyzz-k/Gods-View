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
  return { visible, hidden, orbitLinesVisible: AppState.orbitLinesVisible, focused, focusedFacts };
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
        setOrbitLinesVisible(true);
        clearFocus();
        break;
    }
  });
}

// Cleared once the assistant function turns out not to be deployed, so a
// static build (no Netlify runtime) logs one 404 instead of one per message
// and goes straight to the local parser thereafter. Resets on reload.
let assistantBackendAvailable = true;

export async function callAssistant(command) {
  if (!assistantBackendAvailable) throw new Error("Assistant backend unavailable");
  const context = await getSceneContext();
  const res = await fetch(ASSISTANT_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ command, context }),
  });
  if (res.status === 404) {
    assistantBackendAvailable = false;
    throw new Error("Assistant function not deployed");
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
    const pending = logMessage("…", "agent");
    try {
      const { text, isAnswer } = await callAssistant(command);
      pending.textContent = text;
      if (isAnswer) pending.classList.add("answer");
      speak(text);
    } catch (err) {
      const fallback = interpretCommand(command);
      pending.textContent = `${fallback} (AI assistant unreachable — used local fallback)`;
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
