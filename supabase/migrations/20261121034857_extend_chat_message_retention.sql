-- Publish advance notice of the longer chat retention period.
do $release$
declare
  publication timestamptz := now();
  revision_id constant uuid := 'a29a5138-ad37-4011-8719-56bdf7585c49';
  previous_body text;
  old_text constant text := '채팅 메시지는 전송 후 24시간 이내의 최근 30건까지 보관합니다.';
  new_text constant text := '채팅 메시지는 전송 후 7일 이내의 최근 30건까지 보관합니다.';
begin
  if exists (select 1 from public.policy_document_versions where id = revision_id) then
    return;
  end if;

  if exists (
    select 1 from public.policy_document_versions
    where type = 'privacy' and superseded_at is null and effective_at > publication
  ) then
    raise exception 'Unexpected pending privacy document';
  end if;

  select body into previous_body
  from public.policy_document_versions
  where type = 'privacy' and superseded_at is null
    and published_at <= publication and effective_at <= publication
  order by effective_at desc, published_at desc
  limit 1;

  if previous_body is null then
    raise exception 'Missing current privacy document';
  end if;
  if position(new_text in previous_body) > 0 then
    return;
  end if;
  if position(old_text in previous_body) = 0 then
    raise exception 'Unexpected chat retention wording';
  end if;

  insert into public.policy_document_versions
    (id, type, summary, body, is_adverse, published_at, effective_at, updated_at, created_at)
  values (
    revision_id, 'privacy', '채팅 메시지 보관기간을 24시간에서 7일로 연장',
    replace(previous_body, old_text, new_text), true,
    publication, publication + interval '168 hours', publication, publication
  );
end;
$release$;
