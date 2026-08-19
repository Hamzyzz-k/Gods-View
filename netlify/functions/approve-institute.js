import { guardRequest } from "./lib/guard.js";
import { getAdminClient, requireSuperAdmin, json, validEmail } from "./lib/supabaseAdmin.js";

// Approves (or suspends) an institute, and invites its first admin.
//
// Super admin only. Approval is the moment an institute goes from being able
// to do nothing at all to being able to create accounts, so this is the single
// most consequential endpoint in the system — which is why the caller's role
// is read from the database rather than from their token's claims, and why
// there is no way to reach it without a verified session.
//
// Approving also invites the institute's contact address as its first
// institute_admin. Doing both in one action rather than leaving the invite as
// a separate manual step means an approved institute is never left in a state
// where it is allowed to invite students but has nobody able to do it.

const VALID_STATUSES = ["approved", "suspended", "pending"];

export const handler = async (event) => {
  const rejected = guardRequest(event, { onReject: (message) => ({ error: message }) });
  if (rejected) return rejected;

  const caller = await requireSuperAdmin(event);
  if (caller.error) return json(caller.status, { error: caller.error });

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { error: "Malformed request." });
  }

  const instituteId = typeof body.instituteId === "string" ? body.instituteId : null;
  const status = VALID_STATUSES.includes(body.status) ? body.status : null;
  if (!instituteId) return json(400, { error: "instituteId is required." });
  if (!status) return json(400, { error: `status must be one of: ${VALID_STATUSES.join(", ")}` });

  const admin = getAdminClient();

  const { data: institute, error: readError } = await admin
    .from("institutes")
    .select("id, name, contact_email, status")
    .eq("id", instituteId)
    .single();
  if (readError || !institute) return json(404, { error: "Institute not found." });

  const wasApproved = institute.status === "approved";

  const { error: updateError } = await admin
    .from("institutes")
    .update({ status })
    .eq("id", instituteId);
  if (updateError) {
    console.error("institute status update failed:", updateError.message);
    return json(502, { error: "Could not update the institute." });
  }

  // Only on the transition INTO approved, and only once — re-approving an
  // already-approved institute must not spam its contact with fresh invites.
  let adminInvited = false;
  let inviteError = null;
  if (status === "approved" && !wasApproved && validEmail(institute.contact_email)) {
    const { error } = await admin.auth.admin.inviteUserByEmail(institute.contact_email, {
      redirectTo: process.env.SITE_ORIGIN || undefined,
      appMetadata: { institute_id: instituteId, role: "institute_admin" },
    });
    if (error) {
      // Reported, not fatal: the status change is already committed and
      // correct. An invite can be re-sent; a half-applied approval cannot be
      // reasoned about later.
      inviteError = error.message;
    } else {
      adminInvited = true;
    }
  }

  return json(200, {
    ok: true,
    institute: { id: institute.id, name: institute.name, status },
    adminInvited,
    inviteError,
  });
};
