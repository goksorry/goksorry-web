-- World history is written by the authenticated detector server only.
create table if not exists public.world_snapshots (
  bucket_at timestamptz primary key,
  captured_at timestamptz not null default now(),
  frame jsonb not null,
  constraint world_snapshot_bucket check (
    mod(extract(epoch from bucket_at), 600) = 0
  ),
  constraint world_snapshot_version check (frame @> '{"version":1}'::jsonb)
);

alter table public.world_snapshots enable row level security;
revoke all on table public.world_snapshots from public, anon, authenticated;
grant select, insert, update, delete on table public.world_snapshots to service_role;

comment on table public.world_snapshots is
  'Server-only 10-minute WorldFrame history. Upserted and pruned to 7 days after detector collection; no visitor writes.';
