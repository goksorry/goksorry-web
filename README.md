# goksorry-web

Next.js web service for goksorry.com.

## Features

- External sentiment feed (`/`)
- Ingest API (`POST /api/ingest`)
- Dedupe API for worker (`POST /api/sentiment/exists`)
- Google OAuth community (boards/posts/comments/reports)
- Admin reports (`/admin/reports`)

## Environment

Copy `.env.example` values into your deployment env.

Required:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `INGEST_TOKEN`
- `ADMIN_EMAIL`
- `DEFAULT_TIMEZONE` (optional, default `Asia/Seoul`)

## Local run

```bash
pnpm i
pnpm dev
```

## DB migration

Apply SQL in:

- `db/migrations/001_init.sql`
