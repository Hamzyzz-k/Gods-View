-- Tenant isolation test.
--
-- Proves that a student of one institute cannot read another institute's data,
-- by actually attempting it rather than reading the policies and assuming.
-- This is the one test worth re-running after ANY change to schema.sql: an RLS
-- policy that looks right and is subtly wrong fails silently and permissively,
-- which is the worst way for a security control to fail.
--
-- Run the whole file in the SQL editor. It cleans up after itself and commits
-- nothing — everything happens inside a transaction that is rolled back at the
-- end, so it is safe to run against a database with real data in it.
--
-- PASS looks like: every notice says OK, and the final SELECT returns
-- 'ALL CHECKS PASSED'. Any failure raises an exception and aborts.

begin;

-- Two foreign keys point at auth.users(id) (schema.sql): profiles.id and
-- quiz_attempts.user_id. The fixtures below can't satisfy either without
-- creating real auth users — which this script deliberately avoids, to stay
-- a pure RLS test rather than one that also depends on GoTrue's internal
-- auth.users columns. Making both constraints deferrable-and-deferred means
-- they're checked at COMMIT, which this script never reaches (it always
-- ends in ROLLBACK below), so the fake test ids never trip them. Both
-- alterations are themselves inside this transaction, so they're undone by
-- the same rollback and never touch the real schema.
alter table public.profiles alter constraint profiles_id_fkey deferrable initially deferred;
alter table public.quiz_attempts alter constraint quiz_attempts_user_id_fkey deferrable initially deferred;

do $$
declare
  inst_a uuid;
  inst_b uuid;
  user_a uuid := gen_random_uuid();
  user_b uuid := gen_random_uuid();
  attempt_a uuid;
  visible_count int;
begin
  -- ---- fixtures -----------------------------------------------------------
  insert into public.institutes (name, contact_email, status)
    values ('Test Institute A', 'a@example.test', 'approved') returning id into inst_a;
  insert into public.institutes (name, contact_email, status)
    values ('Test Institute B', 'b@example.test', 'approved') returning id into inst_b;

  -- Profiles are normally created by the trigger on auth.users. Inserted
  -- directly here because this test must not create real auth users.
  insert into public.profiles (id, institute_id, role, full_name)
    values (user_a, inst_a, 'student', 'Student A');
  insert into public.profiles (id, institute_id, role, full_name)
    values (user_b, inst_b, 'student', 'Student B');

  insert into public.quiz_attempts (user_id, score, total_questions, completed_at)
    values (user_a, 9, 10, now()) returning id into attempt_a;
  insert into public.quiz_answers (attempt_id, question_text, chosen_answer, correct_answer, is_correct)
    values (attempt_a, 'How many planets?', '8', '8', true);

  -- ---- act as student B ---------------------------------------------------
  -- set_config with is_local = true confines this to the transaction.
  -- request.jwt.claims is what auth.uid() reads, so this is genuinely the same
  -- code path a real signed-in client takes.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', user_b, 'role', 'authenticated')::text, true);

  -- B must not see A's attempt.
  select count(*) into visible_count from public.quiz_attempts where user_id = user_a;
  if visible_count <> 0 then
    raise exception 'FAIL: student B can see % of student A''s quiz attempts', visible_count;
  end if;
  raise notice 'OK: student B cannot read student A''s attempts';

  -- B must not see A's individual answers.
  select count(*) into visible_count from public.quiz_answers where attempt_id = attempt_a;
  if visible_count <> 0 then
    raise exception 'FAIL: student B can see % of student A''s answers', visible_count;
  end if;
  raise notice 'OK: student B cannot read student A''s answers';

  -- B must not see A's profile.
  select count(*) into visible_count from public.profiles where id = user_a;
  if visible_count <> 0 then
    raise exception 'FAIL: student B can see student A''s profile row';
  end if;
  raise notice 'OK: student B cannot read student A''s profile';

  -- B must not see institute A.
  select count(*) into visible_count from public.institutes where id = inst_a;
  if visible_count <> 0 then
    raise exception 'FAIL: student B can see institute A';
  end if;
  raise notice 'OK: student B cannot read institute A';

  -- B CAN see their own profile — proving the policies are actually being
  -- evaluated, rather than everything being blocked by a broken connection.
  select count(*) into visible_count from public.profiles where id = user_b;
  if visible_count <> 1 then
    raise exception 'FAIL: student B cannot read their OWN profile (policies too strict, or not applied)';
  end if;
  raise notice 'OK: student B can read their own profile';

  -- B must not be able to write an answer into A's attempt.
  begin
    insert into public.quiz_answers (attempt_id, question_text, is_correct)
      values (attempt_a, 'injected', true);
    raise exception 'FAIL: student B wrote an answer into student A''s attempt';
  exception
    when insufficient_privilege then
      raise notice 'OK: student B blocked from writing into student A''s attempt';
    when others then
      if sqlerrm like 'FAIL:%' then raise; end if;
      raise notice 'OK: student B blocked from writing into student A''s attempt (%)', sqlerrm;
  end;

  -- B must not be able to promote themselves.
  begin
    update public.profiles set role = 'super_admin' where id = user_b;
    -- An UPDATE barred by WITH CHECK raises; one barred by USING silently
    -- affects zero rows. Both are a pass, so the outcome is re-read rather
    -- than assuming an exception is the only way this can be refused.
    if exists (select 1 from public.profiles where id = user_b and role = 'super_admin') then
      raise exception 'FAIL: student B promoted themselves to super_admin';
    end if;
    raise notice 'OK: student B cannot promote themselves';
  exception
    when insufficient_privilege then
      raise notice 'OK: student B cannot promote themselves';
    when others then
      if sqlerrm like 'FAIL:%' then raise; end if;
      raise notice 'OK: student B cannot promote themselves (%)', sqlerrm;
  end;

  -- ---- act as an admin of institute B -------------------------------------
  -- An institute admin may see their own students, and must still not see
  -- another institute's.
  update public.profiles set role = 'institute_admin' where id = user_b;

  select count(*) into visible_count from public.quiz_attempts where user_id = user_a;
  if visible_count <> 0 then
    raise exception 'FAIL: institute B admin can see institute A''s attempts';
  end if;
  raise notice 'OK: institute B admin cannot read institute A''s attempts';

  select count(*) into visible_count from public.profiles where institute_id = inst_a;
  if visible_count <> 0 then
    raise exception 'FAIL: institute B admin can see institute A''s students';
  end if;
  raise notice 'OK: institute B admin cannot read institute A''s students';

  perform set_config('role', 'postgres', true);
end $$;

select 'ALL CHECKS PASSED' as result;

-- Nothing above is kept. Re-run any time.
rollback;
