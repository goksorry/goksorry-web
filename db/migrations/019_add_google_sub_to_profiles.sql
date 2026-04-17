alter table public.profiles
  add column if not exists google_sub text;

create unique index if not exists profiles_google_sub_unique_idx
on public.profiles(google_sub)
where google_sub is not null;

alter table public.withdrawn_accounts
  add column if not exists google_sub text;

create unique index if not exists withdrawn_accounts_google_sub_unique_idx
on public.withdrawn_accounts(google_sub)
where google_sub is not null;
