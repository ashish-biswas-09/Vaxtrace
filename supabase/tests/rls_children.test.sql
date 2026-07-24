-- TODO 1.18 (the one non-negotiable pgTAP test): a parent cannot read another parent's child.
-- Run: supabase test db  (requires local `supabase start`)
begin;
select plan(1);

-- Two parent auth users + their children, inserted as postgres (bypasses RLS for fixtures).
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'parent-a@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'parent-b@example.com');

insert into profiles (id, full_name) values
  ('11111111-1111-1111-1111-111111111111', 'Parent A'),
  ('22222222-2222-2222-2222-222222222222', 'Parent B');

insert into user_roles (user_id, role) values
  ('11111111-1111-1111-1111-111111111111', 'parent'),
  ('22222222-2222-2222-2222-222222222222', 'parent');

insert into children (id, full_name, date_of_birth, gender, guardian_id) values
  ('33333333-3333-3333-3333-333333333333', 'Child B', current_date - interval '1 year', 'other',
   '22222222-2222-2222-2222-222222222222');

-- Act as Parent A (JWT claims mimic the Custom Access Token Hook's output).
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated","user_role":"parent"}';

select is(
  (select count(*)::int from children where id = '33333333-3333-3333-3333-333333333333'),
  0,
  'a parent cannot read another parent''s child'
);

select * from finish();
rollback;
