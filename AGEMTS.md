# AGEMTS.md (project: web)

## Stack
- Next.js (App Router)
- Supabase (Postgres/Auth)
- Deploy target assumption: Vercel

## Required Environment Variables
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only)
- `INGEST_TOKEN` (server-only)
- `ADMIN_EMAIL` (server-only)
- `DEFAULT_TIMEZONE` (optional, default `Asia/Seoul`)

## Responsibilities
- Public sentiment feed (`/`)
- Community MVP (Google OAuth only)
- Worker integration APIs:
  - `POST /api/sentiment/exists` (dedupe lookup)
  - `POST /api/ingest` (idempotent upsert)

## Security Rules
- Never use anon key for privileged DB writes.
- Ingest API must return `401` when token is missing/invalid.
- Community input must be plain text only.
