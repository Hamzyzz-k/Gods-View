import { guardRequest } from "./lib/guard.js";
import { getAdminClient, requireApprovedInstituteAdmin, json, validEmail } from "./lib/supabaseAdmin.js";

// Invites students to an institute.
//
// This function is the ONLY way an account can come into existence, which is
// what makes "only invited students can register" true rather than aspirational.
// Self-service signup is turned off in the Supabase dashboard (see
// supabase/SETUP.md); with that off and this the sole invite path, there is no
// route to an account that doesn't pass through the checks below.
//
// Three things happen here that cannot be done from the browser:
//
//   1. The caller is verified as an admin of an APPROVED institute. The client
//      is never asked which institute it belongs to — that is read from the
//      caller's own profile row, so a student cannot invite anyone by editing
//      a request, and an admin cannot invite into an institute that isn't
//      theirs.
//   2. The institute id and role are attached as app_metadata. That field is
//      writable only with the service-role key, and the database trigger that
//      creates the profile reads it from there rather than from user_metadata
//      — which the user themselves can edit, and which would otherwise let
//      anyone sign up as a super admin.
//   3. There is no "invited emails" table for the client to read. Invitation
//      is a server action with no client-visible list, so there is nothing to
//      enumerate to discover who belongs to an institute.

const MAX_EMAILS_PER_CALL = 40;

export const handler = async (event) => {
  const rejected = guardRequest(event, { onReject: (message) => ({ error: message }) });
  if (rejected) return rejected;

  const caller = await requireApprovedInstituteAdmin(event);
  if (caller.error) return json(caller.status, { error: caller.error });

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { error: "Malformed request." });
  }

  const emails = Array.isArray(body.emails) ? body.emails : [body.email];
  const cleaned = emails
    .filter((e) => typeof e === "string")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (cleaned.length === 0) return json(400, { error: "No email addresses provided." });
  if (cleaned.length > MAX_EMAILS_PER_CALL) {
    return json(400, { error: `Too many at once — ${MAX_EMAILS_PER_CALL} maximum per request.` });
  }

  // A super admin may name the institute to invite into; an institute admin
  // never can, and always gets their own.
  const instituteId =
    caller.profile.role === "super_admin" ? body.instituteId || null : caller.profile.institute_id;
  if (!instituteId) return json(400, { error: "No institute specified." });

  // Only ever 'student' or 'institute_admin' from here, and only a super admin
  // may create another admin. Nothing can mint a super admin over HTTP at all
  // — that is done once, by hand, in the SQL editor.
  let role = "student";
  if (body.role === "institute_admin") {
    if (caller.profile.role !== "super_admin") {
      return json(403, { error: "Only a super admin can create institute admins." });
    }
    role = "institute_admin";
  }

  const admin = getAdminClient();
  const redirectTo = process.env.SITE_ORIGIN || undefined;

  const results = [];
  for (const email of cleaned) {
    if (!validEmail(email)) {
      results.push({ email, ok: false, error: "Not a valid email address." });
      continue;
    }
    const { error } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo,
      data: { invited_by_institute: instituteId }, // user_metadata: display only, never trusted
      // app_metadata is the security-bearing half — see the header.
      // Supabase's invite API nests it under this key.
      appMetadata: { institute_id: instituteId, role },
    });
    if (error) {
      // Reported per-address rather than failing the whole batch: pasting a
      // class list where one student already has an account should invite the
      // rest, not silently do nothing.
      results.push({ email, ok: false, error: error.message });
    } else {
      results.push({ email, ok: true });
    }
  }

  const invited = results.filter((r) => r.ok).length;
  return json(200, { invited, failed: results.length - invited, results });
};
