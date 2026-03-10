alter table public.profiles
  drop constraint if exists profiles_id_fkey;

alter table public.profiles
  alter column id set default gen_random_uuid();

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

