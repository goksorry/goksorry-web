alter table public.profiles
  add column if not exists age_confirmed_at timestamptz,
  add column if not exists terms_agreed_at timestamptz,
  add column if not exists privacy_agreed_at timestamptz;

create or replace function public.is_nickname_available(candidate text, current_user_id uuid default null)
returns boolean
language sql
stable
as $$
  select not exists (
    select 1
    from public.profiles p
    where lower(p.nickname) = lower(candidate)
      and (current_user_id is null or p.id <> current_user_id)
  );
$$;
