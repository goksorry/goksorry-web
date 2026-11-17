# Data retention

DB: pg_cron runs `goksorry_private.run_data_retention()` every ten minutes, independent of traffic and ingest. External posts and linked sentiment, reports, snapshots, withdrawn identifiers, and expired/revoked token rows expire after seven days. Active member/guest posts remain until deletion. Deleted posts and replies are physically removed, including dependent comments. Source previews are cleared and a constraint prevents future body storage.

The cleanup function uses invoker rights in a non-exposed schema; no public or service-role RPC access. Check `goksorry_private.retention_status`, `cron.job` and `cron.job_run_details` with a privileged connection. Investigate failed runs or a last-success age above 20 minutes. Cron history expires after seven days. This change adds no alert delivery service.

Chat: at most 30 messages younger than 24 hours. Durable alarms expire idle history. `/admin/chat` lists/deletes messages via administrator-only routes and 60-second action-bound server tokens. Reconnect replaces history. No member IDs are stored in messages; account withdrawal still does not auto-delete chat.

Worker: independent cleanup cron plus cleanup before collection, under the shared lock. Pending defaults to six hours; retries, dedupe, backups, scan reports and inactive logs expire after seven days. Daily logs replace the old append-only log. A stopped machine cleans up after restart.

Privacy revision `59c66f82-6df5-4f93-910b-52ff364bd4a5` replaces the previously pending privacy revision, preserving history. Intended effective time: 2026-11-25 00:00 Asia/Seoul; migration preserves at least seven full days of notice if applied later. Pending terms remain unchanged.

GA retention and provider backups/logs remain unverified. Application deletion is not proof of immediate erasure of provider recovery copies or prior AI inputs.

Validation: disposable PostgreSQL retention/cascade/permission tests, Python unit tests, workerd alarm/restart/auth tests, Next.js build and policy browser tests. Never run fixtures against production.
