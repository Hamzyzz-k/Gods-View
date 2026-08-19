import { createClient } from "@supabase/supabase-js";

// ---------- server-side Supabase helpers ----------
// Everything in this file exists because of one key: SUPABASE_SERVICE_ROLE_KEY
// bypasses every row-level policy in the database. With it, "read one student's
// score" and "read every student's score" are the same call. It must never be
// sent to a browser, never appear in a client bundle, and never be logged.
//
// It lives here — inside netlify/functions/lib/, which Netlify does not publish
// as an endpoint because only top-level files in the functions directory
// become routes — and is read from the environment at call time rather than
// captured anywhere it could be serialised.

let adminClient = null;

export function getAdminClient() {
  if (adminClient) return adminClient;
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;

  adminClient = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return adminClient;
}

// Identifies the CALLER from their own access token, then reads their profile
// with admin rights.
//
// The token comes from the Authorization header, and is verified by Supabase
// rather than decoded here — a JWT's payload is only base64, so anyone can
// write one claiming to be a super admin. getUser(token) checks the signature,
// which is what makes the answer trustworthy.
//
// The role and institute are then read from the profiles TABLE rather than
// from the token's claims, so revoking someone's admin rights takes effect on
// their next request instead of whenever their token happens to expire.
export async function getCaller(event) {
  const admin = getAdminClient();
  if (!admin) return { error: "Auth is not configured on this deployment.", status: 503 };

  const header = event.headers?.authorization || event.headers?.Authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return { error: "Not signed in.", status: 401 };

  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) return { error: "Session is not valid.", status: 401 };

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, institute_id, role")
    .eq("id", data.user.id)
    .single();
  if (profileError || !profile) return { error: "No profile for this account.", status: 403 };

  return { user: data.user, profile };
}

// An institute admin may only ever act on their OWN institute, and only if it
// has actually been approved. A pending or suspended institute can do nothing
// — which is what makes "you approve each institute" a real control rather
// than a label on a row.
export async function requireApprovedInstituteAdmin(event) {
  const caller = await getCaller(event);
  if (caller.error) return caller;

  const { profile } = caller;
  if (profile.role !== "institute_admin" && profile.role !== "super_admin") {
    return { error: "This action requires institute admin rights.", status: 403 };
  }
  // A super admin has no institute of their own; they act on one named in the
  // request, checked by the caller.
  if (profile.role === "super_admin") return caller;

  if (!profile.institute_id) return { error: "Your account isn't linked to an institute.", status: 403 };

  const admin = getAdminClient();
  const { data: institute, error } = await admin
    .from("institutes")
    .select("id, status, name")
    .eq("id", profile.institute_id)
    .single();
  if (error || !institute) return { error: "Institute not found.", status: 403 };
  if (institute.status !== "approved") {
    return { error: `Your institute is ${institute.status}. It must be approved before you can invite students.`, status: 403 };
  }

  return { ...caller, institute };
}

export async function requireSuperAdmin(event) {
  const caller = await getCaller(event);
  if (caller.error) return caller;
  if (caller.profile.role !== "super_admin") {
    return { error: "This action requires super admin rights.", status: 403 };
  }
  return caller;
}

export function json(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

// Rejects anything that isn't plausibly an email before it reaches Supabase.
// Not a validity guarantee — only delivery proves that — but it keeps obvious
// junk and oversized input out of the invite path.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export function validEmail(value) {
  return typeof value === "string" && value.length <= 254 && EMAIL_RE.test(value.trim());
}
