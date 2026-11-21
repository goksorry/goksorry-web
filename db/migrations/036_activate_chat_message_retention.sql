-- The operator requested immediate publication of the scheduled chat revision.
do $release$
declare
  publication timestamptz := clock_timestamp();
  scheduled_id constant uuid := 'a29a5138-ad37-4011-8719-56bdf7585c49';
  immediate_id constant uuid := '86b56d03-b3f2-45e9-9f08-25bae3d7975e';
  scheduled public.policy_document_versions%rowtype;
begin
  if exists (select 1 from public.policy_document_versions where id = immediate_id) then
    return;
  end if;

  select * into scheduled
  from public.policy_document_versions
  where id = scheduled_id and type = 'privacy' and superseded_at is null
  for update;

  if scheduled.id is null then
    raise exception 'Missing scheduled chat retention revision';
  end if;

  if exists (
    select 1 from public.policy_document_versions
    where type = 'privacy' and superseded_at is null and published_at > scheduled.published_at
  ) then
    raise exception 'Unexpected newer privacy revision';
  end if;

  update public.policy_document_versions
  set superseded_at = publication
  where id = scheduled_id;

  insert into public.policy_document_versions
    (id, type, summary, body, is_adverse, published_at, effective_at, updated_at, created_at)
  values (
    immediate_id, 'privacy', '채팅 메시지 보관기간 7일 적용',
    scheduled.body, false, publication, publication, publication, publication
  );
end;
$release$;
