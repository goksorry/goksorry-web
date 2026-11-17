-- One-time initial publication requested by the operator on 2026-11-17:
-- no existing service users. Preserve the scheduled versions and their dates;
-- publish identical text now. Future adverse-change notice rules are unchanged.
do $release$
declare
  publication timestamptz := now();
  scheduled_ids uuid[] := array[
    '43f021b5-8e72-413a-91cf-e581b4f56e6c'::uuid,
    '8427c609-610d-49f1-9ca4-380f6137cf56'::uuid
  ];
  release_summary text := '공개 제목·원문 링크 처리 및 보유기간 안내 — 즉시 시행';
  pending_count integer;
begin
  select count(*) into pending_count from public.policy_document_versions
    where id = any(scheduled_ids) and superseded_at is null and effective_at > publication;

  if pending_count = 0 and (
    select count(distinct type) from public.policy_document_versions
    where summary = release_summary and effective_at = published_at
  ) = 2 then
    return;
  end if;

  if pending_count <> 2 or exists (
    select 1 from public.policy_document_versions
    where superseded_at is null and effective_at > publication
      and not (id = any(scheduled_ids))
  ) then
    raise exception 'Expected only the two reviewed pending legal documents';
  end if;

  update public.policy_document_versions set superseded_at = publication
    where id = any(scheduled_ids);

  insert into public.policy_document_versions
    (type, summary, body, is_adverse, published_at, effective_at, updated_at, created_at)
  select type, release_summary, body, false, publication, publication, publication, publication
    from public.policy_document_versions where id = any(scheduled_ids);
end;
$release$;
