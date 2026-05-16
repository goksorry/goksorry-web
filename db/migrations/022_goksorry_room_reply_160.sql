alter table public.goksorry_room_replies
  drop constraint if exists goksorry_room_replies_content_plain_text;

alter table public.goksorry_room_replies
  add constraint goksorry_room_replies_content_plain_text
  check (content !~ '[<>]' and char_length(content) between 1 and 160);
