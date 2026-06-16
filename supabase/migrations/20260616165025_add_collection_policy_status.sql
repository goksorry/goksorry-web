alter table public.detector_status
  add column if not exists collection_policy jsonb default '{"sources":[]}'::jsonb;

update public.detector_status
set collection_policy = '{"sources":[]}'::jsonb
where collection_policy is null
  or jsonb_typeof(collection_policy) <> 'object';

alter table public.detector_status
  alter column collection_policy set default '{"sources":[]}'::jsonb,
  alter column collection_policy set not null;

alter table public.detector_status
  drop constraint if exists detector_status_collection_policy_object;

alter table public.detector_status
  add constraint detector_status_collection_policy_object
  check (jsonb_typeof(collection_policy) = 'object');
