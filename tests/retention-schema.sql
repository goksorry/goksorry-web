-- Disposable local Postgres only; never execute against production.
begin;
create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql as $$select null::uuid$$;
\ir ../db/schema.sql

insert into public.external_posts(source,post_key,title,url,fetched_at) values
 ('fixture','expired','old','https://example.invalid/old',now()-interval '8 days'),
 ('fixture','fresh','new','https://example.invalid/new',now()-interval '1 hour');
insert into public.sentiment_results(post_key,label,confidence) values ('expired','neutral',1),('fresh','neutral',1);
insert into public.analysis_reports(asof,status,summary,payload,created_at) values
 (now(),'ok','old','{}',now()-interval '8 days'),(now(),'ok','new','{}',now());
insert into public.world_snapshots(bucket_at,captured_at,frame) values
 (date_trunc('hour',now()-interval '8 days'),now()-interval '8 days','{"version":1}'),(date_trunc('hour',now()),now(),'{"version":1}');
insert into public.withdrawn_accounts(email,withdrawn_at) values
 ('expired@example.invalid',now()-interval '8 days'),('fresh@example.invalid',now());
insert into public.profiles(id,email,nickname) values ('00000000-0000-4000-8000-000000000001','member@example.invalid','member');
insert into public.boards(id,slug,name) values ('00000000-0000-4000-8000-000000000002','retention-test','test');
insert into public.community_posts(id,board_id,author_id,title,content,is_deleted) values
 ('00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001','deleted title','[deleted]',true),
 ('00000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001','keep title','keep content',false);
insert into public.community_comments(post_id,author_id,content) values
 ('00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000001','child of deleted parent');
insert into public.goksorry_room_entries(author_kind,guest_owner_hash,author_label,content,is_deleted) values
 ('guest','expired-owner','guest','[deleted]',true),('guest','keep-owner','guest','keep content',false);

select goksorry_private.run_data_retention();
do $$begin
 assert (select count(*)=1 from external_posts), 'only expired external posts removed';
 assert (select post_key='fresh' from sentiment_results), 'sentiment cascades with deleted post';
 assert (select count(*)=1 from analysis_reports), 'fresh report retained';
 assert (select count(*)=1 from world_snapshots), 'fresh snapshot retained';
 assert (select email='fresh@example.invalid' from withdrawn_accounts), 'fresh withdrawal hold retained';
 assert (select count(*)=1 from community_posts), 'active member post retained';
 assert (select count(*)=0 from community_comments), 'deleted parent comments removed';
 assert (select guest_owner_hash='keep-owner' from goksorry_room_entries), 'active guest ownership retained';
 assert (select last_success_at=now() from goksorry_private.retention_status), 'success is recorded';
 assert not has_function_privilege('anon','goksorry_private.run_data_retention()','execute'), 'no public cleanup RPC';
 assert not has_function_privilege('service_role','goksorry_private.run_data_retention()','execute'), 'scheduler owns cleanup';
 begin
   update public.external_posts set preview='must not persist';
   raise exception 'body storage should be rejected';
 exception when check_violation then null;
 end;
end$$;
select goksorry_private.run_data_retention();
do $$begin
 assert (select (deleted_counts->>'external_posts')::int=0 from goksorry_private.retention_status), 'repeated cleanup is idempotent';
 assert (select count(*)=2 from policy_document_versions where superseded_at is null), 'one pending revision per policy';
 assert (select effective_at-published_at>=interval '7 days' from policy_document_versions where id='b782af64-6e13-4a1a-a38d-60ba8f48a9a2'), 'notice retained';
end$$;
rollback;
