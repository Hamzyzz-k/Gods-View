import { AmbientAudio } from "../audio/ambientAudio.js";

// ---------- text-to-speech narration ----------
// Speaks two things out loud: (1) every AI Scene Assistant reply, and (2) a
// planet/sun/moon/ISS's description whenever its info panel opens. A single
// floating button (top-right) mutes/unmutes both; muting also stops
// whatever's currently being read.
//
// Two engines, tried in order:
//   1. ElevenLabs (natural AI voice) — only used if ELEVENLABS_API_KEY is set.
//   2. Browser's built-in Web Speech API — free, offline, no key, used as the
//      automatic fallback if ElevenLabs isn't configured OR its call fails
//      (rate limit, network error, bad key, etc.), same pattern as the
//      n8n-webhook → local-parser fallback for the chat agent above.
//
// ⚠️ SECURITY NOTE: unlike the NASA DEMO_KEY, an ElevenLabs key is billed
// per character and this calls its REST API directly from the browser, so
// the key sits in plain text in the shipped JS bundle — anyone can open
// devtools and lift it. That's fine for a personal demo, but before sharing
// this publicly, proxy the call through a backend instead (e.g. add a
// second n8n webhook that holds the key server-side and forwards
// {text} -> audio, mirroring how N8N_WEBHOOK_URL already proxies the chat
// agent). See "Open items" in the context doc.
export const ELEVENLABS_API_KEY = ""; // moved server-side — see netlify/functions/tts.js. Empty here falls back to Web Speech.
export const ELEVENLABS_VOICE_ID = "cT5LqmY8Y5dz4bRVJKSy"; // "Rachel" — a default premade voice, free-tier API friendly. IMPORTANT: swap only with voice_ids from your dashboard's "My Voices" tab — "Voice Library" (shared/community) voices return a 402 error on the free API tier
export const ELEVENLABS_MODEL_ID = "eleven_turbo_v2_5"; // fast + natural; use "eleven_multilingual_v2" if you want non-English narration

export const ttsToggleBtn = document.getElementById("ttsToggleBtn");
export const ttsSupported = "speechSynthesis" in window;
export let ttsMuted = localStorage.getItem("ttsMuted") === "true";

export function updateTtsButton() {
  if (!ttsSupported && !ELEVENLABS_API_KEY) {
    ttsToggleBtn.textContent = "🔇";
    ttsToggleBtn.title = "Voice narration isn't supported in this browser";
    ttsToggleBtn.classList.add("muted");
    ttsToggleBtn.disabled = true;
    return;
  }
  ttsToggleBtn.textContent = ttsMuted ? "🔇" : "🔊";
  ttsToggleBtn.title = ttsMuted ? "Unmute narration" : "Mute narration";
  ttsToggleBtn.classList.toggle("muted", ttsMuted);
}
updateTtsButton();

// Caches ElevenLabs audio by exact text, so re-opening the same planet (or
// hitting a repeated chat reply) replays the already-fetched clip instead of
// re-billing/re-fetching it. Cleared on reload — in-memory only, same
// caching philosophy as the ISS tracker's short-lived cache elsewhere in
// this file, just with no TTL since a given line's audio never goes stale.
export const ttsAudioCache = new Map(); // text -> object URL
export let currentAudio = null;
export let speakToken = 0; // bumped on every speak()/mute so a slow in-flight fetch can't play over a newer line

export async function fetchElevenLabsAudio(text) {
  if (ttsAudioCache.has(text)) return ttsAudioCache.get(text);
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
      "xi-api-key": ELEVENLABS_API_KEY,
    },
    body: JSON.stringify({
      text,
      model_id: ELEVENLABS_MODEL_ID,
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`ElevenLabs TTS error ${res.status}: ${body}`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  ttsAudioCache.set(text, url);
  return url;
}

export function speakWithBrowserVoice(text) {
  if (!ttsSupported) return;
  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = 1;
  utter.pitch = 1;
  utter.onstart = () => {
    ttsToggleBtn.classList.add("speaking");
    AmbientAudio.duck(true);
  };
  utter.onend = () => {
    ttsToggleBtn.classList.remove("speaking");
    AmbientAudio.duck(false);
  };
  utter.onerror = () => {
    ttsToggleBtn.classList.remove("speaking");
    AmbientAudio.duck(false);
  };
  window.speechSynthesis.speak(utter);
}

export async function speak(text) {
  if (!text) return;
  const token = ++speakToken;
  stopSpeaking(); // don't let lines overlap — new speech interrupts whatever was playing
  if (ttsMuted) return;

  if (ELEVENLABS_API_KEY) {
    ttsToggleBtn.classList.add("loading");
    try {
      const url = await fetchElevenLabsAudio(text);
      ttsToggleBtn.classList.remove("loading");
      // a newer speak() call (or a mute) happened while this fetch was in flight — drop this stale result
      if (token !== speakToken || ttsMuted) return;
      currentAudio = new Audio(url);
      currentAudio.onplay = () => {
        ttsToggleBtn.classList.add("speaking");
        AmbientAudio.duck(true);
      };
      currentAudio.onended = () => {
        ttsToggleBtn.classList.remove("speaking");
        AmbientAudio.duck(false);
      };
      currentAudio.onerror = () => {
        ttsToggleBtn.classList.remove("speaking");
        AmbientAudio.duck(false);
      };
      currentAudio.play();
      return;
    } catch (err) {
      ttsToggleBtn.classList.remove("loading");
      if (token !== speakToken) return;
      console.error("ElevenLabs TTS failed, falling back to browser voice:", err);
      // falls through to the browser voice below
    }
  }

  speakWithBrowserVoice(text);
}

export function stopSpeaking() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  if (ttsSupported) window.speechSynthesis.cancel();
  ttsToggleBtn.classList.remove("speaking");
  ttsToggleBtn.classList.remove("loading");
  AmbientAudio.duck(false);
}

if (ttsSupported || ELEVENLABS_API_KEY) {
  ttsToggleBtn.addEventListener("click", () => {
    ttsMuted = !ttsMuted;
    localStorage.setItem("ttsMuted", String(ttsMuted));
    updateTtsButton();
    if (ttsMuted) {
      speakToken++; // invalidate any in-flight ElevenLabs fetch too
      stopSpeaking();
    }
  });
}
