# AGEMTS.md (project: web)

## Stack
- Next.js (App Router)
- Supabase (Postgres)
- NextAuth (Google OAuth)
- Deploy target assumption: Vercel

## Required Environment Variables
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only)
- `NEXTAUTH_SECRET` (server-only)
- `GOOGLE_CLIENT_ID` (server-only)
- `GOOGLE_CLIENT_SECRET` (server-only)
- `DETECTOR_WRITE_TOKEN` (server-only)
- `ADMIN_EMAIL` (server-only)
- `DEFAULT_TIMEZONE` (optional, default `Asia/Seoul`)

## Responsibilities
- Public sentiment feed (`/`)
- Community MVP (Google OAuth only)
- Worker integration APIs:
  - `POST /api/ingest` (idempotent upsert)
  - `POST /api/v1/detector/register` (aggregated snapshot)
- TradingBot read APIs (`/api/v1/*`)
- Member-issued TradingBot token APIs (`/api/v1/tokens*`)

## Security Rules
- Never use anon key for privileged DB writes.
- Detector write APIs must return `401` when token is missing/invalid.
- TradingBot read token is member-issued and DB-backed (not env static token).
- Community input must be plain text only.
