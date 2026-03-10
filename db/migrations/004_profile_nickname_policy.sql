alter table public.profiles
  add column if not exists nickname_confirmed_at timestamptz;

alter table public.profiles
  add column if not exists nickname_changed_at timestamptz;

with ranked as (
  select
    id,
    nickname,
    row_number() over (partition by lower(nickname) order by created_at asc, id asc) as duplicate_rank
  from public.profiles
)
update public.profiles as profiles
set nickname = left(profiles.nickname, 23) || '_' || substring(replace(profiles.id::text, '-', '') from 1 for 6)
from ranked
where profiles.id = ranked.id
  and ranked.duplicate_rank > 1;

create unique index if not exists profiles_nickname_unique_ci_idx on public.profiles(lower(nickname));
