create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  google_sub text,
  nickname text not null,
  nickname_confirmed_at timestamptz,
  nickname_changed_at timestamptz,
  age_confirmed_at timestamptz,
  terms_agreed_at timestamptz,
  privacy_agreed_at timestamptz,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_nickname_plain_text check (nickname !~ '[<>]')
);

create table if not exists public.withdrawn_accounts (
  email text primary key,
  google_sub text,
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
  constraint community_comments_content_plain_text check (content !~ '<')
);

create table if not exists public.goksorry_room_entries (
  id uuid primary key default gen_random_uuid(),
  author_kind text not null check (author_kind in ('member', 'guest')),
  author_id uuid references public.profiles(id) on delete set null,
  guest_owner_hash text,
  author_label text not null default '익명',
  content text not null,
  reply_count integer not null default 0,
  is_deleted boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint goksorry_room_entries_author_identity check (
    (author_kind = 'member' and guest_owner_hash is null)
    or
    (author_kind = 'guest' and author_id is null and guest_owner_hash is not null)
  ),
  constraint goksorry_room_entries_author_label_plain_text check (author_label !~ '[<>]' and char_length(author_label) between 1 and 30),
  constraint goksorry_room_entries_content_plain_text check (content !~ '[<>]' and char_length(content) between 1 and 160),
  constraint goksorry_room_entries_reply_count_nonnegative check (reply_count >= 0)
);

create table if not exists public.goksorry_room_replies (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.goksorry_room_entries(id) on delete cascade,
  author_kind text not null check (author_kind in ('member', 'guest')),
  author_id uuid references public.profiles(id) on delete set null,
  guest_owner_hash text,
  author_label text not null default '익명',
  content text not null,
  is_deleted boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint goksorry_room_replies_author_identity check (
    (author_kind = 'member' and guest_owner_hash is null)
    or
    (author_kind = 'guest' and author_id is null and guest_owner_hash is not null)
  ),
  constraint goksorry_room_replies_author_label_plain_text check (author_label !~ '[<>]' and char_length(author_label) between 1 and 30),
  constraint goksorry_room_replies_content_plain_text check (content !~ '[<>]' and char_length(content) between 1 and 160)
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

create table if not exists public.policy_changes (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('terms', 'privacy')),
  summary text not null,
  published_at timestamptz not null,
  effective_at timestamptz not null,
  constraint policy_changes_summary_plain_text check (summary !~ '[<>]'),
  constraint policy_changes_effective_at_check check (published_at < effective_at)
);

create table if not exists public.policy_document_versions (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('terms', 'privacy')),
  summary text not null,
  body text not null,
  is_adverse boolean not null default false,
  published_at timestamptz not null default now(),
  effective_at timestamptz not null,
  updated_at timestamptz not null default now(),
  superseded_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint policy_document_versions_summary_plain_text check (summary !~ '[<>]')
);

create index if not exists external_posts_source_fetched_at_idx on public.external_posts(source, fetched_at desc);
create index if not exists external_posts_symbol_fetched_at_idx on public.external_posts(symbol, fetched_at desc) where symbol is not null;
create index if not exists sentiment_results_analyzed_at_idx on public.sentiment_results(analyzed_at desc);
create index if not exists symbol_metadata_status_updated_idx on public.symbol_metadata(status, updated_at desc);
create unique index if not exists profiles_nickname_unique_ci_idx on public.profiles(lower(nickname));
create unique index if not exists profiles_google_sub_unique_idx on public.profiles(google_sub) where google_sub is not null;
create unique index if not exists withdrawn_accounts_google_sub_unique_idx on public.withdrawn_accounts(google_sub) where google_sub is not null;
create index if not exists withdrawn_accounts_withdrawn_at_idx on public.withdrawn_accounts(withdrawn_at desc);
create index if not exists community_posts_board_created_idx on public.community_posts(board_id, created_at desc);
create index if not exists community_posts_notice_pin_idx on public.community_posts(board_id, is_pinned_notice, created_at desc);
create index if not exists community_comments_post_created_idx on public.community_comments(post_id, created_at asc);
create index if not exists goksorry_room_entries_created_idx
on public.goksorry_room_entries(created_at desc)
where is_deleted = false;
create index if not exists goksorry_room_entries_member_owner_idx
on public.goksorry_room_entries(author_id, created_at desc)
where author_id is not null;
create index if not exists goksorry_room_entries_guest_owner_idx
on public.goksorry_room_entries(guest_owner_hash, created_at desc)
where guest_owner_hash is not null;
create index if not exists goksorry_room_replies_entry_created_idx
on public.goksorry_room_replies(entry_id, created_at asc)
where is_deleted = false;
create index if not exists goksorry_room_replies_member_owner_idx
on public.goksorry_room_replies(author_id, created_at desc)
where author_id is not null;
create index if not exists goksorry_room_replies_guest_owner_idx
on public.goksorry_room_replies(guest_owner_hash, created_at desc)
where guest_owner_hash is not null;
create index if not exists reports_status_created_idx on public.reports(status, created_at desc);
create index if not exists policy_changes_active_window_idx on public.policy_changes(published_at, effective_at);
create index if not exists policy_document_versions_type_effective_idx
on public.policy_document_versions(type, effective_at desc, published_at desc)
where superseded_at is null;
create index if not exists policy_document_versions_type_history_idx
on public.policy_document_versions(type, published_at desc);
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

create or replace function public.refresh_goksorry_room_entry_reply_count(target_entry_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if target_entry_id is null then
    return;
  end if;

  update public.goksorry_room_entries
  set reply_count = (
    select count(*)::integer
    from public.goksorry_room_replies
    where entry_id = target_entry_id
      and is_deleted = false
  )
  where id = target_entry_id;
end;
$$;

create or replace function public.goksorry_room_replies_refresh_entry_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.refresh_goksorry_room_entry_reply_count(new.entry_id);
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if old.entry_id is distinct from new.entry_id then
      perform public.refresh_goksorry_room_entry_reply_count(old.entry_id);
      perform public.refresh_goksorry_room_entry_reply_count(new.entry_id);
    elsif old.is_deleted is distinct from new.is_deleted then
      perform public.refresh_goksorry_room_entry_reply_count(new.entry_id);
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    perform public.refresh_goksorry_room_entry_reply_count(old.entry_id);
    return old;
  end if;

  return null;
end;
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

drop trigger if exists goksorry_room_entries_set_updated_at on public.goksorry_room_entries;
create trigger goksorry_room_entries_set_updated_at
before update on public.goksorry_room_entries
for each row
execute function public.set_updated_at();

drop trigger if exists goksorry_room_replies_set_updated_at on public.goksorry_room_replies;
create trigger goksorry_room_replies_set_updated_at
before update on public.goksorry_room_replies
for each row
execute function public.set_updated_at();

drop trigger if exists goksorry_room_replies_refresh_entry_count on public.goksorry_room_replies;
create trigger goksorry_room_replies_refresh_entry_count
after insert or delete or update of entry_id, is_deleted on public.goksorry_room_replies
for each row
execute function public.goksorry_room_replies_refresh_entry_count();

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
alter table public.goksorry_room_entries enable row level security;
alter table public.goksorry_room_replies enable row level security;
alter table public.votes enable row level security;
alter table public.reports enable row level security;
alter table public.policy_changes enable row level security;
alter table public.policy_document_versions enable row level security;

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

drop policy if exists goksorry_room_entries_public_select on public.goksorry_room_entries;
create policy goksorry_room_entries_public_select
on public.goksorry_room_entries
for select
using (is_deleted = false);

drop policy if exists goksorry_room_replies_public_select on public.goksorry_room_replies;
create policy goksorry_room_replies_public_select
on public.goksorry_room_replies
for select
using (is_deleted = false);

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

drop policy if exists policy_changes_public_select on public.policy_changes;
create policy policy_changes_public_select
on public.policy_changes
for select
using (true);

drop policy if exists policy_document_versions_public_select on public.policy_document_versions;
create policy policy_document_versions_public_select
on public.policy_document_versions
for select
using (true);

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
  withdrawn_accounts_purged_at timestamptz,
  hold_list jsonb not null default '[]'::jsonb,
  collection_policy jsonb not null default '{"sources":[]}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint detector_status_collection_policy_object check (jsonb_typeof(collection_policy) = 'object')
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

-- Legal revision and member-content cleanup (migration 027).
-- Delete member room content before ON DELETE SET NULL loses its ownership.
-- Guest content and separate chat storage are unaffected.
create or replace function public.delete_member_room_content()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  delete from public.goksorry_room_replies where author_id = old.id;
  delete from public.goksorry_room_entries where author_id = old.id;
  return old;
end;
$$;
revoke all on function public.delete_member_room_content() from public, anon, authenticated;
drop trigger if exists profiles_delete_room_content on public.profiles;
create trigger profiles_delete_room_content
before delete on public.profiles
for each row execute function public.delete_member_room_content();

-- Preserve existing effective versions and consent timestamps. Publish both
-- revisions together, with at least seven full days to review the full text.
do $release$
declare
  publication timestamptz := now();
  effective timestamptz := greatest(
    '2026-11-25 00:00:00+09'::timestamptz,
    date_trunc('day', timezone('Asia/Seoul', now()) + interval '8 days') at time zone 'Asia/Seoul'
  );
begin
  if exists (
    select 1 from public.policy_document_versions
    where superseded_at is null and effective_at > publication
      and id not in ('8b52c24b-bf91-4a62-b542-fb2c5fe2b317', 'a59af39c-a758-4a8f-878a-a9bf5634ba17')
  ) then
    raise exception 'Another policy revision is pending; reconcile before publishing this release';
  end if;

  insert into public.policy_document_versions
    (id, type, summary, body, is_adverse, published_at, effective_at, updated_at, created_at)
  values
    ('8b52c24b-bf91-4a62-b542-fb2c5fe2b317', 'terms', '무료·광고 미운영, 책임 범위, 외부 콘텐츠·AI 분석, 삭제·이의제기 및 개정 절차 정비',
$body$## 1. 목적과 적용 범위

이 약관은 곡소리닷컴(이하 서비스) 운영자와 이용자 사이의 서비스 이용 조건을 정합니다. 회원과 비회원 모두 자신이 이용하는 기능에 해당하는 조항을 적용받습니다. 법령이 보장하는 이용자의 권리를 이 약관으로 제한하지 않습니다.

## 2. 서비스의 내용과 비용

서비스는 외부 투자 커뮤니티의 공개 게시물 제목과 원문 링크, 이를 바탕으로 한 감성 분석·통계·시각화, 자체 게시판·곡소리방·채팅을 제공합니다. 화면에 표시되는 외부 피드는 제목과 원문 링크 중심이며, 원문은 해당 출처에서 확인할 수 있습니다. 분석 과정에서 공개 게시물의 본문 등 추가 정보가 처리될 수 있으므로 화면의 표시 범위와 분석 입력 범위는 다를 수 있습니다.

현재 서비스는 무료이며 광고를 게재하지 않습니다. 향후 유료 기능 또는 광고를 도입하는 경우 도입 내용과 시점을 사전에 안내하고, 결제나 추가 개인정보 처리에 필요한 동의를 별도로 받습니다. 이 약관에 동의했다는 이유만으로 요금이 발생하거나 광고 목적의 개인정보 처리에 동의한 것으로 보지 않습니다.

## 3. 회원가입과 비회원 이용

Google 로그인 후 닉네임 설정, 만 14세 이상 확인, 이용약관 동의 및 개인정보처리방침 확인 등 가입 절차를 완료하면 회원 기능을 이용할 수 있습니다. Google 로그인만 마친 상태에서는 일부 회원 기능을 사용할 수 없습니다. 서비스는 만 14세 이상을 대상으로 하며, 만 14세 미만의 가입 사실을 확인하면 관련 법령에 따라 필요한 확인·삭제 조치를 합니다.

비회원은 공개 화면을 열람하고 서비스가 제공하는 범위에서 곡소리방과 닉네임 기반 채팅에 참여할 수 있습니다. 비회원 표시가 붙을 수 있으며, 비회원 작성물의 본인 확인에는 해당 브라우저의 작성자 식별정보가 사용됩니다. 쿠키 삭제나 기기 변경으로 본인 확인이 어려워질 수 있습니다.

회원은 계정 접근수단을 관리하고 도용 사실을 알게 되면 운영자에게 알려야 합니다. 닉네임 변경 및 탈퇴 후 재가입에는 현재 각각 7일의 제한이 적용됩니다. 이용자가 책임질 사유가 없는 계정 도용 피해까지 이용자에게 부담시키지는 않습니다.

## 4. 이용자가 지켜야 할 사항

- 다른 사람의 계정 도용, 사칭, 개인정보의 무단 공개
- 불법 정보, 명예훼손, 협박, 차별·혐오 또는 다른 사람의 권리를 침해하는 내용의 게시
- 도배, 스팸, 무단 광고, 보안 침해 또는 서비스에 과도한 부하를 주는 자동화
- 시세조종, 시장교란, 사기 또는 이를 유도하는 허위 정보의 유포
- 접근 제한의 우회, 권한 없는 데이터 수집·재배포 등 법령이나 권리자의 권리를 침해하는 행위

위 행위를 해서는 안 됩니다. 자신의 게시물에 타인의 개인정보나 권리가 포함되는 경우 게시할 권한이 있는지 확인해야 합니다. 이용자의 책임은 해당 행위와 귀책사유에 따라 관계 법령이 정하는 범위에서 판단합니다.

## 5. 게시물의 권리와 이용

이용자가 작성한 게시물의 저작권은 해당 권리자에게 있습니다. 이용자는 서비스에 게시물을 올림으로써 해당 게시물을 서비스 안에서 저장·표시·전송하고 운영·보안·신고 처리에 필요한 범위에서 처리하도록 허락합니다. 별도 광고 활용, 판매 또는 서비스 운영과 무관한 이용을 포괄적으로 허락한 것으로 보지 않습니다.

외부 게시물과 원문에 대한 권리는 원저작자 등 정당한 권리자에게 있습니다. 출처 표시와 원문 링크 제공은 그 권리를 이전받거나 이용 허락을 얻었다는 의미가 아닙니다. 서비스 화면을 통해 접근할 수 있다는 이유만으로 원문을 임의로 복제·재배포할 수 없습니다.

권리자 또는 정보주체는 대상 URL, 문제되는 내용과 요청 사유를 적어 [admin@goksorry.com](mailto:admin@goksorry.com)으로 정정·삭제·연결 제외를 요청할 수 있습니다. 운영자는 권리와 요청 내용을 확인하고 관계 법령에 따라 필요한 조치를 합니다.

## 6. 신고, 게시물 조치와 이용 제한

운영자는 구체적인 위반 사실, 권리침해 신고 또는 보안상 위험을 확인한 경우 해당 내용의 표시 제한·삭제 또는 계정 이용 제한을 할 수 있습니다. 단순한 의견 차이나 비판만을 이유로 제재하지 않습니다. 조치는 위반의 내용·반복성·피해 정도에 비례하도록 합니다.

가능한 연락수단이 있는 경우 조치 이유와 이의제기 방법을 안내합니다. 긴급한 피해 예방, 법령상 비공개 의무 또는 보안상 필요가 있는 경우 먼저 조치한 뒤 안내할 수 있습니다. 이용자는 [admin@goksorry.com](mailto:admin@goksorry.com)으로 이의를 제기할 수 있으며, 운영자는 사실관계를 검토하여 잘못된 조치를 시정합니다.

## 7. 외부 정보와 AI 분석의 한계

외부 피드의 원문 열람에는 각 출처 사이트의 이용 조건이 적용됩니다. 출처의 삭제·접근 제한·수집 중단 등으로 링크나 분석 결과가 제공되지 않을 수 있습니다. 원문 링크를 통한 방문 유도 자체가 출처의 수집·분석·재이용 허락을 대신하지는 않습니다.

감성 지수, 삐에로봇 등 AI 분석은 수집된 표본과 자동 처리 결과입니다. 누락, 오분류, 편향, 지연 또는 사실과 다른 내용이 포함될 수 있으며 전체 투자자 여론을 대표하거나 미래 가격을 예측한다고 보장하지 않습니다. 분석·표현의 오류나 권리침해는 운영자에게 신고할 수 있습니다.

본 서비스는 투자자문, 금융상품 권유 또는 수익 보장을 제공하지 않습니다. 투자 결정 전 원문과 신뢰할 수 있는 자료를 직접 확인해야 하며, 투자 판단은 이용자가 합니다. 이 안내는 운영자의 위법행위나 귀책사유에 따른 법적 책임을 배제하지 않습니다.

## 8. 탈퇴와 게시물 삭제

회원은 프로필 화면에서 탈퇴를 요청할 수 있습니다. 탈퇴 시 회원 정보, 해당 회원 계정으로 작성한 게시판·곡소리방 글과 댓글, 신고 정보 및 발급한 API 토큰을 삭제합니다. 원글 삭제에 따라 그 글에 연결된 댓글도 삭제될 수 있습니다.

로그인하지 않고 작성한 글은 회원 계정과 연결되지 않으므로 회원 탈퇴만으로 삭제되지 않습니다. 비회원 작성물은 해당 브라우저에서 삭제하거나 운영자에게 본인 확인을 거쳐 삭제를 요청할 수 있습니다. 실시간 채팅의 최근 메시지 기록도 회원 탈퇴와 별도로 관리되므로 삭제가 필요하면 운영자에게 요청할 수 있습니다. 구체적인 처리 항목과 보유기간은 [개인정보처리방침](/privacy)에 따릅니다.

운영자가 관리하지 않는 다른 이용자의 저장본이나 외부 사이트의 복제본까지 삭제를 보장하지는 않습니다. 법령에 따른 보관 의무가 있는 경우에는 필요한 정보만 해당 기간 동안 분리하여 보관합니다.

## 9. 서비스 변경과 중단

운영자는 기능 개선, 보안, 출처의 제공 중단 또는 운영 사정으로 기능을 변경하거나 서비스를 중단할 수 있습니다. 이용자에게 중대한 영향을 주는 변경·종료는 내용과 시점을 사전에 공지합니다. 장애나 긴급 보안 대응 등 사전 공지가 어려운 경우 사유와 후속 조치를 가능한 한 신속히 안내합니다.

서비스의 무중단 제공, 분석 결과의 완전성 또는 특정 목적 적합성을 보장하지는 않습니다. 다만 무료 서비스라는 이유만으로 운영자가 법령상 부담하는 책임을 면제하지 않습니다.

## 10. 손해배상과 분쟁

운영자와 이용자는 각자의 고의 또는 과실로 상대방에게 손해를 발생시킨 경우 관계 법령에 따라 책임을 부담합니다. 외부 서비스 장애, 이용자 사이의 분쟁 또는 불가항력에 대해서도 운영자의 귀책사유와 법령상 의무에 따라 책임을 판단합니다. 이용자에게 부당한 입증책임이나 제3자 청구의 일괄 배상 의무를 부과하지 않습니다.

이 약관은 대한민국 법률을 따르며, 소송의 관할은 민사소송법 등 관계 법령에 따릅니다.

## 11. 약관 변경과 시행

약관을 변경할 때에는 개정 전문, 변경 사유와 시행일을 서비스 안에 공개합니다. 이용자에게 불리하거나 권리·의무에 중요한 영향을 주는 변경은 시행일 최소 7일 전부터 공지합니다. 관계 법령상 더 긴 기간이나 개별 통지·별도 동의가 필요한 경우에는 그 절차를 따릅니다.

단순히 서비스를 계속 이용하거나 이의를 제기하지 않았다는 이유만으로 법령상 필요한 동의를 받은 것으로 보지 않습니다. 개정에 동의하지 않는 회원은 탈퇴할 수 있으며, 기존 행위에 불리한 내용을 소급하여 적용하지 않습니다. 시행 전까지는 기존 약관을 적용합니다. 공고일·시행일과 이전 버전은 이 문서의 안내 및 변경 이력에서 확인할 수 있습니다.

## 12. 개인정보와 문의

개인정보 처리는 [개인정보처리방침](/privacy)에 따릅니다. 처리방침의 공개·확인은 별도의 선택 동의나 법령상 필요한 동의를 대신하지 않습니다.

서비스 운영, 권리침해 신고 및 이의제기 연락처: 곡소리닷컴 운영자, [admin@goksorry.com](mailto:admin@goksorry.com).$body$,
      true, publication, effective, publication, publication),
    ('a59af39c-a758-4a8f-878a-a9bf5634ba17', 'privacy', '채팅·비회원·탈퇴 정보, 수탁자, 국내 저장과 국외 처리, 보유기간·권리 행사 안내 보완',
$body$## 1. 적용 범위와 처리 원칙

곡소리닷컴 운영자는 회원, 비회원 및 서비스에서 처리되는 개인정보의 정보주체를 위해 이 방침을 공개합니다. 서비스 제공에 필요한 최소한의 개인정보를 처리하며, 선택적인 방문 통계 분석을 거부해도 기본 서비스를 이용할 수 있습니다. 현재 서비스는 무료이며 광고를 게재하지 않습니다.

회원관리와 이용자가 요청한 기능 제공에 필요한 처리는 개인정보 보호법 제15조 제1항 제4호에 따른 계약의 체결·이행을 근거로 합니다. 부정 이용 방지 등은 목적·필요성·정보주체의 권리를 검토하여 법령상 허용되는 범위에서 처리합니다. 선택 분석처럼 동의가 필요한 처리는 별도 동의를 근거로 하며, 이 방침을 확인했다는 사실만으로 모든 처리에 동의한 것으로 보지 않습니다.

## 2. 처리하는 항목과 목적

- Google 로그인: Google 계정 식별자, 이메일 주소, Google이 제공하는 이름·프로필 이미지 등 기본 프로필과 로그인 세션 정보를 처리합니다. 계정 식별, 로그인 유지 및 초기 닉네임 안내에 이용합니다. Google 비밀번호는 곡소리닷컴이 수집하지 않습니다.
- 회원관리: 내부 회원 식별자, 이메일, Google 계정 식별자, 닉네임, 회원·관리자 권한, 가입·닉네임 설정·변경 시각, 만 14세 이상 확인 시각, 약관·방침 확인 및 동의 시각을 처리합니다. 가입 완료, 권한 관리 및 변경 이력 확인에 이용합니다.
- 게시판·곡소리방: 글·댓글 내용, 작성자 식별정보·표시명, 작성·수정 시각과 삭제 상태를 처리합니다. 비회원 작성에는 브라우저 작성자 식별 쿠키와 그 식별값을 변환한 값을 사용합니다. 게시물 표시, 본인 글 관리 및 도배 방지에 이용합니다.
- 실시간 채팅: 회원 또는 비회원 식별정보, 닉네임, 메시지, 전송시각 및 연결 정보를 처리합니다. 공개 채팅 전달, 최근 대화 표시, 접속 및 남용 방지에 이용합니다. 메시지와 닉네임은 다른 참여자에게 공개됩니다.
- 신고·문의·계정 탈퇴: 신고 대상과 사유, 신고자 식별정보, 문의 이메일·내용·처리 내역, 탈퇴 이메일·Google 계정 식별자·탈퇴 시각·사유를 처리합니다. 신고 대응, 권리 행사 및 탈퇴 후 7일 재가입 제한 확인에 이용합니다.
- 운영과 보안: 요청 과정의 IP 주소, 접속시각, 브라우저·기기 정보, 요청 경로 및 오류·보안 기록이 호스팅·통신 사업자에 의해 처리될 수 있습니다. 서비스 제공과 장애·부정 이용 대응에 이용합니다.
- 선택 방문 통계: 동의한 경우 Google Analytics가 쿠키 식별자, 페이지 주소·조회 및 이용 이벤트, 접속시각, 기기·브라우저 정보와 IP 기반 대략적 지역 등을 처리합니다. 방문 통계와 서비스 개선에 이용합니다. 서비스는 회원의 이름·이메일을 분석 이벤트 항목으로 별도 전송하지 않습니다.

공개 게시물이나 닉네임에는 본인 또는 타인의 연락처, 주민등록번호, 건강·금융계좌 정보 등 불필요한 개인정보를 입력하지 마세요. 민감정보나 고유식별정보를 서비스 가입 항목으로 요구하지 않습니다.

## 3. 보유기간과 탈퇴 시 처리

- 회원 정보는 회원 탈퇴 또는 서비스 종료 시까지 보유합니다. 탈퇴 시 회원 계정에 연결된 게시판·곡소리방 글과 댓글, 신고 정보 및 API 토큰을 삭제합니다. 원글 삭제 시 그 글의 댓글도 함께 삭제될 수 있습니다.
- 비회원 곡소리방 글·댓글은 작성물 삭제 또는 서비스 종료 시까지 표시됩니다. 삭제 기능은 내용을 삭제 표시로 바꾸며, 작성자 식별정보·표시명·삭제 상태 등 일부 기록은 서버에 남을 수 있습니다. 이 기록의 삭제는 운영자에게 별도로 요청할 수 있습니다. 회원 계정과 연결되지 않아 회원 탈퇴로 자동 삭제되지 않으며, 브라우저 쿠키를 삭제해도 서버의 작성물이 자동 삭제되지는 않습니다.
- 채팅의 최근 대화는 채팅방별 최근 30건까지 유지하며, 새 메시지로 대체되거나 운영자가 삭제할 때까지 남을 수 있습니다. 별도의 시간 기준 자동 만료는 적용하지 않습니다. 회원 탈퇴와 자동 연동하여 삭제되는 기록이 아니므로 삭제가 필요하면 운영자에게 요청할 수 있습니다.
- 탈퇴 이메일, Google 계정 식별자, 탈퇴 시각·사유는 재가입 제한 확인을 위해 탈퇴 후 7일 동안 별도로 보관합니다. 기간이 지난 기록은 정리 대상이며 로그인 시 실행되는 정리 절차에서도 삭제합니다. 현재 로그인 여부와 무관하게 특정 시각에 삭제되는 방식은 아닙니다.
- 문의·권리 행사 자료는 요청 처리에 필요한 기간 보관한 뒤 삭제합니다. 구체적인 분쟁이나 법령상 보존 의무가 있으면 근거와 기간을 확인하여 필요한 정보만 별도 보관하고, 해당 사유가 끝나면 삭제합니다. 단순히 향후 분쟁 가능성이 있다는 이유로 무기한 보관하지 않습니다.
- Google Analytics의 이벤트·사용자 데이터와 각 수탁자의 접속·보안 로그 보유기간은 해당 서비스의 설정 및 계약에 따릅니다. 현재 확인된 고정 보유기간을 제시할 수 없는 항목은 운영자에게 문의할 수 있습니다. 브라우저 쿠키 만료와 수탁자 서버 데이터 삭제는 서로 다른 절차입니다.

## 4. 개인정보 처리 위탁과 외부 서비스

서비스 운영을 위해 아래 사업자의 서비스를 이용합니다. 수탁업무와 독립적인 외부 서비스 이용을 구분하며, 법령에 따른 감독 및 필요한 계약·보호조치를 이행해야 합니다.

- Supabase: 회원·게시물·신고 등 서비스 데이터의 데이터베이스 보관과 관리. 현재 서비스 데이터베이스 저장 리전은 대한민국 서울입니다. 로그인 자체는 Supabase Auth가 아닌 Google과 서비스의 로그인 세션을 통해 처리합니다. [Supabase 개인정보 안내](https://supabase.com/privacy)
- Vercel: 웹 서비스 호스팅, 서버 요청 처리, 콘텐츠 전달 및 운영·보안 처리. [Vercel 개인정보 안내](https://vercel.com/legal/privacy-policy)
- Cloudflare: 실시간 채팅 연결·전달, 최근 채팅 기록 보관 및 연결 보안 처리. [Cloudflare 개인정보 안내](https://www.cloudflare.com/privacypolicy/)
- Google LLC의 Google Analytics: 선택 동의에 따른 방문 통계 처리. [Google 개인정보 안내](https://policies.google.com/privacy?hl=ko)
- Google Cloud의 Vertex AI: 외부 공개 게시물·뉴스 등의 감성·정보 분석. 수집된 제목·본문에 개인정보가 포함되면 분석 입력에서도 처리될 수 있습니다. [Google Cloud 개인정보 안내](https://cloud.google.com/terms/cloud-privacy-notice)

Google 계정 로그인에서는 Google이 자신의 계정 서비스를 운영하고, 이용자가 승인한 계정 정보를 곡소리닷컴에 전달합니다. Google의 독립적인 계정 서비스에는 Google의 개인정보처리방침이 적용됩니다. 외부 원문 링크를 누르면 해당 사이트로 이동하며, 이동 후 처리는 해당 사이트의 방침에 따릅니다.

개인정보를 판매하지 않습니다. 위탁 외의 제3자 제공은 이용자의 별도 동의나 법령에 정한 근거가 있는 경우에 한하며, 필요한 항목·목적·제공받는 자를 안내합니다. 게시물과 채팅은 이용자가 공개 기능에 입력한 범위에서 다른 이용자가 볼 수 있습니다.

## 5. 국내 저장과 국외 처리

서비스 데이터베이스의 대한민국 서울 저장과 외부 사업자의 처리 위치는 구분됩니다. 국내 DB 저장만으로 Google 로그인·분석, Vercel의 콘텐츠 전달·보안, Cloudflare 채팅, Google Cloud AI 처리 및 해외 지원 접근까지 모두 국내로 제한된다고 보장하지 않습니다. 외국 사업자라는 이유만으로 모든 처리가 국외 이전인 것도 아닙니다.

외부 서비스에는 로그인·페이지 요청·채팅·통계 전송 또는 분석 작업 시 필요한 데이터가 네트워크로 전달됩니다. 목적과 항목은 위 조항과 같으며, 국외 처리가 발생하는 경우에는 개인정보 보호법 제28조의8에 따른 적법한 이전 근거와 고지가 필요합니다. 사업자의 본사 소재지를 실제 이전 국가로 간주하지 않습니다.

현재 사업자별 실제 이전 국가, 해외 접근 범위와 일부 서버 데이터 보유기간은 추가 확인이 필요한 상태입니다. 따라서 이 방침의 외부 사업자 안내만으로 국외 이전에 필요한 세부 고지가 모두 완료되었다고 볼 수 없습니다. 운영자는 확인된 이전 국가, 받는 자와 연락처, 항목, 목적·보유기간, 시기·방법, 법적 근거 및 거부 방법을 구체화하여 안내하고, 별도 동의가 필요한 처리는 그 동의를 받아야 합니다.

이용자는 선택 분석을 거부·철회하거나 채팅을 이용하지 않을 수 있으며, 필수 처리에 대한 문의·처리정지·삭제 요청은 [admin@goksorry.com](mailto:admin@goksorry.com)으로 할 수 있습니다. 해당 처리가 기능 제공에 필수적인 경우 그 기능 이용이 제한될 수 있습니다. 이 안내 자체를 국외 이전 동의로 보지 않습니다.

## 6. 외부 공개 게시물의 처리

외부 피드는 공개 게시물의 제목·원문 URL·게시 정보 및 분석에 필요한 본문을 수집·분석하여 연결 정보와 통계로 제공합니다. 화면에서 제목만 보이더라도 분석 과정에서 본문이 처리될 수 있습니다. 원문에 작성자 정보나 다른 사람의 개인정보가 포함될 수 있습니다.

공개된 정보라는 이유만으로 개인정보를 제한 없이 이용할 수 있는 것은 아닙니다. 정보주체는 해당 URL과 요청 내용을 보내 수집 출처·처리 목적에 관한 안내, 정정·삭제·처리정지 등을 요청할 수 있습니다. 운영자는 관계 법령에 따라 요청을 검토하고 필요한 조치를 합니다.

## 7. 쿠키와 브라우저 저장소

- 로그인·보안 쿠키: 로그인 세션 유지 및 요청 위조 방지 등에 사용하며, 로그아웃·세션 만료 또는 브라우저 설정에 따라 삭제됩니다.
- 비회원 채팅 세션 쿠키: 최대 7일. 채팅 닉네임 및 곡소리방 비회원 작성자 식별 쿠키: 최대 1년. 기능 이용 과정에서 갱신될 수 있습니다.
- 쿠키 선택 및 테마 등 설정 쿠키: 최대 1년. 로컬 저장소에 저장하는 화면 설정 등은 이용자가 삭제하거나 해당 기능에서 초기화할 때까지 남을 수 있습니다.
- 선택 분석 쿠키: Google Analytics 방문 통계용입니다. 쿠키 선택에서 '모두 허용'을 선택한 경우에만 분석 스크립트를 활성화합니다. 쿠키별 만료는 Google 설정에 따르며 서버 측 보유기간과 같지 않습니다.

사이트 하단 '쿠키 설정'에서 선택을 바꿀 수 있습니다. '필수만 사용'을 선택하면 이후 선택 분석을 중단하고 기존 분석 쿠키의 삭제를 시도합니다. 이미 전송된 서버 기록까지 브라우저 설정만으로 삭제되는 것은 아닙니다. 브라우저 설정에서 쿠키·사이트 데이터를 직접 삭제하거나 차단할 수도 있습니다. 필수 쿠키를 차단하면 로그인이나 비회원 작성물 관리 등이 제한될 수 있습니다.

## 8. 파기와 안전성 확보

목적 달성이나 보유기간 만료 시 법령상 보존 의무가 없는 개인정보를 지체 없이 파기해야 합니다. 운영 데이터는 삭제하고, 별도 보관 의무가 있는 정보는 다른 처리 목적에 사용하지 않습니다. 전자적 정보는 삭제 등 복구가 어렵도록 하는 방법으로, 종이 문서가 발생한 경우에는 파쇄 등의 방법으로 파기합니다. 수탁자의 백업·로그는 해당 사업자의 삭제 주기와 계약 범위를 확인하여 관리합니다.

서비스는 HTTPS 등 암호화 통신, 서버 측 비밀키 관리, 관리자 권한 제한 및 데이터베이스 접근 통제 등 보호조치를 사용합니다. 보안 문제를 발견하면 운영자에게 신고할 수 있습니다. 보안조치가 모든 위험의 부재를 보장하는 것은 아닙니다.

## 9. 정보주체의 권리와 행사 방법

정보주체는 개인정보 열람, 정정·삭제, 처리정지 및 동의 철회를 요청할 수 있습니다. 회원은 프로필 화면에서 가능한 항목을 변경하거나 탈퇴할 수 있으며, 비회원과 외부 게시물의 정보주체도 이메일로 권리를 행사할 수 있습니다. 대리인 요청에는 대리권 확인이 필요할 수 있습니다.

요청은 [admin@goksorry.com](mailto:admin@goksorry.com)으로 보내 주세요. 운영자는 본인 확인에 필요한 최소한의 정보를 요청하고 법정 기한 안에 처리 결과를 안내합니다. 법령상 제한으로 요청을 전부 또는 일부 이행할 수 없는 경우 이유와 이의제기 방법을 안내합니다.

서비스의 AI 지수와 정보 분석은 투자 참고 정보를 제공하며, 개인의 권리·의무에 중대한 영향을 미치는 자동화된 결정을 목적으로 하지 않습니다. 분석에 포함된 본인 정보의 오류나 권리침해도 위 연락처로 요청할 수 있습니다.

## 10. 아동의 개인정보

서비스는 만 14세 미만 아동을 대상으로 하지 않으며 회원가입 시 만 14세 이상 여부를 확인합니다. 만 14세 미만 아동의 정보가 적법한 근거 없이 수집된 사실을 확인하면 삭제 등 필요한 조치를 합니다. 보호자는 운영자에게 해당 사실을 알리고 확인·삭제를 요청할 수 있습니다.

## 11. 문의와 권리구제

개인정보 보호업무 및 고충처리 담당: 곡소리닷컴 운영자. 연락처: [admin@goksorry.com](mailto:admin@goksorry.com).

개인정보 침해 신고와 분쟁 해결에 관해서는 [개인정보침해 신고센터](https://privacy.kisa.or.kr/) 및 [개인정보 분쟁조정위원회](https://www.kopico.go.kr/)의 안내도 이용할 수 있습니다.

## 12. 방침 변경

방침을 변경하면 개정 전문, 변경 내용과 시행일을 서비스 안에 공개합니다. 중요한 변경은 시행일 최소 7일 전에 공지하며, 관계 법령상 별도 통지나 동의가 필요한 경우 그 절차를 따릅니다. 기존의 선택 분석 동의가 새로운 광고 목적이나 추가적인 개인정보 처리에 자동으로 적용되지는 않습니다.

공고일·시행일은 문서 안내에서 확인할 수 있고, 이전 방침과 개정 예정 전문은 변경 이력에서 확인할 수 있습니다. 시행 전까지는 기존 방침을 적용합니다.$body$,
      true, publication, effective, publication, publication)
  on conflict (id) do nothing;
end;
$release$;

-- Data retention (028)
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

-- Retention policy (030)
-- Publish a new revision, preserving the previous pending document for history.
do $release$
declare
  publication timestamptz := now();
  effective timestamptz := greatest('2026-11-25 00:00:00+09'::timestamptz,
    date_trunc('day', timezone('Asia/Seoul', now()) + interval '8 days') at time zone 'Asia/Seoul');
begin
  if exists(select 1 from public.policy_document_versions where id = '59c66f82-6df5-4f93-910b-52ff364bd4a5') then return; end if;
  if exists(select 1 from public.policy_document_versions where type = 'privacy' and superseded_at is null
    and effective_at > publication and id <> 'a59af39c-a758-4a8f-878a-a9bf5634ba17') then
    raise exception 'Unexpected pending privacy policy; reconcile before publishing';
  end if;
  update public.policy_document_versions set superseded_at = publication
    where id = 'a59af39c-a758-4a8f-878a-a9bf5634ba17' and effective_at > publication and superseded_at is null;
  insert into public.policy_document_versions(id,type,summary,body,is_adverse,published_at,effective_at,updated_at,created_at)
  values ('59c66f82-6df5-4f93-910b-52ff364bd4a5','privacy',
    '정기 파기, 삭제 후 잔존 정보 제거, 채팅 24시간·분석 자료 7일 보관 기준 반영',
$body$## 1. 적용 범위와 처리 원칙

곡소리닷컴 운영자는 회원, 비회원 및 서비스에서 처리되는 개인정보의 정보주체를 위해 이 방침을 공개합니다. 서비스 제공에 필요한 최소한의 개인정보를 처리하며, 선택적인 방문 통계 분석을 거부해도 기본 서비스를 이용할 수 있습니다. 현재 서비스는 무료이며 광고를 게재하지 않습니다.

회원관리와 이용자가 요청한 기능 제공에 필요한 처리는 개인정보 보호법 제15조 제1항 제4호에 따른 계약의 체결·이행을 근거로 합니다. 부정 이용 방지 등은 목적·필요성·정보주체의 권리를 검토하여 법령상 허용되는 범위에서 처리합니다. 선택 분석처럼 동의가 필요한 처리는 별도 동의를 근거로 하며, 이 방침을 확인했다는 사실만으로 모든 처리에 동의한 것으로 보지 않습니다.

## 2. 처리하는 항목과 목적

- Google 로그인: Google 계정 식별자, 이메일 주소, Google이 제공하는 이름·프로필 이미지 등 기본 프로필과 로그인 세션 정보를 처리합니다. 계정 식별, 로그인 유지 및 초기 닉네임 안내에 이용합니다. Google 비밀번호는 곡소리닷컴이 수집하지 않습니다.
- 회원관리: 내부 회원 식별자, 이메일, Google 계정 식별자, 닉네임, 회원·관리자 권한, 가입·닉네임 설정·변경 시각, 만 14세 이상 확인 시각, 약관·방침 확인 및 동의 시각을 처리합니다. 가입 완료, 권한 관리 및 변경 이력 확인에 이용합니다.
- 게시판·곡소리방: 글·댓글 내용, 작성자 식별정보·표시명, 작성·수정 시각과 삭제 상태를 처리합니다. 비회원 작성에는 브라우저 작성자 식별 쿠키와 그 식별값을 변환한 값을 사용합니다. 게시물 표시, 본인 글 관리 및 도배 방지에 이용합니다.
- 실시간 채팅: 회원 또는 비회원 식별정보, 닉네임, 메시지, 전송시각 및 연결 정보를 처리합니다. 공개 채팅 전달, 최근 대화 표시, 접속 및 남용 방지에 이용합니다. 메시지와 닉네임은 다른 참여자에게 공개됩니다.
- 신고·문의·계정 탈퇴: 신고 대상과 사유, 신고자 식별정보, 문의 이메일·내용·처리 내역, 탈퇴 이메일·Google 계정 식별자·탈퇴 시각·사유를 처리합니다. 신고 대응, 권리 행사 및 탈퇴 후 7일 재가입 제한 확인에 이용합니다.
- 운영과 보안: 요청 과정의 IP 주소, 접속시각, 브라우저·기기 정보, 요청 경로 및 오류·보안 기록이 호스팅·통신 사업자에 의해 처리될 수 있습니다. 서비스 제공과 장애·부정 이용 대응에 이용합니다.
- 선택 방문 통계: 동의한 경우 Google Analytics가 쿠키 식별자, 페이지 주소·조회 및 이용 이벤트, 접속시각, 기기·브라우저 정보와 IP 기반 대략적 지역 등을 처리합니다. 방문 통계와 서비스 개선에 이용합니다. 서비스는 회원의 이름·이메일을 분석 이벤트 항목으로 별도 전송하지 않습니다.

공개 게시물이나 닉네임에는 본인 또는 타인의 연락처, 주민등록번호, 건강·금융계좌 정보 등 불필요한 개인정보를 입력하지 마세요. 민감정보나 고유식별정보를 서비스 가입 항목으로 요구하지 않습니다.

## 3. 보유기간과 탈퇴 시 처리

- 회원 정보는 회원 탈퇴 또는 서비스 종료 시까지 보유합니다. 탈퇴 시 회원 계정에 연결된 게시판·곡소리방 글과 댓글, 신고 정보 및 API 토큰을 삭제합니다. 원글 삭제 시 그 글의 댓글도 함께 삭제될 수 있습니다.
- 게시판·곡소리방의 글·댓글은 이용자가 삭제하거나 회원 탈퇴에 따른 삭제가 이뤄지거나 서비스가 종료될 때까지 보유합니다. 삭제 기능을 실행하면 해당 작성물의 내용·제목·작성자 식별정보·표시명을 서비스 DB에서 삭제하며, 원글에 연결된 댓글도 함께 삭제될 수 있습니다. 비회원 작성물은 회원 계정과 연결되지 않아 회원 탈퇴로 자동 삭제되지 않습니다. 브라우저 쿠키를 삭제해도 서버의 작성물은 자동 삭제되지 않으며, 작성물 관리가 어려우면 운영자에게 삭제를 요청할 수 있습니다.
- 채팅 메시지는 전송 후 24시간 이내의 최근 30건까지 보관합니다. 시간 만료 또는 새 메시지로 대체되면 자동 삭제하며, 운영자는 삭제 요청에 따라 개별 메시지를 삭제할 수 있습니다. 채팅 기록에는 회원 계정 ID를 보관하지 않으므로 회원 탈퇴와 자동 연동되지는 않습니다. 더 이른 삭제가 필요하면 닉네임·전송시각 등 메시지를 식별할 정보를 운영자에게 알려 주세요.
- 탈퇴 이메일, Google 계정 식별자, 탈퇴 시각·사유는 재가입 제한 확인을 위해 탈퇴 후 7일 동안 별도로 보관합니다. 로그인·수집 여부와 무관하게 10분 주기로 만료 기록을 정리하며, 재가입 확인 과정에서도 만료 기록을 삭제합니다. 정상 운영 시 만료 후 다음 정리 주기에 삭제되며, 장애가 발생하면 복구 후 정리합니다.
- 만료되거나 폐기된 API 토큰의 관리 기록은 만료·폐기 후 7일이 지난 다음 정리 주기에 삭제합니다. 회원 탈퇴 시에는 계정에 연결된 토큰을 함께 삭제합니다.
- 문의·권리 행사 자료는 요청 처리에 필요한 기간 보관한 뒤 삭제합니다. 구체적인 분쟁이나 법령상 보존 의무가 있으면 근거와 기간을 확인하여 필요한 정보만 별도 보관하고, 해당 사유가 끝나면 삭제합니다. 단순히 향후 분쟁 가능성이 있다는 이유로 무기한 보관하지 않습니다.
- Google Analytics의 이벤트·사용자 데이터와 각 수탁자의 접속·보안 로그 보유기간은 해당 서비스의 설정 및 계약에 따릅니다. 현재 확인된 고정 보유기간을 제시할 수 없는 항목은 운영자에게 문의할 수 있습니다. 브라우저 쿠키 만료와 수탁자 서버 데이터 삭제는 서로 다른 절차입니다.

## 4. 개인정보 처리 위탁과 외부 서비스

서비스 운영을 위해 아래 사업자의 서비스를 이용합니다. 수탁업무와 독립적인 외부 서비스 이용을 구분하며, 법령에 따른 감독 및 필요한 계약·보호조치를 이행해야 합니다.

- Supabase: 회원·게시물·신고 등 서비스 데이터의 데이터베이스 보관과 관리. 현재 서비스 데이터베이스 저장 리전은 대한민국 서울입니다. 로그인 자체는 Supabase Auth가 아닌 Google과 서비스의 로그인 세션을 통해 처리합니다. [Supabase 개인정보 안내](https://supabase.com/privacy)
- Vercel: 웹 서비스 호스팅, 서버 요청 처리, 콘텐츠 전달 및 운영·보안 처리. [Vercel 개인정보 안내](https://vercel.com/legal/privacy-policy)
- Cloudflare: 실시간 채팅 연결·전달, 최근 채팅 기록 보관 및 연결 보안 처리. [Cloudflare 개인정보 안내](https://www.cloudflare.com/privacypolicy/)
- Google LLC의 Google Analytics: 선택 동의에 따른 방문 통계 처리. [Google 개인정보 안내](https://policies.google.com/privacy?hl=ko)
- Google Cloud의 Vertex AI: 외부 공개 게시물·뉴스 등의 감성·정보 분석. 현재 분석 입력인 제목 등에 개인정보가 포함되면 AI 사업자에게도 전달될 수 있습니다. [Google Cloud 개인정보 안내](https://cloud.google.com/terms/cloud-privacy-notice)

Google 계정 로그인에서는 Google이 자신의 계정 서비스를 운영하고, 이용자가 승인한 계정 정보를 곡소리닷컴에 전달합니다. Google의 독립적인 계정 서비스에는 Google의 개인정보처리방침이 적용됩니다. 외부 원문 링크를 누르면 해당 사이트로 이동하며, 이동 후 처리는 해당 사이트의 방침에 따릅니다.

개인정보를 판매하지 않습니다. 위탁 외의 제3자 제공은 이용자의 별도 동의나 법령에 정한 근거가 있는 경우에 한하며, 필요한 항목·목적·제공받는 자를 안내합니다. 게시물과 채팅은 이용자가 공개 기능에 입력한 범위에서 다른 이용자가 볼 수 있습니다.

## 5. 국내 저장과 국외 처리

서비스 데이터베이스의 대한민국 서울 저장과 외부 사업자의 처리 위치는 구분됩니다. 국내 DB 저장만으로 Google 로그인·분석, Vercel의 콘텐츠 전달·보안, Cloudflare 채팅, Google Cloud AI 처리 및 해외 지원 접근까지 모두 국내로 제한된다고 보장하지 않습니다. 외국 사업자라는 이유만으로 모든 처리가 국외 이전인 것도 아닙니다.

외부 서비스에는 로그인·페이지 요청·채팅·통계 전송 또는 분석 작업 시 필요한 데이터가 네트워크로 전달됩니다. 목적과 항목은 위 조항과 같으며, 국외 처리가 발생하는 경우에는 개인정보 보호법 제28조의8에 따른 적법한 이전 근거와 고지가 필요합니다. 사업자의 본사 소재지를 실제 이전 국가로 간주하지 않습니다.

현재 사업자별 실제 이전 국가, 해외 접근 범위와 일부 서버 데이터 보유기간은 추가 확인이 필요한 상태입니다. 따라서 이 방침의 외부 사업자 안내만으로 국외 이전에 필요한 세부 고지가 모두 완료되었다고 볼 수 없습니다. 운영자는 확인된 이전 국가, 받는 자와 연락처, 항목, 목적·보유기간, 시기·방법, 법적 근거 및 거부 방법을 구체화하여 안내하고, 별도 동의가 필요한 처리는 그 동의를 받아야 합니다.

이용자는 선택 분석을 거부·철회하거나 채팅을 이용하지 않을 수 있으며, 필수 처리에 대한 문의·처리정지·삭제 요청은 [admin@goksorry.com](mailto:admin@goksorry.com)으로 할 수 있습니다. 해당 처리가 기능 제공에 필수적인 경우 그 기능 이용이 제한될 수 있습니다. 이 안내 자체를 국외 이전 동의로 보지 않습니다.

## 6. 외부 공개 게시물의 처리

현재 외부 피드는 공개 게시물의 실제 제목·원문 URL·게시 정보를 수집·분석하여 연결 정보와 통계로 제공합니다. 출처 서버의 응답에 본문이 포함될 수 있으나 현재 수집기는 본문을 저장하거나 AI 분석에 전달하지 않으며, 제목이 없는 글의 본문을 제목으로 대신 사용하지 않습니다. 제목에도 작성자 정보나 다른 사람의 개인정보가 포함될 수 있습니다. 외부 게시물·연결된 감성 분석 결과는 수집 후 7일, 분석 보고서·월드 재생 자료는 저장 후 7일을 기준으로 10분 주기 자동 정리를 적용합니다. 분석 대기 자료는 기본 6시간, 전송 재시도 자료·로컬 작업 백업·운영 로그는 7일을 기준으로 정리합니다. 출처별 허용 범위와 수집 운영 기준에 따라 이보다 일찍 삭제할 수 있습니다.

공개된 정보라는 이유만으로 개인정보를 제한 없이 이용할 수 있는 것은 아닙니다. 정보주체는 해당 URL과 요청 내용을 보내 수집 출처·처리 목적에 관한 안내, 정정·삭제·처리정지 등을 요청할 수 있습니다. 운영자는 관계 법령에 따라 요청을 검토하고 필요한 조치를 합니다.

## 7. 쿠키와 브라우저 저장소

- 로그인·보안 쿠키: 로그인 세션 유지 및 요청 위조 방지 등에 사용하며, 로그아웃·세션 만료 또는 브라우저 설정에 따라 삭제됩니다.
- 비회원 채팅 세션 쿠키: 최대 7일. 채팅 닉네임 및 곡소리방 비회원 작성자 식별 쿠키: 최대 1년. 기능 이용 과정에서 갱신될 수 있습니다.
- 쿠키 선택 및 테마 등 설정 쿠키: 최대 1년. 로컬 저장소에 저장하는 화면 설정 등은 이용자가 삭제하거나 해당 기능에서 초기화할 때까지 남을 수 있습니다.
- 선택 분석 쿠키: Google Analytics 방문 통계용입니다. 쿠키 선택에서 '모두 허용'을 선택한 경우에만 분석 스크립트를 활성화합니다. 쿠키별 만료는 Google 설정에 따르며 서버 측 보유기간과 같지 않습니다.

사이트 하단 '쿠키 설정'에서 선택을 바꿀 수 있습니다. '필수만 사용'을 선택하면 이후 선택 분석을 중단하고 기존 분석 쿠키의 삭제를 시도합니다. 이미 전송된 서버 기록까지 브라우저 설정만으로 삭제되는 것은 아닙니다. 브라우저 설정에서 쿠키·사이트 데이터를 직접 삭제하거나 차단할 수도 있습니다. 필수 쿠키를 차단하면 로그인이나 비회원 작성물 관리 등이 제한될 수 있습니다.

## 8. 파기와 안전성 확보

목적 달성이나 보유기간 만료 시 법령상 보존 의무가 없는 개인정보를 지체 없이 파기해야 합니다. 운영 데이터는 삭제하고, 별도 보관 의무가 있는 정보는 다른 처리 목적에 사용하지 않습니다. 전자적 정보는 삭제 등 복구가 어렵도록 하는 방법으로, 종이 문서가 발생한 경우에는 파쇄 등의 방법으로 파기합니다. 수탁자의 백업·로그는 해당 사업자의 삭제 주기와 계약 범위를 확인하여 관리합니다.

서비스는 HTTPS 등 암호화 통신, 서버 측 비밀키 관리, 관리자 권한 제한 및 데이터베이스 접근 통제 등 보호조치를 사용합니다. 보안 문제를 발견하면 운영자에게 신고할 수 있습니다. 보안조치가 모든 위험의 부재를 보장하는 것은 아닙니다.

## 9. 정보주체의 권리와 행사 방법

정보주체는 개인정보 열람, 정정·삭제, 처리정지 및 동의 철회를 요청할 수 있습니다. 회원은 프로필 화면에서 가능한 항목을 변경하거나 탈퇴할 수 있으며, 비회원과 외부 게시물의 정보주체도 이메일로 권리를 행사할 수 있습니다. 대리인 요청에는 대리권 확인이 필요할 수 있습니다.

요청은 [admin@goksorry.com](mailto:admin@goksorry.com)으로 보내 주세요. 운영자는 본인 확인에 필요한 최소한의 정보를 요청하고 법정 기한 안에 처리 결과를 안내합니다. 법령상 제한으로 요청을 전부 또는 일부 이행할 수 없는 경우 이유와 이의제기 방법을 안내합니다.

서비스의 AI 지수와 정보 분석은 투자 참고 정보를 제공하며, 개인의 권리·의무에 중대한 영향을 미치는 자동화된 결정을 목적으로 하지 않습니다. 분석에 포함된 본인 정보의 오류나 권리침해도 위 연락처로 요청할 수 있습니다.

## 10. 아동의 개인정보

서비스는 만 14세 미만 아동을 대상으로 하지 않으며 회원가입 시 만 14세 이상 여부를 확인합니다. 만 14세 미만 아동의 정보가 적법한 근거 없이 수집된 사실을 확인하면 삭제 등 필요한 조치를 합니다. 보호자는 운영자에게 해당 사실을 알리고 확인·삭제를 요청할 수 있습니다.

## 11. 문의와 권리구제

개인정보 보호업무 및 고충처리 담당: 곡소리닷컴 운영자. 연락처: [admin@goksorry.com](mailto:admin@goksorry.com).

개인정보 침해 신고와 분쟁 해결에 관해서는 [개인정보침해 신고센터](https://privacy.kisa.or.kr/) 및 [개인정보 분쟁조정위원회](https://www.kopico.go.kr/)의 안내도 이용할 수 있습니다.

## 12. 방침 변경

방침을 변경하면 개정 전문, 변경 내용과 시행일을 서비스 안에 공개합니다. 중요한 변경은 시행일 최소 7일 전에 공지하며, 관계 법령상 별도 통지나 동의가 필요한 경우 그 절차를 따릅니다. 기존의 선택 분석 동의가 새로운 광고 목적이나 추가적인 개인정보 처리에 자동으로 적용되지는 않습니다.

공고일·시행일은 문서 안내에서 확인할 수 있고, 이전 방침과 개정 예정 전문은 변경 이력에서 확인할 수 있습니다. 시행 전까지는 기존 방침을 적용합니다.
$body$,true,publication,effective,publication,publication);
end;
$release$;

-- Hosted cron is optional for disposable local Postgres installations.
do $schedule$
begin
  if exists(select 1 from pg_available_extensions where name='pg_cron') then
    execute 'create extension if not exists pg_cron with schema pg_catalog';
    execute 'grant usage on schema cron to postgres';
    execute 'grant all privileges on all tables in schema cron to postgres';
    perform cron.schedule('goksorry-data-retention','*/10 * * * *','select goksorry_private.run_data_retention();');
    perform cron.schedule('goksorry-retention-history','17 3 * * *',
      $job$delete from cron.job_run_details where end_time < now()-interval '7 days'
        and jobid in (select jobid from cron.job where jobname in ('goksorry-data-retention','goksorry-retention-history'));$job$);
  end if;
end;
$schedule$;
