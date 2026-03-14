create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  nickname text not null,
  nickname_confirmed_at timestamptz,
  nickname_changed_at timestamptz,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_nickname_plain_text check (nickname !~ '[<>]')
);

create table if not exists public.withdrawn_accounts (
  email text primary key,
  withdrawn_at timestamptz not null default now(),
  reason text,
  constraint withdrawn_accounts_email_lowercase check (email = lower(email)),
  constraint withdrawn_accounts_reason_plain_text check (reason is null or reason !~ '[<>]')
);

create table if not exists public.external_posts (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  symbol text,
  post_key text not null unique,
  title text not null,
  clean_title text,
  url text not null,
  preview text,
  created_at_from_source timestamptz,
  fetched_at timestamptz not null default now(),
  constraint external_posts_symbol_plain_text check (symbol is null or symbol !~ '[<>]'),
  constraint external_posts_title_plain_text check (title !~ '[<>]'),
  constraint external_posts_clean_title_plain_text check (clean_title is null or clean_title !~ '[<>]'),
  constraint external_posts_preview_plain_text check (preview is null or preview !~ '[<>]')
);

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

create table if not exists public.sentiment_results (
  id uuid primary key default gen_random_uuid(),
  post_key text not null unique references public.external_posts(post_key) on delete cascade,
  label text not null check (label in ('bullish', 'bearish', 'neutral')),
  sentiment_score smallint not null default 5 check (sentiment_score between 1 and 10),
  confidence double precision not null check (confidence >= 0 and confidence <= 1),
  model text not null default 'gemini-2.5-flash-lite',
  analyzed_at timestamptz not null default now()
);

create table if not exists public.boards (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  sort_order integer not null default 100,
  created_at timestamptz not null default now()
);

create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete restrict,
  author_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  content text not null,
  is_pinned_notice boolean not null default false,
  is_deleted boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint community_posts_title_plain_text check (title !~ '[<>]'),
  constraint community_posts_content_plain_text check (content !~ '[<>]')
);

create table if not exists public.community_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  is_deleted boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint community_comments_content_plain_text check (content !~ '[<>]')
);

create table if not exists public.votes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.community_posts(id) on delete cascade,
  comment_id uuid references public.community_comments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  value smallint not null check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  constraint votes_target_exactly_one check (((post_id is not null)::int + (comment_id is not null)::int) = 1)
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('post', 'comment')),
  target_id uuid not null,
  reason text not null default 'report',
  status text not null default 'open' check (status in ('open', 'reviewed', 'closed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint reports_reason_plain_text check (reason !~ '[<>]')
);

create index if not exists external_posts_source_fetched_at_idx on public.external_posts(source, fetched_at desc);
create index if not exists external_posts_symbol_fetched_at_idx on public.external_posts(symbol, fetched_at desc) where symbol is not null;
create index if not exists sentiment_results_analyzed_at_idx on public.sentiment_results(analyzed_at desc);
create index if not exists symbol_metadata_status_updated_idx on public.symbol_metadata(status, updated_at desc);
create unique index if not exists profiles_nickname_unique_ci_idx on public.profiles(lower(nickname));
create index if not exists withdrawn_accounts_withdrawn_at_idx on public.withdrawn_accounts(withdrawn_at desc);
create index if not exists community_posts_board_created_idx on public.community_posts(board_id, created_at desc);
create index if not exists community_posts_notice_pin_idx on public.community_posts(board_id, is_pinned_notice, created_at desc);
create index if not exists community_comments_post_created_idx on public.community_comments(post_id, created_at asc);
create index if not exists reports_status_created_idx on public.reports(status, created_at desc);
create unique index if not exists votes_user_post_unique_idx on public.votes(user_id, post_id) where post_id is not null;
create unique index if not exists votes_user_comment_unique_idx on public.votes(user_id, comment_id) where comment_id is not null;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.is_admin(user_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = user_id
      and p.role = 'admin'
  );
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

drop trigger if exists symbol_metadata_set_updated_at on public.symbol_metadata;
create trigger symbol_metadata_set_updated_at
before update on public.symbol_metadata
for each row
execute function public.set_updated_at();

drop trigger if exists community_posts_set_updated_at on public.community_posts;
create trigger community_posts_set_updated_at
before update on public.community_posts
for each row
execute function public.set_updated_at();

drop trigger if exists community_comments_set_updated_at on public.community_comments;
create trigger community_comments_set_updated_at
before update on public.community_comments
for each row
execute function public.set_updated_at();

insert into public.boards (slug, name, description, sort_order)
values
  ('notice', 'Notice', 'Announcements from admins', 10),
  ('free', 'Free', 'General discussion board', 20),
  ('feedback', 'Feedback', 'Feedback and bug reports', 30)
on conflict (slug)
do update set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order;

alter table public.external_posts enable row level security;
alter table public.symbol_metadata enable row level security;
alter table public.sentiment_results enable row level security;
alter table public.boards enable row level security;
alter table public.profiles enable row level security;
alter table public.withdrawn_accounts enable row level security;
alter table public.community_posts enable row level security;
alter table public.community_comments enable row level security;
alter table public.votes enable row level security;
alter table public.reports enable row level security;

drop policy if exists external_posts_public_select on public.external_posts;
create policy external_posts_public_select
on public.external_posts
for select
using (true);

drop policy if exists symbol_metadata_public_select on public.symbol_metadata;
create policy symbol_metadata_public_select
on public.symbol_metadata
for select
using (true);

drop policy if exists sentiment_results_public_select on public.sentiment_results;
create policy sentiment_results_public_select
on public.sentiment_results
for select
using (true);

drop policy if exists boards_public_select on public.boards;
create policy boards_public_select
on public.boards
for select
using (true);

drop policy if exists profiles_public_select on public.profiles;
create policy profiles_public_select
on public.profiles
for select
using (true);

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists profiles_update_self_or_admin on public.profiles;
create policy profiles_update_self_or_admin
on public.profiles
for update
to authenticated
using (auth.uid() = id or public.is_admin(auth.uid()))
with check (auth.uid() = id or public.is_admin(auth.uid()));

drop policy if exists community_posts_public_select on public.community_posts;
create policy community_posts_public_select
on public.community_posts
for select
using (is_deleted = false or auth.uid() = author_id or public.is_admin(auth.uid()));

drop policy if exists community_posts_insert_auth on public.community_posts;
create policy community_posts_insert_auth
on public.community_posts
for insert
to authenticated
with check (auth.uid() = author_id);

drop policy if exists community_posts_update_owner_or_admin on public.community_posts;
create policy community_posts_update_owner_or_admin
on public.community_posts
for update
to authenticated
using (auth.uid() = author_id or public.is_admin(auth.uid()))
with check (auth.uid() = author_id or public.is_admin(auth.uid()));

drop policy if exists community_comments_public_select on public.community_comments;
create policy community_comments_public_select
on public.community_comments
for select
using (is_deleted = false or auth.uid() = author_id or public.is_admin(auth.uid()));

drop policy if exists community_comments_insert_auth on public.community_comments;
create policy community_comments_insert_auth
on public.community_comments
for insert
to authenticated
with check (auth.uid() = author_id);

drop policy if exists community_comments_update_owner_or_admin on public.community_comments;
create policy community_comments_update_owner_or_admin
on public.community_comments
for update
to authenticated
using (auth.uid() = author_id or public.is_admin(auth.uid()))
with check (auth.uid() = author_id or public.is_admin(auth.uid()));

drop policy if exists reports_insert_auth on public.reports;
create policy reports_insert_auth
on public.reports
for insert
to authenticated
with check (auth.uid() = reporter_id);

drop policy if exists reports_select_admin_only on public.reports;
create policy reports_select_admin_only
on public.reports
for select
to authenticated
using (public.is_admin(auth.uid()));

drop policy if exists votes_public_select on public.votes;
create policy votes_public_select
on public.votes
for select
using (true);

drop policy if exists votes_insert_auth on public.votes;
create policy votes_insert_auth
on public.votes
for insert
to authenticated
with check (auth.uid() = user_id);
create table if not exists public.detector_symbol_signals_latest (
  symbol text primary key,
  market text not null check (market in ('kr', 'us')),
  asof timestamptz not null,
  mentions integer not null default 0 check (mentions >= 0),
  neg_count integer not null default 0 check (neg_count >= 0),
  pos_count integer not null default 0 check (pos_count >= 0),
  panic_score double precision not null check (panic_score >= 0 and panic_score <= 100),
  euphoria_score double precision not null check (euphoria_score >= 0 and euphoria_score <= 100),
  signal_quality double precision not null check (signal_quality >= 0 and signal_quality <= 1),
  mention_velocity_z double precision not null default 0,
  confidence_grade text not null check (confidence_grade in ('A', 'B', 'C', 'D')),
  source_diversity integer not null default 1 check (source_diversity >= 0),
  detector_mode text not null default 'normal',
  extra jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.detector_market_state_latest (
  market text primary key check (market in ('kr', 'us')),
  asof timestamptz not null,
  regime text not null,
  fear_index double precision not null check (fear_index >= 0 and fear_index <= 100),
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.detector_status (
  singleton boolean primary key default true check (singleton),
  collector_last_run_at timestamptz,
  collector_errors integer not null default 0,
  llm_provider text not null default 'gemini',
  llm_last_run_at timestamptz,
  llm_degraded boolean not null default false,
  detector_mode text not null default 'normal',
  us_cooldown_until timestamptz,
  hold_list jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists detector_symbol_signals_market_asof_idx
on public.detector_symbol_signals_latest(market, asof desc);

alter table public.detector_symbol_signals_latest enable row level security;
alter table public.detector_market_state_latest enable row level security;
alter table public.detector_status enable row level security;

drop trigger if exists detector_symbol_signals_updated_at on public.detector_symbol_signals_latest;
create trigger detector_symbol_signals_updated_at
before update on public.detector_symbol_signals_latest
for each row execute function public.set_updated_at();

drop trigger if exists detector_market_state_updated_at on public.detector_market_state_latest;
create trigger detector_market_state_updated_at
before update on public.detector_market_state_latest
for each row execute function public.set_updated_at();

drop trigger if exists detector_status_updated_at on public.detector_status;
create trigger detector_status_updated_at
before update on public.detector_status
for each row execute function public.set_updated_at();

insert into public.detector_status (singleton, collector_errors, llm_provider, llm_degraded, detector_mode, hold_list)
values (true, 0, 'gemini', false, 'normal', '[]'::jsonb)
on conflict (singleton)
do nothing;

create table if not exists public.api_access_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  token_prefix text,
  token_hash text unique,
  scope text not null default 'tradingbot.read' check (scope in ('tradingbot.read')),
  approval_status text not null default 'pending' check (approval_status in ('pending', 'approved', 'rejected')),
  approval_requested_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid references public.profiles(id) on delete set null,
  rejected_at timestamptz,
  rejected_by uuid references public.profiles(id) on delete set null,
  approval_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  constraint api_access_tokens_name_plain_text check (name !~ '[<>]'),
  constraint api_access_tokens_note_plain_text check (approval_note is null or approval_note !~ '[<>]')
);

create index if not exists api_access_tokens_user_created_idx
on public.api_access_tokens(user_id, created_at desc);

alter table public.api_access_tokens enable row level security;

drop trigger if exists api_access_tokens_set_updated_at on public.api_access_tokens;
create trigger api_access_tokens_set_updated_at
before update on public.api_access_tokens
for each row
execute function public.set_updated_at();

drop policy if exists api_access_tokens_select_owner on public.api_access_tokens;
create policy api_access_tokens_select_owner
on public.api_access_tokens
for select
to authenticated
using (auth.uid() = user_id or public.is_admin(auth.uid()));

drop policy if exists api_access_tokens_insert_owner on public.api_access_tokens;
create policy api_access_tokens_insert_owner
on public.api_access_tokens
for insert
to authenticated
with check (auth.uid() = user_id or public.is_admin(auth.uid()));

drop policy if exists api_access_tokens_update_owner on public.api_access_tokens;
create policy api_access_tokens_update_owner
on public.api_access_tokens
for update
to authenticated
using (auth.uid() = user_id or public.is_admin(auth.uid()))
with check (auth.uid() = user_id or public.is_admin(auth.uid()));
