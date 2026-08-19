import { createClient } from "@supabase/supabase-js";

// ---------- Supabase client ----------
// The project URL and anon key are fetched from a Netlify Function rather
// than hardcoded here. Both values are safe to be public — the anon key is
// designed to be shipped to browsers, and everything it can reach is governed
// by the row-level policies in supabase/schema.sql — but keeping them out of
// the repo means the project can be swapped, or a key rotated, by changing an
// environment variable instead of editing and redeploying source.
//
// It also removes any chance of the SERVICE-ROLE key being pasted here by
// mistake later. That key bypasses every policy in the database and must only
// ever exist in Netlify Function environment variables. If you find yourself
// about to put a key in this file, it is the wrong key.

const CONFIG_ENDPOINT = "/.netlify/functions/public-config";

let clientPromise = null;

async function loadConfig() {
  const res = await fetch(CONFIG_ENDPOINT);
  if (!res.ok) throw new Error(`Auth is not configured (config endpoint returned ${res.status})`);
  const cfg = await res.json();
  if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) throw new Error("Auth is not configured (missing project URL or key)");
  return cfg;
}

// Single shared client, created on first use rather than at module load: the
// landing page is public and must not pay for — or fail because of — an auth
// round-trip that a visitor who never signs in does not need.
export function getSupabase() {
  if (!clientPromise) {
    clientPromise = loadConfig().then((cfg) =>
      createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          // The invite and recovery links Supabase emails carry their tokens
          // in the URL fragment; this consumes them on load so following one
          // lands the user in a real session.
          detectSessionInUrl: true,
        },
      })
    );
  }
  return clientPromise;
}

// True when the backend is wired up at all. Lets the UI say "auth isn't
// configured yet" instead of showing a login box that cannot possibly work.
export async function isAuthConfigured() {
  try {
    await getSupabase();
    return true;
  } catch {
    return false;
  }
}

export async function getSession() {
  const supabase = await getSupabase();
  const { data, error } = await supabase.auth.getSession();
  if (error) return null;
  return data.session ?? null;
}

// The caller's own profile row: institute and role. Read from the database
// rather than from the JWT, so a role change takes effect on next read instead
// of waiting for a token refresh.
export async function getProfile() {
  const supabase = await getSupabase();
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData?.session?.user?.id;
  if (!userId) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, institute_id, role, full_name")
    .eq("id", userId)
    .single();
  if (error) {
    // Logged rather than swallowed. A missing profile row is the single most
    // likely reason the account panel comes up empty, and it has a specific
    // cause worth naming: the row is created by a trigger on auth.users, so a
    // user made BEFORE schema.sql was applied never got one. Silently
    // returning null made that indistinguishable from being signed out.
    console.warn("Could not load your profile row:", error.message);
    return null;
  }
  return data;
}

export async function signOut() {
  const supabase = await getSupabase();
  await supabase.auth.signOut();
}

export async function onAuthChange(callback) {
  const supabase = await getSupabase();
  return supabase.auth.onAuthStateChange((_event, session) => callback(session));
}
