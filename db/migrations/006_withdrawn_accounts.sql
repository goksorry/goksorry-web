create table if not exists public.withdrawn_accounts (
  email text primary key,
  withdrawn_at timestamptz not null default now(),
  reason text,
  constraint withdrawn_accounts_email_lowercase check (email = lower(email)),
  constraint withdrawn_accounts_reason_plain_text check (reason is null or reason !~ '[<>]')
);

create index if not exists withdrawn_accounts_withdrawn_at_idx
on public.withdrawn_accounts(withdrawn_at desc);

alter table public.withdrawn_accounts enable row level security;
