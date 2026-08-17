# Backend Plan — Accounts, Institutes, Quiz Tracking

Planning document. Nothing here is built yet.

## Goal

Turn God's View from a fully public static site into an institution-gated
app:

- The **landing page stays public** — anyone can see it.
- The **app itself requires a login**, and accounts cannot be self-created.
- **Institutes** are tenants. An institute invites its own students; only
  invited email addresses can ever create an account.
- Every student has a personal account, and their **quiz answers and scores**
  are recorded against it.
- Institute staff can see their own students' results. Nobody can see another
  institute's.

## Decisions already made

| Question | Decision |
|---|---|
| Student access | Institute invites by email — only invited addresses can register |
| Institute signup | Institutes request an account; you approve each one |
| Gate strength | App requires a session; data secured by database rules |
| Offline fallback | None — login always required |

## Stack: Supabase

Supabase provides authentication, a Postgres database, and Row Level Security
in one service, on a free tier that comfortably covers a project this size.

**Why not AWS Cognito/IAM.** IAM governs permissions on *your own*
infrastructure, not end-user accounts — Cognito is the AWS service that maps
to this problem. It would work, but it is heavier to wire up, its console is
considerably more hostile, and an AWS account attached to a card is an
unnecessary billing risk for a student project.

**The deciding factor is Row Level Security.** Access rules live in the
database, not in the frontend:

```sql
-- A student can read their own attempts, and nothing else.
create policy "own attempts" on quiz_attempts
  for select using (auth.uid() = user_id);
```

This matters because the frontend is fully public code. Even if someone
opened the console and issued their own queries with a valid student session,
the database would still refuse to return another student's rows. Security
that depends on the frontend behaving correctly is not security here.

Netlify Functions stay exactly as they are for the existing API-key proxies
(`assistant`, `tts`, `facts`), plus a few new ones described below.

## Data model

```
institutes
  id, name, contact_email, status (pending|approved|suspended), created_at

profiles                      -- one row per auth user
  id (FK -> auth.users.id), institute_id, role, full_name, created_at
  role: student | institute_admin | super_admin

quiz_attempts
  id, user_id, started_at, completed_at, score, total_questions

quiz_answers                  -- per-question detail, not just the final score
  id, attempt_id, question_text, chosen_answer, correct_answer,
  is_correct, answered_at
```

`quiz_answers` is separate from `quiz_attempts` on purpose. Storing only a
final score answers "how did they do"; storing each answer answers "which
concepts is this class getting wrong", which is the question an institute
actually cares about.

Optionally, `trip_log_entries` later — `edu/tripLog.js` currently keeps its
history in localStorage, so it is lost on a browser change. Same shape of
work as the quiz, worth doing only once the quiz path is proven.

### Access rules

| Table | Student | Institute admin | Super admin |
|---|---|---|---|
| `profiles` | own row | own institute's students | all |
| `quiz_attempts` / `quiz_answers` | own rows, insert own | read own institute's | all |
| `institutes` | own institute, read | own institute, read | all, and approve |

## Registration: how "no open signup" is actually enforced

Self-service email signup is **turned off** in Supabase entirely. That single
setting is what makes the rule real — everything else is convenience on top.

Accounts are only ever created through the invite path:

1. Institute admin enters student emails (single or bulk paste).
2. A Netlify Function verifies the caller really is an admin of an
   **approved** institute, then calls Supabase's admin
   `inviteUserByEmail()` with the institute id attached.
3. Supabase emails the student an invite link.
4. The student follows it and sets a password.
5. A database trigger creates their `profiles` row, reading the institute id
   off the invite, with `role = student`.

Two details that matter:

- **The service-role key never reaches the browser.** The invite call runs
  inside a Netlify Function, the same pattern the existing `assistant`
  function already uses to keep the Gemini key server-side.
- **The client never queries an "invited emails" table.** If it did, someone
  could probe it to discover which addresses belong to a given institute.
  Because invitation is a server-side action, there is nothing to enumerate.

### Institute signup

1. A public form submits a request — institute name and contact email —
   creating a row with `status = 'pending'`.
2. You approve it from a super-admin view.
3. On approval, the contact email is invited as that institute's first
   `institute_admin`, who can then invite students.

A pending institute can do nothing at all until approved.

## Frontend changes

**Keep the current single page.** Splitting into `index.html` (public) and
`app.html` (gated) is the more obvious structure, but it would break the
landing page's best moment — the 3D scene currently boots *behind* the
landing, so dismissing it drops you straight into a running universe. Two
pages means a hard reload there.

Instead, `src/main.js` becomes conditional:

- Landing page loads for everyone, unchanged and fully working — the gravity
  demo, curiosity scroll, and tier gallery all stay public.
- "Begin Exploration" checks for a session. No session, an auth panel appears.
- The 3D app only boots once a valid session exists.

**Known trade-off:** the scene currently begins loading during the landing
scroll. Gated, it starts loading after login instead, so first entry will
feel slower. Worth accepting for a much smaller change surface.

New screens needed:

- Login / accept-invite / password reset
- Student dashboard — past attempts, score history
- Institute console — roster, invite students, view results
- Super-admin — approve institutes

## Quiz tracking

`edu/quiz.js` currently keeps score in memory and forgets it on reload. It
gains: create an attempt row on start, insert each answer as it is given, and
finalise the attempt with a score at the end. Writing answers as they happen
rather than in one batch at the end means a student who closes the tab
mid-quiz still leaves usable data.

## Build order

Each phase leaves the app working, so this can stop at any point.

1. **Supabase setup** — schema, RLS policies, disable public signup, seed your
   super-admin account. Verify policies by trying to read another user's rows
   and confirming it fails.
2. **Auth gate** — login screen, session handling, conditional app boot.
3. **Invite flow** — Netlify Function plus institute-admin invite UI.
4. **Quiz persistence** — write attempts and answers.
5. **Student dashboard** — personal score history.
6. **Institute console** — roster and per-student results.
7. **Institute signup and approval** — public request form, super-admin view.

Phases 1–2 are the risky ones. Everything after is ordinary CRUD.

## Cost

Free, at this scale.

- **Supabase free:** 50,000 monthly active users, 500 MB database, 5 GB
  bandwidth. A cohort of students will not come close.
- **Netlify free:** already in use.

## Risks worth knowing now

**Supabase free projects pause after 7 days of inactivity.** A paused project
must be manually resumed from the dashboard, and while paused the app cannot
log anyone in. Before any demo or presentation, open the Supabase dashboard
and confirm the project is awake. This is the single most likely way this
setup fails at the worst possible moment.

**No offline fallback, by choice.** If the venue network or Supabase is
unreachable during a presentation, the app will not open at all. Since there
is no code-level fallback, mitigation is operational: log in before you
present so a session already exists, and carry a phone hotspot. A Supabase
session persists for about an hour, so a brief drop mid-demo is survivable —
a drop *before* you log in is not.

**Supabase's built-in email is rate-limited to a handful per hour.** It is
meant for development. Inviting a real class will hit that limit immediately.
Custom SMTP via **Brevo** is the decided answer — see `security.md` for setup
notes, including the SPF/DKIM step that keeps invites out of spam.

**An XSS bug would defeat this entire design.** The session token lives in
`localStorage`, so any script running on the page can steal it regardless of
how strict the database rules are. There is a live XSS vulnerability in the
news ticker today; it must be fixed before auth ships. See `security.md`, S1.

**The app's code stays publicly downloadable.** Agreed and understood: the
gate protects accounts, rosters, and scores, not the JavaScript. Anyone
determined can still read the 3D source from the network tab.

**One institute admin is a single point of failure.** If that person loses
access, their institute cannot invite anyone. Allowing more than one admin per
institute costs nothing now and is painful to retrofit later.

## Open questions for later

- Should a student be able to delete their own account and data? Worth
  deciding before real student data exists rather than after.
- Should institute admins see individual students by name, or only aggregate
  class performance? This is a real privacy call, not a technical one.
- Does a student belong to exactly one institute, or could they move between
  them? Single-institute is assumed above and is far simpler.
