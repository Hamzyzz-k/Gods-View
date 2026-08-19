import { getSupabase, getSession, isAuthConfigured, signOut } from "./supabaseClient.js";

// ---------- the gate ----------
// Sits between the landing page and the 3D app. main.js awaits gateBeforeBoot()
// before building anything, so on a configured deployment no scene, no
// controls and no data requests happen until a real session exists.
//
// THREE RULES SHAPE THIS FILE.
//
// 1. The landing page stays public. Nothing here may render until the visitor
//    actually tries to enter — a login box appearing over the public landing
//    would defeat the point of having one.
//
// 2. It resolves immediately on a deployment with no Supabase configured, so
//    the site keeps working as an open demo until the backend is switched on.
//    The gate turns real the moment SUPABASE_URL is set, with no flag to
//    remember and no code change.
//
// 3. It is not the security boundary, and is not written as if it were. Every
//    line of this app is downloadable, so a determined person can bypass any
//    client-side gate. What actually protects student names and scores is the
//    row-level policies in supabase/schema.sql, which the database enforces
//    even against someone issuing their own queries with a valid session. This
//    gate is what stops the app opening for people who shouldn't have it; the
//    database is what stops data leaving.

const gate = document.getElementById("authGate");
const form = document.getElementById("authForm");
const emailEl = document.getElementById("authEmail");
const passwordEl = document.getElementById("authPassword");
const errorEl = document.getElementById("authError");
const submitEl = document.getElementById("authSubmit");
const ledeEl = document.getElementById("authLede");
const forgotBtn = document.getElementById("authForgot");
const backBtn = document.getElementById("authBackToLanding");

// The tier the visitor asked for when they clicked into the app, held across
// the login they had to do first so their choice isn't silently discarded.
let pendingTier = null;
let resolveGate = null;

// Whether the visitor has already tried to enter, and whether we have yet
// established that they must sign in first. These are separate because the
// two events race, and the ordering is not ours to control — see below.
let enterRequested = false;
let gating = false;

// REGISTERED SYNCHRONOUSLY, AT MODULE LOAD. This is load-bearing, not tidiness.
//
// gateBeforeBoot() has to await a network call (isAuthConfigured() fetches
// /public-config) before it can know whether to gate at all. Registering this
// listener after that await left a window — several seconds, if the function
// is cold-starting — in which a visitor clicking "Begin Exploration" fired
// gv:enter-app with nobody listening. The landing dismissed itself, the event
// was gone, and the gate then waited forever for a signal that had already
// been and passed: static UI chrome over a permanently black screen, with no
// error anywhere to explain it. That is exactly what happened on the first
// real deployment.
//
// Listening from module evaluation instead means the attempt is always
// recorded, whenever it happens, and gateBeforeBoot() can consult it once it
// knows what to do.
function onEnterAttempt(event) {
  pendingTier = event.detail?.tier ?? pendingTier;
  enterRequested = true;

  // Only swallow the event while actually gating. On an open deployment, or
  // for someone already signed in, main.js's own handler must still receive
  // it — otherwise picking a tier on the landing page would stop working for
  // everyone the moment auth was switched on.
  if (!gating) return;
  event.stopImmediatePropagation();
  show();
}
document.addEventListener("gv:enter-app", onEnterAttempt, true);

// The landing bundle hides itself with an inline display:none on its own root
// (landing-src/App.jsx's enterApp) — it sets no class on <body>. An earlier
// version of this check looked for a "landing-dismissed" body class that
// nothing has ever set, so it silently never fired. Reading the element's
// computed style asks the same question of the thing that actually changes.
function landingIsDismissed() {
  const root = document.getElementById("landing-root");
  if (!root || !root.firstChild) return true; // never mounted at all
  return getComputedStyle(root).display === "none";
}

function show() {
  gate?.classList.add("visible");
  // Focus the first field so a keyboard user isn't stranded, and so password
  // managers reliably offer to fill.
  setTimeout(() => emailEl?.focus(), 50);
}

function hide() {
  gate?.classList.remove("visible");
}

function setError(message) {
  if (errorEl) errorEl.textContent = message || "";
}

function setBusy(busy, label) {
  if (!submitEl) return;
  submitEl.disabled = busy;
  submitEl.textContent = busy ? label || "Working…" : "Sign in";
}

// Supabase's auth errors are written for developers. These are the three a
// student will actually hit, translated into something that tells them what to
// do next. Anything unrecognised is passed through rather than swallowed,
// because a message you can search for beats a friendly dead end.
function friendlyError(error) {
  const raw = String(error?.message || error || "");
  if (/invalid login credentials/i.test(raw)) {
    return "That email and password don't match. If you were invited but never set a password, use “Forgot password?”.";
  }
  if (/email not confirmed/i.test(raw)) {
    return "This account hasn't been activated yet — check your email for the invite link.";
  }
  if (/rate limit|too many/i.test(raw)) {
    return "Too many attempts. Wait a minute and try again.";
  }
  return raw || "Sign-in failed.";
}

async function handleSignIn(event) {
  event.preventDefault();
  setError("");
  setBusy(true, "Signing in…");
  try {
    const supabase = await getSupabase();
    const { error } = await supabase.auth.signInWithPassword({
      email: emailEl.value.trim(),
      password: passwordEl.value,
    });
    if (error) {
      setError(friendlyError(error));
      setBusy(false);
      return;
    }
    passwordEl.value = ""; // don't leave it sitting in the DOM after use
    hide();
    resolveGate?.();
    resolveGate = null;
  } catch (err) {
    setError(friendlyError(err));
    setBusy(false);
  }
}

async function handleForgot() {
  const email = emailEl.value.trim();
  if (!email) {
    setError("Enter your email address first, then press “Forgot password?”.");
    emailEl.focus();
    return;
  }
  setError("");
  setBusy(true, "Sending…");
  try {
    const supabase = await getSupabase();
    // Comes back to the app itself: Supabase puts a recovery token in the URL
    // fragment, and detectSessionInUrl (supabaseClient.js) turns it into a
    // session on load, so the link lands them signed in.
    await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
  } catch {
    // Deliberately ignored — see the message below.
  }
  setBusy(false);
  // Always the same wording, whether or not that address has an account.
  // Saying "no account found" would turn this box into a way to test which
  // email addresses belong to a given institute.
  setError("If that address has an account, a reset link is on its way.");
}

function handleBackToLanding() {
  hide();
  document.dispatchEvent(new CustomEvent("gv:show-landing"));
}

// ---------- public institute request ----------
// Lives on the sign-in card because that is where someone without an account
// actually ends up — a link buried on the landing page would be found by
// nobody who needed it.
const REQUEST_ENDPOINT = "/.netlify/functions/request-institute";

function initInstituteRequest() {
  const toggle = document.getElementById("instituteRequestToggle");
  const form = document.getElementById("instituteRequestForm");
  const nameEl = document.getElementById("instituteName");
  const emailEl = document.getElementById("instituteEmail");
  const statusEl = document.getElementById("instituteRequestStatus");
  const submitEl = document.getElementById("instituteRequestSubmit");
  if (!toggle || !form) return;

  toggle.addEventListener("click", () => {
    form.classList.toggle("hidden");
    if (!form.classList.contains("hidden")) nameEl?.focus();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    submitEl.disabled = true;
    statusEl.textContent = "Sending…";
    try {
      const res = await fetch(REQUEST_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nameEl.value.trim(), contactEmail: emailEl.value.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      // The endpoint deliberately answers the same way whether or not that
      // institute already exists, so there is nothing here to distinguish.
      statusEl.textContent = data.message || "Request received.";
      if (res.ok) form.reset();
    } catch {
      statusEl.textContent = "Couldn't send that just now — try again shortly.";
    }
    submitEl.disabled = false;
  });
}

export function takePendingTier() {
  const tier = pendingTier;
  pendingTier = null;
  return tier;
}

// Resolves when the app is allowed to boot. main.js awaits this before it
// builds anything.
export async function gateBeforeBoot() {
  // Not configured: this deployment has no backend yet, so there is nothing to
  // sign in to and the app stays open. Fails open ON PURPOSE and only in this
  // one case — an unconfigured project has no accounts and no student data to
  // protect, so refusing to start would break the site to guard nothing.
  if (!(await isAuthConfigured())) {
    document.removeEventListener("gv:enter-app", onEnterAttempt, true);
    return;
  }

  // Already signed in — including the case where the visitor has just followed
  // an invite or reset link, since detectSessionInUrl has already turned that
  // token into a session by now.
  if (await getSession()) {
    document.removeEventListener("gv:enter-app", onEnterAttempt, true);
    return;
  }

  gating = true;
  form?.addEventListener("submit", handleSignIn);
  forgotBtn?.addEventListener("click", handleForgot);
  backBtn?.addEventListener("click", handleBackToLanding);
  initInstituteRequest();

  // Ask straight away if the visitor is already past the landing page — either
  // because they clicked through while the checks above were still running
  // (the race this file's listener comment describes), or because they
  // reloaded directly into the app. In both cases no further enter event is
  // coming, so waiting for one would strand them on a black screen.
  if (enterRequested || landingIsDismissed()) show();

  await new Promise((resolve) => {
    resolveGate = resolve;
  });

  gating = false;
  document.removeEventListener("gv:enter-app", onEnterAttempt, true);
}

// Called once the app has booted. Signing out reloads rather than trying to
// tear the 3D scene down and rebuild it: a reload is one line and provably
// leaves nothing behind, where an incremental teardown is a long tail of
// listeners, GPU resources and cached tier scenes that would each have to be
// released correctly to avoid leaking one user's state into the next one's
// session.
export async function initSignOut() {
  if (!(await isAuthConfigured())) return;

  const supabase = await getSupabase();
  supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT") window.location.reload();
  });

  document.getElementById("signOutBtn")?.addEventListener("click", async () => {
    await signOut();
    window.location.reload();
  });
}

export { ledeEl as authLedeElement };
