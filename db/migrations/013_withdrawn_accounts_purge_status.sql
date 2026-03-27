alter table public.detector_status
  add column if not exists withdrawn_accounts_purged_at timestamptz;
