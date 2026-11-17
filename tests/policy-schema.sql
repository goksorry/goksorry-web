-- Disposable local Postgres only. Includes schema and replays the migration to
-- verify idempotence; rolls back all fixtures. Never run on the linked project.
begin;
create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql as $$ select null::uuid $$;
\ir ../db/schema.sql
\ir ../db/migrations/031_reduce_retention_cadence.sql

do $$ begin
  assert (select count(*) = 4 from public.policy_document_versions), 'four historical revision rows, no duplicate on replay';
  assert (select bool_and(effective_at - published_at >= interval '7 days') from public.policy_document_versions), 'at least seven full days notice';
  assert (select bool_and(is_adverse) from public.policy_document_versions), 'both revisions require advance notice';
  assert (select bool_and(extract(hour from effective_at at time zone 'Asia/Seoul') = 0) from public.policy_document_versions), 'effective time must be Korea midnight';
end $$;

insert into public.profiles(id, email, nickname) values
  ('00000000-0000-4000-8000-000000000001', 'departing@example.invalid', '탈퇴회원'),
  ('00000000-0000-4000-8000-000000000002', 'remaining@example.invalid', '남은회원');
insert into public.goksorry_room_entries(id, author_kind, author_id, guest_owner_hash, author_label, content) values
  ('00000000-0000-4000-8000-000000000010', 'member', '00000000-0000-4000-8000-000000000001', null, '탈퇴회원', '삭제할 원글'),
  ('00000000-0000-4000-8000-000000000020', 'member', '00000000-0000-4000-8000-000000000002', null, '남은회원', '유지할 원글'),
  ('00000000-0000-4000-8000-000000000030', 'guest', null, 'guest-fixture', '비회원', '유지할 비회원 글');
insert into public.goksorry_room_replies(entry_id, author_kind, author_id, author_label, content) values
  ('00000000-0000-4000-8000-000000000020', 'member', '00000000-0000-4000-8000-000000000001', '탈퇴회원', '다른 글에 작성한 댓글도 삭제'),
  ('00000000-0000-4000-8000-000000000010', 'member', '00000000-0000-4000-8000-000000000002', '남은회원', '원글과 함께 삭제'),
  ('00000000-0000-4000-8000-000000000020', 'member', '00000000-0000-4000-8000-000000000002', '남은회원', '유지할 댓글');
grant usage on schema public to service_role;
grant all on public.profiles, public.goksorry_room_entries, public.goksorry_room_replies to service_role;
set local role service_role;
delete from public.profiles where id = '00000000-0000-4000-8000-000000000001';
reset role;
do $$ begin
  assert (select count(*) = 2 from public.goksorry_room_entries), 'unrelated member and guest entries must survive';
  assert (select count(*) = 1 from public.goksorry_room_replies), 'own replies and replies to removed parent must be deleted';
  assert (select count(*) = 0 from public.goksorry_room_entries where author_label = '탈퇴회원'), 'nickname must not survive as orphan content';
  assert (select count(*) = 0 from public.goksorry_room_replies where author_label = '탈퇴회원'), 'reply nickname must not survive';
  assert (select reply_count = 1 from public.goksorry_room_entries where id = '00000000-0000-4000-8000-000000000020'), 'reply count must stay consistent';
  assert not has_function_privilege('anon', 'public.delete_member_room_content()', 'execute'), 'cleanup function is not a public RPC';
end $$;
rollback;
