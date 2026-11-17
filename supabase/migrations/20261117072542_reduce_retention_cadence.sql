-- pg_cron uses GMT in this project: 18:00/06:00 UTC = 03:00/15:00 KST.
-- Skip only on disposable local databases without pg_cron.
do $schedule$
begin
  if to_regclass('cron.job') is not null then
    if coalesce(current_setting('cron.timezone', true), 'GMT') not in ('GMT', 'UTC') then
      raise exception 'Unexpected cron timezone; review the KST schedule';
    end if;
    perform cron.alter_job(job_id := (select jobid from cron.job where jobname='goksorry-data-retention'),
      schedule := '0 6,18 * * *');
  end if;
end;
$schedule$;

-- Preserve the previous published draft in history; publish the revised cadence.
do $release$
declare
  publication timestamptz := now();
  effective timestamptz;
  revised_body text;
begin
  if exists(select 1 from public.policy_document_versions where id='b782af64-6e13-4a1a-a38d-60ba8f48a9a2') then return; end if;
  if exists(select 1 from public.policy_document_versions where type='privacy' and superseded_at is null
    and effective_at>publication and id<>'59c66f82-6df5-4f93-910b-52ff364bd4a5') then
    raise exception 'Unexpected pending privacy policy; reconcile before publishing';
  end if;
  select body, greatest(effective_at,
    date_trunc('day', timezone('Asia/Seoul', publication)+interval '8 days') at time zone 'Asia/Seoul')
    into revised_body, effective from public.policy_document_versions
    where id='59c66f82-6df5-4f93-910b-52ff364bd4a5';
  if revised_body is null then raise exception 'Missing previous retention policy'; end if;
  revised_body := replace(revised_body,'로그인·수집 여부와 무관하게 10분 주기로 만료 기록을 정리하며,',
    '로그인·수집 여부와 무관하게 하루 2회(한국시간 03시·15시) 만료 기록을 정리하며,');
  revised_body := replace(revised_body,'정상 운영 시 만료 후 다음 정리 주기에 삭제되며,',
    '정상 운영 시 만료 후 다음 정리 시점에 삭제되므로 약 12시간 이내의 정리 시차가 생길 수 있으며,');
  revised_body := replace(revised_body,'10분 주기 자동 정리를 적용합니다.',
    '하루 2회(한국시간 03시·15시) 자동 정리를 적용합니다. 보유기간이 지난 자료는 다음 정리 시점에 삭제합니다.');
  update public.policy_document_versions set superseded_at=publication
    where id='59c66f82-6df5-4f93-910b-52ff364bd4a5' and effective_at>publication and superseded_at is null;
  insert into public.policy_document_versions(id,type,summary,body,is_adverse,published_at,effective_at,updated_at,created_at)
    values ('b782af64-6e13-4a1a-a38d-60ba8f48a9a2','privacy','만료 데이터 정리를 하루 2회로 조정하고 정리 시차 안내',
      revised_body,true,publication,effective,publication,publication);
end;
$release$;
