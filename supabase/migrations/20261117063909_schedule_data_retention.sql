create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

-- Independent of logins, requests, worker availability and successful ingest.
select cron.schedule('goksorry-data-retention', '*/10 * * * *',
  'select goksorry_private.run_data_retention();');
select cron.schedule('goksorry-retention-history', '17 3 * * *',
  $job$delete from cron.job_run_details
    where end_time < now() - interval '7 days'
      and jobid in (select jobid from cron.job where jobname in
        ('goksorry-data-retention', 'goksorry-retention-history'));$job$);
