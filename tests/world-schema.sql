-- Run only against a disposable local database as its owner:
-- psql "$WORLD_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f tests/world-schema.sql
begin;
do $$ begin create role anon; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
do $$ begin create role service_role bypassrls; exception when duplicate_object then null; end $$;
\ir ../db/migrations/026_world_snapshots.sql

do $$ begin
  assert (select relrowsecurity from pg_class where oid = 'public.world_snapshots'::regclass), 'RLS must be enabled';
  assert not has_table_privilege('anon', 'public.world_snapshots', 'SELECT'), 'anon must not read snapshots';
  assert not has_table_privilege('authenticated', 'public.world_snapshots', 'INSERT'), 'members must not write snapshots';
end $$;

set local role service_role;
insert into public.world_snapshots(bucket_at, frame) values ('2026-11-14 15:00Z', '{"version":1,"value":1}');
insert into public.world_snapshots(bucket_at, frame) values ('2026-11-14 15:00Z', '{"version":1,"value":2}')
  on conflict (bucket_at) do update set frame = excluded.frame;
do $$ begin
  assert (select count(*) = 1 from public.world_snapshots), 'same bucket must update';
  assert (select frame ->> 'value' = '2' from public.world_snapshots), 'updated frame must be stored';
  begin
    insert into public.world_snapshots(bucket_at, frame) values ('2026-11-14 15:00:00.1Z', '{"version":1}');
    raise exception 'fractional bucket accepted';
  exception when check_violation then null; end;
  begin
    insert into public.world_snapshots(bucket_at, frame) values ('2026-11-14 15:10Z', '{}');
    raise exception 'missing version accepted';
  exception when check_violation then null; end;
end $$;
insert into public.world_snapshots(bucket_at, frame) values ('2026-11-07 14:50Z', '{"version":1}');
delete from public.world_snapshots where bucket_at < '2026-11-07 15:00Z';
do $$ begin assert (select count(*) = 1 from public.world_snapshots), 'seven-day retention must prune old buckets'; end $$;
set local role anon;
do $$ begin
  begin
    perform * from public.world_snapshots;
    raise exception 'anon read succeeded';
  exception when insufficient_privilege then null; end;
end $$;
rollback;
