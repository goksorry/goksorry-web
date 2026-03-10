alter table public.external_posts
  add column if not exists clean_title text;

alter table public.external_posts
  drop constraint if exists external_posts_clean_title_plain_text;

alter table public.external_posts
  add constraint external_posts_clean_title_plain_text
  check (clean_title is null or clean_title !~ '[<>]');
