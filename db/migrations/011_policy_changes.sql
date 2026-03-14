create table if not exists public.policy_changes (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('terms', 'privacy')),
  summary text not null,
  published_at timestamptz not null,
  effective_at timestamptz not null,
  constraint policy_changes_summary_plain_text check (summary !~ '[<>]'),
  constraint policy_changes_effective_at_check check (published_at < effective_at)
);

create index if not exists policy_changes_active_window_idx
on public.policy_changes(published_at, effective_at);

alter table public.policy_changes enable row level security;

drop policy if exists policy_changes_public_select on public.policy_changes;
create policy policy_changes_public_select
on public.policy_changes
for select
using (true);
