alter table public.api_access_tokens
  alter column token_prefix drop not null,
  alter column token_hash drop not null;

alter table public.api_access_tokens
  add column if not exists approval_status text not null default 'pending'
    check (approval_status in ('pending', 'approved', 'rejected')),
  add column if not exists approval_requested_at timestamptz not null default now(),
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by uuid references public.profiles(id) on delete set null,
  add column if not exists rejected_at timestamptz,
  add column if not exists rejected_by uuid references public.profiles(id) on delete set null,
  add column if not exists approval_note text;

alter table public.api_access_tokens
  drop constraint if exists api_access_tokens_note_plain_text;

alter table public.api_access_tokens
  add constraint api_access_tokens_note_plain_text
  check (approval_note is null or approval_note !~ '[<>]');

update public.api_access_tokens
set
  approval_status = 'approved',
  approval_requested_at = coalesce(approval_requested_at, created_at),
  approved_at = coalesce(approved_at, created_at)
where token_hash is not null
  and approval_status = 'pending';
