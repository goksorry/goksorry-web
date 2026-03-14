alter table public.community_posts
  add column if not exists is_pinned_notice boolean not null default false;

create index if not exists community_posts_notice_pin_idx
  on public.community_posts(board_id, is_pinned_notice, created_at desc);
