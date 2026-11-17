-- Disposable local Postgres only.
begin;
create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql as $$select null::uuid$$;
\ir ../db/schema.sql
-- Recreate a pre-transition row to verify the migration's purge and future guard.
alter table public.external_posts drop constraint external_posts_scoped_titles_only;
insert into public.external_posts(source,post_key,title,url) values ('unknown','private','PRIVATE','https://example.invalid/post');
insert into public.sentiment_results(post_key,label,confidence) values ('private','bullish',1);
insert into public.world_snapshots(bucket_at,captured_at,frame) values (date_trunc('hour',now()),now(),'{"version":1,"overall":{"total":1,"evidence":{"bullish":[{"title":"PRIVATE"}]}},"communities":[{"total":1,"evidence":{"bullish":[{"title":"PRIVATE"}]}}],"stocks":[]}');
\ir ../db/migrations/032_aggregate_only_community_indices.sql
do $$begin
 assert (select count(*)=0 from public.external_posts);
 assert (select count(*)=0 from public.sentiment_results);
 assert (select count(*)=0 from public.world_snapshots where frame::text like '%PRIVATE%');
 assert (select (frame->'overall'->>'total')::int=1 from public.world_snapshots limit 1);
 assert (select count(*)=2 from public.policy_document_versions where superseded_at is null and effective_at>now());
 assert (select bool_and(effective_at >= published_at + interval '7 days') from public.policy_document_versions where id in ('43f021b5-8e72-413a-91cf-e581b4f56e6c','8427c609-610d-49f1-9ca4-380f6137cf56'));
 begin
   insert into public.external_posts(source,post_key,title,url) values ('dc_stock','blocked','PRIVATE','https://evil.invalid/post');
   raise exception 'unapproved source URL must be rejected';
 exception when check_violation then null;
 end;
end$$;
rollback;
