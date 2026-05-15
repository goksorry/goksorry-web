create table if not exists public.goksorry_room_entries (
  id uuid primary key default gen_random_uuid(),
  author_kind text not null check (author_kind in ('member', 'guest')),
  author_id uuid references public.profiles(id) on delete set null,
  guest_owner_hash text,
  author_label text not null default '익명',
  content text not null,
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
  constraint goksorry_room_entries_content_plain_text check (content !~ '[<>]' and char_length(content) between 1 and 160)
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
  constraint goksorry_room_replies_content_plain_text check (content !~ '[<>]' and char_length(content) between 1 and 300)
);

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

alter table public.goksorry_room_entries enable row level security;
alter table public.goksorry_room_replies enable row level security;

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

update public.policy_document_versions
set superseded_at = now()
where type = 'privacy'
  and superseded_at is null
  and effective_at > now();

insert into public.policy_document_versions (
  type,
  summary,
  body,
  is_adverse,
  published_at,
  effective_at,
  updated_at,
  created_at
)
select
  'privacy',
  '곡소리방 비회원 작성자 세션 고지',
  replace(
    replace(
      body,
      '- 채팅 기능이 활성화된 경우 비회원 채팅 세션 및 닉네임 쿠키 정보',
      '- 채팅 기능이 활성화된 경우 비회원 채팅 세션 및 닉네임 쿠키 정보' || chr(10) ||
      '- 곡소리방 비회원 작성자 세션 쿠키 정보'
    ),
    '- 필수 저장 항목: 로그인 세션 유지, 쿠키 동의 상태, 테마, 예쁜말 필터, 홈 시장 보정, 채팅 기능이 활성화된 경우 비회원 채팅 세션 및 닉네임',
    '- 필수 저장 항목: 로그인 세션 유지, 쿠키 동의 상태, 테마, 예쁜말 필터, 홈 시장 보정, 채팅 기능이 활성화된 경우 비회원 채팅 세션 및 닉네임, 곡소리방 비회원 작성자 세션'
  ),
  false,
  now(),
  now(),
  now(),
  now()
from (
  select body
  from public.policy_document_versions
  where type = 'privacy'
    and superseded_at is null
    and effective_at <= now()
  order by effective_at desc, published_at desc
  limit 1
) current_privacy;
