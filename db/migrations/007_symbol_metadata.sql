alter table public.external_posts
  add column if not exists symbol text;

alter table public.external_posts
  drop constraint if exists external_posts_symbol_plain_text;

alter table public.external_posts
  add constraint external_posts_symbol_plain_text
  check (symbol is null or symbol !~ '[<>]');

update public.external_posts
set symbol = case
  when source like 'naver_stock_%' then nullif(upper(trim(replace(source, 'naver_stock_', ''))), '')
  when source like 'toss_stock_community_%' then nullif(upper(trim(replace(source, 'toss_stock_community_', ''))), '')
  else null
end
where symbol is null;

create table if not exists public.symbol_metadata (
  symbol text primary key,
  display_name text,
  market text check (market in ('kr', 'us')),
  status text not null default 'pending' check (status in ('pending', 'ready', 'failed')),
  last_fetched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint symbol_metadata_symbol_plain_text check (symbol !~ '[<>]'),
  constraint symbol_metadata_display_name_plain_text check (display_name is null or display_name !~ '[<>]')
);

create index if not exists external_posts_symbol_fetched_at_idx
on public.external_posts(symbol, fetched_at desc)
where symbol is not null;

create index if not exists symbol_metadata_status_updated_idx
on public.symbol_metadata(status, updated_at desc);

insert into public.symbol_metadata (symbol, market, status)
select distinct
  ep.symbol,
  case
    when ep.symbol ~ '^\d{6}$' then 'kr'
    when ep.symbol ~ '^[A-Z.\-]{1,10}$' then 'us'
    else null
  end as market,
  'pending' as status
from public.external_posts ep
where ep.symbol is not null
on conflict (symbol)
do nothing;

alter table public.symbol_metadata enable row level security;

drop policy if exists symbol_metadata_public_select on public.symbol_metadata;
create policy symbol_metadata_public_select
on public.symbol_metadata
for select
using (true);

drop trigger if exists symbol_metadata_set_updated_at on public.symbol_metadata;
create trigger symbol_metadata_set_updated_at
before update on public.symbol_metadata
for each row
execute function public.set_updated_at();
