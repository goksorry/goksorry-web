create table if not exists public.analysis_reports (
  id uuid primary key default gen_random_uuid(),
  asof timestamptz not null,
  status text not null default 'ok' check (status in ('ok', 'partial', 'error')),
  summary text not null default '',
  payload jsonb not null default '{}'::jsonb,
  errors jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists analysis_reports_asof_idx
on public.analysis_reports(asof desc, created_at desc);

alter table public.analysis_reports enable row level security;
