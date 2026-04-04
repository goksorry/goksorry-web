alter table public.community_comments
  drop constraint if exists community_comments_content_plain_text;

alter table public.community_comments
  add constraint community_comments_content_plain_text
  check (content !~ '<');
