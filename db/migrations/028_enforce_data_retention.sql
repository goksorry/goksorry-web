-- No public RPC: maintenance runs as the database scheduler's owner.
create schema if not exists goksorry_private;
revoke all on schema goksorry_private from public, anon, authenticated;

create table if not exists goksorry_private.retention_status (
  singleton boolean primary key default true check (singleton),
  last_success_at timestamptz not null,
  deleted_counts jsonb not null
);
alter table goksorry_private.retention_status enable row level security;
revoke all on goksorry_private.retention_status from public, anon, authenticated;

-- The title-only service has no purpose for stored source bodies.
update public.external_posts set preview = null where preview is not null;
alter table public.external_posts drop constraint if exists external_posts_no_preview;
alter table public.external_posts add constraint external_posts_no_preview check (preview is null);

create or replace function goksorry_private.run_data_retention()
returns jsonb
language plpgsql
security invoker
set search_path = ''
set statement_timeout = '60s'
as $$
declare
  cutoff timestamptz := now() - interval '7 days';
  affected bigint;
  counts jsonb := '{}'::jsonb;
begin
  -- Avoid overlapping manual and scheduled maintenance.
  if not pg_try_advisory_xact_lock(197817, 1) then
    return jsonb_build_object('skipped', 'already_running');
  end if;
  delete from public.external_posts where fetched_at <= cutoff;
  get diagnostics affected = row_count;
  counts := counts || jsonb_build_object('external_posts', affected);
  delete from public.analysis_reports where created_at <= cutoff;
  get diagnostics affected = row_count;
  counts := counts || jsonb_build_object('analysis_reports', affected);
  delete from public.world_snapshots where bucket_at <= cutoff;
  get diagnostics affected = row_count;
  counts := counts || jsonb_build_object('world_snapshots', affected);
  delete from public.withdrawn_accounts where withdrawn_at <= cutoff;
  get diagnostics affected = row_count;
  counts := counts || jsonb_build_object('withdrawn_accounts', affected);
  update public.detector_status set withdrawn_accounts_purged_at = now() where singleton;
  delete from public.api_access_tokens where revoked_at <= cutoff or expires_at <= cutoff;
  get diagnostics affected = row_count;
  counts := counts || jsonb_build_object('inactive_api_tokens', affected);

  -- Remove records left by the previous soft-delete handlers. Parent deletion
  -- also removes dependent comments/replies through existing foreign keys.
  delete from public.community_comments where is_deleted;
  get diagnostics affected = row_count;
  counts := counts || jsonb_build_object('deleted_comments', affected);
  delete from public.community_posts where is_deleted;
  get diagnostics affected = row_count;
  counts := counts || jsonb_build_object('deleted_posts', affected);
  delete from public.goksorry_room_replies where is_deleted;
  get diagnostics affected = row_count;
  counts := counts || jsonb_build_object('deleted_room_replies', affected);
  delete from public.goksorry_room_entries where is_deleted;
  get diagnostics affected = row_count;
  counts := counts || jsonb_build_object('deleted_room_entries', affected);

  insert into goksorry_private.retention_status values (true, now(), counts)
  on conflict (singleton) do update
    set last_success_at = excluded.last_success_at, deleted_counts = excluded.deleted_counts;
  return counts;
end;
$$;
revoke all on function goksorry_private.run_data_retention() from public, anon, authenticated, service_role;
select goksorry_private.run_data_retention();
