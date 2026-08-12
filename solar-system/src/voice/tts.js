import { AmbientAudio } from "../audio/ambientAudio.js";

// ---------- text-to-speech narration ----------
// Speaks two things out loud: (1) every AI Scene Assistant reply, and (2) a
// planet/sun/moon/ISS's description whenever its info panel opens. A single
// floating button (top-right) mutes/unmutes both; muting also stops
// whatever's currently being read.
//
// Two engines:
//   "webspeech"  — the browser's built-in SpeechSynthesis. Free, offline, no
//                  key, no billing. This is the default.
//   "elevenlabs" — natural AI voice, proxied through a Netlify Function so
//                  the API key stays server-side (the key used to sit in
//                  plain text in the shipped JS, where anyone could lift it
//                  from devtools).
//
// ElevenLabs bills per character, so it stays off by default and the browser
// voice is used instead. To switch (e.g. before a presentation), run this in
// the console and reload:
//
//   localStorage.setItem("ttsEngine", "elevenlabs")
//
// and set ELEVENLABS_API_KEY in the Netlify dashboard. If the proxy is
// unconfigured or errors for any reason, speak() silently falls back to the
// browser voice rather than going silent.
export const TTS_PROXY_ENDPOINT = "/.netlify/functions/tts";
export const ttsEngine = localStorage.getItem("ttsEngine") || "webspeech";
export const usingElevenLabs = ttsEngine === "elevenlabs";

export const ttsToggleBtn = document.getElementById("ttsToggleBtn");
export const ttsSupported = "speechSynthesis" in window;
export let ttsMuted = localStorage.getItem("ttsMuted") === "true";

export function updateTtsButton() {
  if (!ttsSupported && !usingElevenLabs) {
    ttsToggleBtn.textContent = "TTS";
    ttsToggleBtn.title = "Voice narration isn't supported in this browser";
    ttsToggleBtn.classList.add("muted");
    ttsToggleBtn.disabled = true;
    return;
  }
  ttsToggleBtn.textContent = "TTS";
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
  // Voice id and model live server-side in the proxy — the browser only ever
  // sends the text to speak.
  const res = await fetch(TTS_PROXY_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`TTS proxy error ${res.status}: ${body}`);
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

  if (usingElevenLabs) {
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

if (ttsSupported || usingElevenLabs) {
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
