alter table public.goksorry_room_entries
  add column if not exists reply_count integer not null default 0;

alter table public.goksorry_room_entries
  drop constraint if exists goksorry_room_entries_reply_count_nonnegative;

alter table public.goksorry_room_entries
  add constraint goksorry_room_entries_reply_count_nonnegative
  check (reply_count >= 0);

update public.goksorry_room_entries entry
set reply_count = counts.reply_count
from (
  select entry_id, count(*)::integer as reply_count
  from public.goksorry_room_replies
  where is_deleted = false
  group by entry_id
) counts
where entry.id = counts.entry_id;

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

drop trigger if exists goksorry_room_replies_refresh_entry_count on public.goksorry_room_replies;
create trigger goksorry_room_replies_refresh_entry_count
after insert or delete or update of entry_id, is_deleted on public.goksorry_room_replies
for each row
execute function public.goksorry_room_replies_refresh_entry_count();
