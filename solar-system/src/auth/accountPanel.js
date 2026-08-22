import { getSupabase, getSession, getProfile, isAuthConfigured, signOut } from "./supabaseClient.js";

// ---------- account panel ----------
// One screen for everything a signed-in person can do with their account,
// with sections revealed by role: profile and score history for everyone, a
// roster and invite tools for an institute admin, pending institutes for a
// super admin.
//
// THE ROLE CHECK HERE DECIDES WHAT TO DRAW, NEVER WHAT ANYONE MAY READ.
// Every query below goes through the anon key under RLS, so a student who
// edits `profile.role` in devtools to reveal the admin section gets an empty
// roster: the database refuses the rows regardless of what the UI believes.
// That separation is the whole reason the policies live in Postgres.
//
// EVERYTHING RENDERED HERE IS REAL PEOPLE'S DATA — names, email addresses,
// institute names. All of it is built with createElement and textContent, no
// innerHTML anywhere. This is the exact sink class the security audit found
// live in the news ticker (tasks/security.md, S1), and it matters more here:
// an admin viewing their roster is authenticated, so a script injected
// through a student's display name would run with an admin's session.

const modal = document.getElementById("accountModal");
const body = document.getElementById("accountBody");
const openBtn = document.getElementById("accountBtn");
const closeBtn = document.getElementById("accountClose");
const backdrop = document.getElementById("accountBackdrop");
const row = document.getElementById("accountRow");

const INVITE_ENDPOINT = "/.netlify/functions/invite-student";
const APPROVE_ENDPOINT = "/.netlify/functions/approve-institute";

// ---------- small DOM helpers ----------
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text; // never innerHTML — see header
  return node;
}

function section(title) {
  const wrap = el("section", "account-section");
  wrap.appendChild(el("h4", null, title));
  return wrap;
}

function field(label, value) {
  const p = el("p", "account-field");
  p.appendChild(el("span", "account-field-label", label));
  p.appendChild(el("span", "account-field-value", value ?? "—"));
  return p;
}

function formatDate(iso) {
  if (!iso) return "in progress";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

// Authenticated call to one of our own Netlify Functions. The access token is
// sent as a bearer header; the function verifies it with Supabase rather than
// trusting anything in the request body, so a forged "I am an admin" claim
// gets nowhere (netlify/functions/lib/supabaseAdmin.js).
async function callFunction(endpoint, payload) {
  const session = await getSession();
  if (!session) throw new Error("Your session has expired — sign in again.");
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

// ---------- sections ----------
function renderProfile(profile, session, instituteName) {
  const s = section("Profile");
  s.appendChild(field("Name", profile.full_name || "—"));
  s.appendChild(field("Email", session.user?.email));
  s.appendChild(field("Institute", instituteName || "—"));
  s.appendChild(field("Role", {
    student: "Student",
    institute_admin: "Institute admin",
    super_admin: "Super admin",
  }[profile.role] || profile.role));

  const out = el("button", "account-signout", "Sign out");
  out.addEventListener("click", async () => {
    await signOut();
    window.location.reload();
  });
  s.appendChild(out);
  return s;
}

async function renderMyScores() {
  const s = section("Your quiz history");
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("quiz_attempts")
    .select("id, started_at, completed_at, score, total_questions")
    .order("started_at", { ascending: false })
    .limit(20);

  if (error) {
    s.appendChild(el("p", "account-empty", "Couldn't load your history."));
    return s;
  }
  const attempts = (data || []).filter((a) => a.total_questions > 0);
  if (attempts.length === 0) {
    s.appendChild(el("p", "account-empty", "No quiz attempts yet — try the Quiz button."));
    return s;
  }

  const best = Math.max(...attempts.map((a) => (a.score / a.total_questions) || 0));
  s.appendChild(field("Attempts", String(attempts.length)));
  s.appendChild(field("Best", `${Math.round(best * 100)}%`));

  const list = el("ul", "account-list");
  attempts.forEach((a) => {
    const li = el("li");
    li.appendChild(el("span", "account-list-main", `${a.score ?? 0} / ${a.total_questions}`));
    li.appendChild(el("span", "account-list-meta", formatDate(a.completed_at || a.started_at)));
    list.appendChild(li);
  });
  s.appendChild(list);
  return s;
}

async function renderRoster() {
  const s = section("Your students");
  const supabase = await getSupabase();

  // No institute filter in the query: the RLS policy already restricts this to
  // the caller's own institute. Adding a client-side filter would imply the
  // filter is what provides the security, which it isn't.
  const { data: students, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    s.appendChild(el("p", "account-empty", "Couldn't load your roster."));
    return s;
  }

  const { data: attempts } = await supabase
    .from("quiz_attempts")
    .select("user_id, score, total_questions, completed_at");

  // Best score per student, so the roster answers "how is this class doing"
  // rather than just listing names.
  const bestByUser = new Map();
  (attempts || []).forEach((a) => {
    if (!a.total_questions) return;
    const pct = a.score / a.total_questions;
    if (!bestByUser.has(a.user_id) || pct > bestByUser.get(a.user_id).pct) {
      bestByUser.set(a.user_id, { pct, count: 0 });
    }
  });
  (attempts || []).forEach((a) => {
    const entry = bestByUser.get(a.user_id);
    if (entry) entry.count += 1;
  });

  const list = el("ul", "account-list");
  (students || []).forEach((p) => {
    const li = el("li");
    const name = p.full_name || p.email || "(no name or email on file)";
    li.appendChild(el("span", "account-list-main", p.role === "institute_admin" ? `${name} · admin` : name));
    const best = bestByUser.get(p.id);
    li.appendChild(
      el("span", "account-list-meta", best ? `best ${Math.round(best.pct * 100)}% · ${best.count} attempt${best.count === 1 ? "" : "s"}` : "no attempts yet")
    );
    list.appendChild(li);
  });

  if (!students || students.length === 0) {
    s.appendChild(el("p", "account-empty", "Nobody yet — invite your students below."));
  } else {
    s.appendChild(list);
  }
  return s;
}

function renderInvite(profile, institutes) {
  const s = section("Invite students");
  s.appendChild(el("p", "account-hint", "One email per line. They'll get a link to set their own password."));

  // An institute admin's invites always go to their own institute (the
  // server reads that from their profile). A super admin belongs to no
  // institute, so the server has nothing to fall back on — it needs to be
  // told which one explicitly, or every invite fails with "No institute
  // specified."
  let instituteSelect = null;
  if (profile.role === "super_admin") {
    s.appendChild(el("p", "account-hint", "Choose which institute to invite them into."));
    instituteSelect = el("select", "account-select");
    if (!institutes || institutes.length === 0) {
      const opt = el("option", null, "No approved institutes yet");
      opt.value = "";
      instituteSelect.appendChild(opt);
      instituteSelect.disabled = true;
    } else {
      institutes.forEach((inst) => {
        const opt = el("option", null, inst.name);
        opt.value = inst.id;
        instituteSelect.appendChild(opt);
      });
    }
    s.appendChild(instituteSelect);
  }

  const textarea = el("textarea", "account-textarea");
  textarea.rows = 4;
  textarea.placeholder = "student1@school.edu\nstudent2@school.edu";
  s.appendChild(textarea);

  const status = el("p", "account-status");
  const send = el("button", "account-primary", "Send invitations");

  send.addEventListener("click", async () => {
    const emails = textarea.value.split(/[\s,;]+/).map((e) => e.trim()).filter(Boolean);
    if (emails.length === 0) {
      status.textContent = "Add at least one email address.";
      return;
    }
    if (instituteSelect && !instituteSelect.value) {
      status.textContent = "Choose an institute first.";
      return;
    }
    send.disabled = true;
    status.textContent = "Sending…";
    try {
      const payload = { emails };
      if (instituteSelect) payload.instituteId = instituteSelect.value;
      const result = await callFunction(INVITE_ENDPOINT, payload);
      // Reported per address rather than as one pass/fail: pasting a class
      // list where two students already have accounts should still invite the
      // rest, and the admin needs to know which two.
      status.textContent = `${result.invited} invited${result.failed ? `, ${result.failed} failed` : ""}.`;
      if (result.failed) {
        const fails = el("ul", "account-list account-fails");
        result.results.filter((r) => !r.ok).forEach((r) => {
          const li = el("li");
          li.appendChild(el("span", "account-list-main", r.email));
          li.appendChild(el("span", "account-list-meta", r.error));
          fails.appendChild(li);
        });
        s.appendChild(fails);
      }
      if (result.invited) textarea.value = "";
    } catch (err) {
      status.textContent = err.message;
    }
    send.disabled = false;
  });

  s.appendChild(send);
  s.appendChild(status);
  return s;
}

async function renderPendingInstitutes() {
  const s = section("Institutes");
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("institutes")
    .select("id, name, contact_email, status, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    s.appendChild(el("p", "account-empty", "Couldn't load institutes."));
    return s;
  }
  if (!data || data.length === 0) {
    s.appendChild(el("p", "account-empty", "No institutes have requested access yet."));
    return s;
  }

  const status = el("p", "account-status");
  const list = el("ul", "account-list");

  data.forEach((inst) => {
    const li = el("li", "account-institute");
    const main = el("div", "account-institute-main");
    main.appendChild(el("span", "account-list-main", inst.name));
    main.appendChild(el("span", "account-list-meta", `${inst.contact_email} · ${inst.status}`));
    li.appendChild(main);

    const actions = el("div", "account-institute-actions");
    const setStatus = (next, label) => {
      const btn = el("button", "account-mini", label);
      btn.addEventListener("click", async () => {
        btn.disabled = true;
        status.textContent = `${label}…`;
        try {
          const res = await callFunction(APPROVE_ENDPOINT, { instituteId: inst.id, status: next });
          status.textContent = res.adminInvited
            ? `${inst.name} approved — its admin has been invited.`
            : `${inst.name} is now ${next}.` + (res.inviteError ? ` (invite failed: ${res.inviteError})` : "");
          await open(); // re-read, rather than patching the row we think changed
        } catch (err) {
          status.textContent = err.message;
          btn.disabled = false;
        }
      });
      return btn;
    };

    if (inst.status !== "approved") actions.appendChild(setStatus("approved", "Approve"));
    if (inst.status === "approved") actions.appendChild(setStatus("suspended", "Suspend"));
    li.appendChild(actions);
    list.appendChild(li);
  });

  s.appendChild(list);
  s.appendChild(status);
  return s;
}

// ---------- open / close ----------
async function open() {
  if (!body) return;
  body.replaceChildren(el("p", "account-empty", "Loading…"));
  modal?.classList.add("visible");

  const session = await getSession();
  if (!session) {
    body.replaceChildren(el("p", "account-empty", "You're not signed in."));
    return;
  }
  const profile = await getProfile();
  if (!profile) {
    body.replaceChildren(el("p", "account-empty", "Couldn't load your profile."));
    return;
  }

  const supabase = await getSupabase();

  // Scoped to the caller's OWN institute rather than fetching "the" institute.
  // A super admin can read every institute row (that is the point of the
  // role), so an unfiltered maybeSingle() throws the moment a second one
  // exists — the panel would work while there were zero or one institutes and
  // then break exactly when the approval queue it exists to manage started
  // filling up. Super admins belong to no institute, so this is skipped for
  // them entirely rather than guessing one.
  let instituteName = null;
  if (profile.institute_id) {
    const { data } = await supabase
      .from("institutes")
      .select("name")
      .eq("id", profile.institute_id)
      .maybeSingle();
    instituteName = data?.name ?? null;
  }

  const frag = document.createDocumentFragment();
  frag.appendChild(renderProfile(profile, session, instituteName));
  frag.appendChild(await renderMyScores());

  if (profile.role === "institute_admin" || profile.role === "super_admin") {
    frag.appendChild(await renderRoster());

    // Only a super admin needs the picker (see renderInvite) — an institute
    // admin's own institute is implicit, so skip the extra query for them.
    let institutesForInvite = null;
    if (profile.role === "super_admin") {
      const { data } = await supabase
        .from("institutes")
        .select("id, name")
        .eq("status", "approved")
        .order("name", { ascending: true });
      institutesForInvite = data || [];
    }
    frag.appendChild(renderInvite(profile, institutesForInvite));
  }
  if (profile.role === "super_admin") {
    frag.appendChild(await renderPendingInstitutes());
  }

  body.replaceChildren(frag);
}

function close() {
  modal?.classList.remove("visible");
}

export async function initAccountPanel() {
  // Nothing to show on a deployment with no backend, or to a visitor who
  // isn't signed in — the button stays hidden rather than opening an empty
  // panel that can't explain itself.
  if (!(await isAuthConfigured())) return;
  if (!(await getSession())) return;

  row?.classList.remove("hidden");
  openBtn?.addEventListener("click", open);
  closeBtn?.addEventListener("click", close);
  backdrop?.addEventListener("click", close);
}
