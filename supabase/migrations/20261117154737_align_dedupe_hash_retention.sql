-- Align URL-hash dedupe with the existing 24-hour title/link retention window.
-- Only the privacy document changes; source bodies remain transient and numeric
-- aggregates/title-delivery retries still expire after six hours.
do $release$
declare
  publication timestamptz := now();
  previous public.policy_document_versions%rowtype;
  old_text text := '중복 분석 방지용으로 원문 주소 등을 일방향 해시로 변환한 값은 로컬에서 기본 6시간 사용합니다.';
  new_text text := '중복 분석 방지용으로 원문 주소 등을 일방향 해시로 변환한 값은 로컬에서 24시간 사용합니다.';
begin
  if exists(select 1 from public.policy_document_versions
    where type='privacy' and superseded_at is null and effective_at>publication) then
    raise exception 'Unexpected pending privacy document';
  end if;
  select * into previous from public.policy_document_versions
    where type='privacy' and superseded_at is null and published_at<=publication and effective_at<=publication
    order by effective_at desc,published_at desc limit 1;
  if previous.id is null then raise exception 'Missing current privacy document'; end if;
  if position(new_text in previous.body)>0 then return; end if;
  if position(old_text in previous.body)=0 then raise exception 'Unexpected dedupe retention wording'; end if;
  insert into public.policy_document_versions
    (type,summary,body,is_adverse,published_at,effective_at,updated_at,created_at)
  values ('privacy','중복 분석 방지용 URL 해시의 24시간 보관 안내',
    replace(previous.body,old_text,new_text),false,publication,publication,publication,publication);
end;
$release$;
