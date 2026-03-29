# AGENTS.md (project: goksorry-web)

## Stack
- Next.js (App Router)
- Supabase (Postgres)
- NextAuth (Google OAuth)
- Supabase CLI for migration workflow
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
- `APP_VERSION` (optional)
- `NEXT_PUBLIC_GOOGLE_ADSENSE_ACCOUNT` (optional)
- `GOOGLE_ADSENSE_ADS_TXT` (optional)
- `CHAT_TOKEN_SECRET` (optional)
- `CHAT_WS_BASE_URL` (optional)

## Responsibilities
- Public sentiment feed (`/`)
- Community MVP (Google OAuth only)
- Account creation gate at `/profile`
- Editable legal documents via admin (`/admin/policies`)
- Worker integration APIs:
  - `POST /api/ingest` (idempotent upsert)
  - `POST /api/v1/detector/register` (aggregated snapshot)
- TradingBot read APIs (`/api/v1/*`)
- Member-issued TradingBot token APIs (`/api/v1/tokens*`)

## Auth and Profile Setup Model
- Google login creates an authenticated session first.
- A `profiles` row is created only after the user completes `/profile` and presses `가입 완료`.
- While `profile_setup_required = true`, the user is authenticated but not a completed member.
- In that setup-required state, community write actions, chat participation, token flows, and admin features must stay blocked.
- In that setup-required state, the chat nav link and chat dock should stay hidden.

## Policy Documents
- Terms and privacy documents are stored in `public.policy_document_versions`.
- Public pages `/terms` and `/privacy` render the current effective DB-backed version.
- Admin editing happens in `/admin/policies`.
- If `is_adverse = true`, the new version should be stored as pending for 7 days before taking effect.

## Database Workflow
- Use Supabase CLI from the repo root with `npx supabase ... --workdir .`.
- Linked project ref: `oldbntwoxhtaehpirepn`.
- Use `supabase/migrations` as the primary CLI migration path.
- Mirror durable repo-facing SQL history in `db/migrations`.
- Keep `db/schema.sql` aligned when migrations change long-lived schema or seeded bootstrap content.

## Skills
- `goksorry-web-supabase` — Project-specific Supabase CLI workflow for this repository. (file: `/home/jujin/workspace/projects/goksorry/goksorry-web/.codex/skills/goksorry-web-supabase/SKILL.md`)

## How to use skills
- Use `goksorry-web-supabase` for Supabase CLI setup/linking, migration creation or application, `db/schema.sql` sync, legal document seed changes, and deployment prep that depends on Supabase state.
- Open the skill's `SKILL.md` first and load extra files only when needed.
- Resolve relative skill paths from the skill directory before searching elsewhere.
- Keep `goksorry-web`-specific skill changes in this repository instead of editing `~/.codex/skills`, unless the user explicitly asks for a global change.

## Security Rules
- Never use anon key for privileged DB writes.
- Detector write APIs must return `401` when token is missing/invalid.
- TradingBot read token is member-issued and DB-backed (not env static token).
- TradingBot read APIs expose community-derived signals only; official price/index feeds are fetched separately by the bot.
- TradingBot token requests require admin approval before the user can claim the token from `내 프로필`.
- Community input must be plain text only.
