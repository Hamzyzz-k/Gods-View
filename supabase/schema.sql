-- God's View — accounts, institutes, quiz tracking
--
-- Run this once in the Supabase SQL editor (Dashboard -> SQL Editor -> New
-- query -> paste -> Run). It is idempotent: running it again is safe and
-- changes nothing, so it can be re-applied after edits without dropping data.
--
-- READ THIS BEFORE CHANGING ANY POLICY BELOW.
--
-- The frontend of this app is public code. Anyone can open devtools, read the
-- anon key out of it, and issue their own queries against this database with
-- a perfectly valid student session. That is not a flaw to be fixed — the
-- anon key is designed to be public. It means the ONLY thing standing between
-- one student and another student's data is the policies in this file.
-- Frontend checks are convenience; these are the security boundary.
--
-- Two rules follow from that:
--   1. Every table gets `enable row level security`. A table without it is
--      readable by anyone holding the anon key, which is everyone.
--   2. There is no policy anywhere that trusts a value sent by the client to
--      decide who someone is. Identity comes from auth.uid() only.

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.institutes (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  contact_email text not null,
  -- pending: requested, can do nothing at all until approved.
  -- suspended: kept rather than deleted so scores survive a lapsed institute.
  status        text not null default 'pending'
                check (status in ('pending', 'approved', 'suspended')),
  created_at    timestamptz not null default now()
);

-- One row per auth user. Separate from auth.users because that table belongs
-- to Supabase and should not be extended directly.
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  institute_id uuid references public.institutes(id) on delete set null,
  -- Multiple people per institute may hold institute_admin. The plan flagged a
  -- single admin as a single point of failure that is painful to retrofit;
  -- because the role lives here rather than on institutes, more than one is
  -- already supported with no extra work.
  role         text not null default 'student'
               check (role in ('student', 'institute_admin', 'super_admin')),
  full_name    text,
  created_at   timestamptz not null default now()
);

create table if not exists public.quiz_attempts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  started_at      timestamptz not null default now(),
  completed_at    timestamptz,
  score           integer,
  total_questions integer
);

-- Per-question detail, not just a final score. Storing only the score answers
-- "how did this student do"; storing each answer answers "which concepts is
-- this class getting wrong", which is what an institute actually wants.
create table if not exists public.quiz_answers (
  id             uuid primary key default gen_random_uuid(),
  attempt_id     uuid not null references public.quiz_attempts(id) on delete cascade,
  question_text  text not null,
  chosen_answer  text,
  correct_answer text,
  is_correct     boolean,
  answered_at    timestamptz not null default now()
);

create index if not exists profiles_institute_idx      on public.profiles(institute_id);
create index if not exists quiz_attempts_user_idx      on public.quiz_attempts(user_id);
create index if not exists quiz_answers_attempt_idx    on public.quiz_answers(attempt_id);

-- ---------------------------------------------------------------------------
-- Identity helpers
-- ---------------------------------------------------------------------------
-- These exist to solve a specific trap. The natural way to write "an institute
-- admin may read their own institute's students" is:
--
--   using (institute_id = (select institute_id from profiles where id = auth.uid()))
--
-- That subquery reads `profiles`, which triggers the policy on `profiles`,
-- which runs the subquery again: Postgres aborts with infinite recursion, and
-- because it happens inside a policy the error surfaces as a confusing failure
-- on unrelated queries.
--
-- SECURITY DEFINER makes these run as the function owner, so they bypass RLS
-- on profiles and the recursion never starts.
--
-- `set search_path = public` is not decoration. Without it, a caller able to
-- influence search_path could shadow `profiles` with their own table and change
-- what these functions return — which would change who the database thinks
-- they are. It is required on every SECURITY DEFINER function.

create or replace function public.current_institute_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select institute_id from public.profiles where id = auth.uid();
$$;

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role = 'super_admin' from public.profiles where id = auth.uid()),
    false
  );
$$;

create or replace function public.is_institute_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role in ('institute_admin', 'super_admin') from public.profiles where id = auth.uid()),
    false
  );
$$;

-- Only these are callable by a logged-in client. Nothing here leaks another
-- user's data: each answers a question about the caller themselves.
revoke all on function public.current_institute_id()  from public, anon, authenticated;
revoke all on function public.current_user_role()     from public, anon, authenticated;
revoke all on function public.is_super_admin()        from public, anon, authenticated;
revoke all on function public.is_institute_admin()    from public, anon, authenticated;
grant execute on function public.current_institute_id()  to authenticated;
grant execute on function public.current_user_role()     to authenticated;
grant execute on function public.is_super_admin()        to authenticated;
grant execute on function public.is_institute_admin()    to authenticated;

-- ---------------------------------------------------------------------------
-- Profile creation on invite acceptance
-- ---------------------------------------------------------------------------
-- The institute id and role are attached server-side when the invite is sent
-- (netlify/functions/invite-student.js passes them as user metadata), so they
-- arrive here already vouched for. They are NEVER read from anything the
-- signing-up user typed.
--
-- Note it reads raw_app_meta_data, not raw_user_meta_data. That distinction is
-- the whole security of this trigger: user_metadata is writable by the user
-- themselves via updateUser(), so trusting it would let any student promote
-- themselves to super_admin. app_metadata can only be written with the
-- service-role key, which never leaves the server.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta_institute uuid;
  meta_role      text;
begin
  begin
    meta_institute := (new.raw_app_meta_data ->> 'institute_id')::uuid;
  exception when others then
    meta_institute := null;
  end;

  meta_role := coalesce(new.raw_app_meta_data ->> 'role', 'student');
  if meta_role not in ('student', 'institute_admin', 'super_admin') then
    meta_role := 'student';
  end if;

  insert into public.profiles (id, institute_id, role, full_name)
  values (
    new.id,
    meta_institute,
    meta_role,
    coalesce(new.raw_user_meta_data ->> 'full_name', '')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
-- Enabling RLS with no policy denies everything. Every allowance below is
-- therefore explicit, and anything not listed is refused by default.

alter table public.institutes    enable row level security;
alter table public.profiles      enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.quiz_answers  enable row level security;

-- Force RLS for table owners too. Without this, a query running as the owning
-- role would bypass every policy below.
alter table public.institutes    force row level security;
alter table public.profiles      force row level security;
alter table public.quiz_attempts force row level security;
alter table public.quiz_answers  force row level security;

-- ---- profiles ----
drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles
  for select to authenticated
  using (id = auth.uid());

drop policy if exists "admins read own institute profiles" on public.profiles;
create policy "admins read own institute profiles" on public.profiles
  for select to authenticated
  using (
    public.is_super_admin()
    or (
      public.is_institute_admin()
      and institute_id is not null
      and institute_id = public.current_institute_id()
    )
  );

-- Deliberately narrow: a user may edit their display name and nothing else.
-- Both USING and WITH CHECK are present because USING alone governs which rows
-- may be targeted, not what they may be changed TO — without WITH CHECK a user
-- could update their own row and set role = 'super_admin'.
drop policy if exists "update own profile name" on public.profiles;
create policy "update own profile name" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = public.current_user_role()
    and institute_id is not distinct from public.current_institute_id()
  );

-- No insert or delete policy for anyone. Profiles are created only by the
-- trigger above (which runs as definer and is not subject to these policies),
-- and removed only by the cascade from auth.users. A client cannot mint or
-- destroy a profile row at all.

-- ---- institutes ----
drop policy if exists "read own institute" on public.institutes;
create policy "read own institute" on public.institutes
  for select to authenticated
  using (public.is_super_admin() or id = public.current_institute_id());

drop policy if exists "super admin manages institutes" on public.institutes;
create policy "super admin manages institutes" on public.institutes
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- Institute signup requests are NOT insertable by the client. A public form
-- that wrote here directly would let anyone flood the table, and would expose
-- the table to enumeration. Requests go through
-- netlify/functions/request-institute.js instead.

-- ---- quiz_attempts ----
drop policy if exists "own attempts" on public.quiz_attempts;
create policy "own attempts" on public.quiz_attempts
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "insert own attempts" on public.quiz_attempts;
create policy "insert own attempts" on public.quiz_attempts
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "update own attempts" on public.quiz_attempts;
create policy "update own attempts" on public.quiz_attempts
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "admins read institute attempts" on public.quiz_attempts;
create policy "admins read institute attempts" on public.quiz_attempts
  for select to authenticated
  using (
    public.is_super_admin()
    or (
      public.is_institute_admin()
      and exists (
        select 1 from public.profiles p
        where p.id = quiz_attempts.user_id
          and p.institute_id is not null
          and p.institute_id = public.current_institute_id()
      )
    )
  );

-- ---- quiz_answers ----
drop policy if exists "own answers" on public.quiz_answers;
create policy "own answers" on public.quiz_answers
  for select to authenticated
  using (
    exists (
      select 1 from public.quiz_attempts a
      where a.id = quiz_answers.attempt_id and a.user_id = auth.uid()
    )
  );

-- Checks the parent attempt belongs to the caller, so an answer cannot be
-- written into somebody else's attempt by guessing an attempt id.
drop policy if exists "insert own answers" on public.quiz_answers;
create policy "insert own answers" on public.quiz_answers
  for insert to authenticated
  with check (
    exists (
      select 1 from public.quiz_attempts a
      where a.id = quiz_answers.attempt_id and a.user_id = auth.uid()
    )
  );

drop policy if exists "admins read institute answers" on public.quiz_answers;
create policy "admins read institute answers" on public.quiz_answers
  for select to authenticated
  using (
    public.is_super_admin()
    or (
      public.is_institute_admin()
      and exists (
        select 1
        from public.quiz_attempts a
        join public.profiles p on p.id = a.user_id
        where a.id = quiz_answers.attempt_id
          and p.institute_id is not null
          and p.institute_id = public.current_institute_id()
      )
    )
  );

-- ---------------------------------------------------------------------------
-- Anonymous access
-- ---------------------------------------------------------------------------
-- The landing page is public, but it reads nothing from the database. No
-- policy grants `anon` anything, so an un-authenticated key can see no rows in
-- any table. Stated explicitly because "we just won't query it from the
-- landing page" is not a control.
