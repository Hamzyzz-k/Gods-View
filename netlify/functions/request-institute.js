import { guardRequest, capString } from "./lib/guard.js";
import { getAdminClient, json, validEmail } from "./lib/supabaseAdmin.js";

// A public form for an institute to request an account.
//
// This is the only endpoint here that an anonymous visitor may call, so it is
// also the only one that can be hammered by someone who was never invited.
// Three things keep that from mattering:
//
//   1. It writes a row with status 'pending', and a pending institute can do
//      nothing whatsoever until a super admin approves it. A flood of requests
//      is a tidying job, not a breach.
//   2. It is not insertable from the browser directly — the `institutes` table
//      has no client insert policy at all (supabase/schema.sql). Requests can
//      only arrive through here, where they can be rate-limited and bounded.
//   3. It never reports whether an institute already exists. Saying "that name
//      is taken" would turn this into a way to enumerate who is registered.

const MAX_NAME = 120;
const MAX_NOTE = 500;

export const handler = async (event) => {
  const rejected = guardRequest(event, { onReject: (message) => ({ error: message }) });
  if (rejected) return rejected;

  const admin = getAdminClient();
  if (!admin) return json(503, { error: "Auth is not configured on this deployment." });

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { error: "Malformed request." });
  }

  const name = capString(body.name, MAX_NAME).trim();
  const contactEmail = capString(body.contactEmail, 254).trim().toLowerCase();
  const note = capString(body.note, MAX_NOTE).trim();

  if (!name) return json(400, { error: "Institute name is required." });
  if (!validEmail(contactEmail)) return json(400, { error: "A valid contact email is required." });

  const { error } = await admin.from("institutes").insert({
    name,
    contact_email: contactEmail,
    status: "pending",
    // `note` is intentionally not stored: the table has no column for it, and
    // adding free text supplied by an anonymous caller to a row a super admin
    // will later read in a dashboard is a stored-XSS surface for no benefit.
    // The contact email is enough to follow up.
  });

  if (error) {
    console.error("institute request failed:", error.message);
    // Deliberately vague, and deliberately still 200-shaped below: the caller
    // learns nothing about whether this succeeded, failed on a duplicate, or
    // hit a database error.
  }

  // Always the same answer. See point 3 in the header.
  return json(200, { ok: true, message: "Request received. You'll hear back at the address you gave." });
};
