# goksorry.com MVP + pierrotDetector

## 방향 (부담 낮은 구조)

- `web`이 단독 서비스로 동작하며 DB와 API를 제공한다.
- `worker`는 별도 시스템에서 실행되고, web API만 호출해 데이터 등록한다.
- TradingBot도 web API만 호출해 신호/시장 상태를 읽는다.

## Repo structure

- `web/` Next.js service (API provider)
- `worker/` standalone Python worker (API client)
- `db/` schema definitions

## DB schema (no migrations for now)

- Canonical schema file: `db/schema.sql`
- Keep schema evolving in this single file until service launch.
- If you are upgrading an existing deployed DB from the old Supabase Auth-coupled schema, run `db/migrations/003_nextauth_auth.sql` once before enabling NextAuth login.
- If you are upgrading an existing deployed DB to the nickname setup/cooldown policy, run `db/migrations/004_profile_nickname_policy.sql` once.

## API summary

### Detector write APIs (worker -> web)

- `POST /api/ingest`
- `POST /api/v1/detector/register`

Auth:

- `Authorization: Bearer <DETECTOR_WRITE_TOKEN>`

### TradingBot read APIs (bot -> web)

- `GET /api/v1/health`
- `GET /api/v1/signals/latest?market=kr|us|all&symbols=...&max_age_sec=...`
- `GET /api/v1/signals/{symbol}`
- `GET /api/v1/market/latest?market=kr|us|all`
- `GET /api/v1/status`

Read payload scope:

- These APIs expose `community-derived` market signals only.
- Official price/index/macro feeds are fetched separately by the bot when needed.
- `signals/latest` and `market/latest` summarize community sentiment for stocks and macro context.

Read auth headers:

- `Authorization: Bearer <member-issued trading bot token>`
- `X-Client-Id: trading-bot-{name}`
- `X-Request-Id: <uuid>`

### TradingBot token issuance API (member -> web)

- `GET /api/v1/tokens` (list own token requests/tokens)
- `POST /api/v1/tokens` (submit new token request)
- `POST /api/v1/tokens/{id}/claim` (reveal approved token value once)
- `POST /api/v1/tokens/{id}/revoke` (revoke)

Token workflow:

- Members request a TradingBot token from `내 프로필`.
- Each member can keep at most 3 non-revoked pending/approved token requests.
- Every new token request requires admin approval.
- Admin approves/rejects requests from `/admin/tokens`.
- Admin can manage member email/nickname/token state from `/admin/members`.
- After approval, the member reveals the actual token value once from `내 프로필`.
- Claimed token expiry is fixed to one year from claim time.

Auth for token issuance endpoints:

- NextAuth browser session cookie
- Same-origin browser request required (`Origin` / `Sec-Fetch-Site` validation)
- Responses use `Cache-Control: no-store`
- Request/claim/revoke are rate-limited per user

Auth session model:

- Login is handled by NextAuth (`next-auth`) with Google OAuth.
- Browser APIs rely on the NextAuth `HttpOnly` session cookie.
- Community/admin writes do not attach Supabase bearer tokens from the browser.

## Required env

### web (`web/.env.local`)

```bash
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
SUPABASE_SERVICE_ROLE_KEY=local-dev-service-role-key
NEXTAUTH_SECRET=local-dev-nextauth-secret
GOOGLE_CLIENT_ID=local-dev-google-client-id
GOOGLE_CLIENT_SECRET=local-dev-google-client-secret
DETECTOR_WRITE_TOKEN=local-dev-detector-token
ADMIN_EMAIL=admin@example.com
APP_VERSION=1.0.0
DEFAULT_TIMEZONE=Asia/Seoul
```

Local Next.js app origin is `http://localhost:3000`.
Google OAuth redirect target is handled by NextAuth under `/api/auth/*`.
Production canonical domain is `https://goksorry.com`.
Set the Vercel primary domain to the apex host, not `www.goksorry.com`, so detector API clients do not lose `Authorization` on cross-host redirects.

### worker (`worker/.env`)

```bash
GEMINI_BACKEND=developer
GEMINI_API_KEY=
DETECTOR_WRITE_TOKEN=
GOKSORRY_BASE_URL=https://goksorry.com
DEFAULT_TIMEZONE=Asia/Seoul
```

## Run web

```bash
cd web
pnpm i
pnpm dev
```

## Run worker

```bash
cd worker
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m pierrot_detector run_once
```

## Cron (every 5 minutes)

```cron
*/5 * * * * cd /home/jujin/workspace/projects/goksorry/worker && . .venv/bin/activate && python -m pierrot_detector run_once >> /home/jujin/workspace/projects/goksorry/worker/worker.log 2>&1
```

## Security tip

Generate detector write token:

```bash
openssl rand -hex 32
```

## Notes

- LLM model is fixed to `gemini-2.5-flash-lite`.
- Dedupe is done locally before LLM calls via `.queue/processed_post_keys.txt` to reduce worker -> web traffic.
- Worker also sends aggregated symbol signals/market status via `/api/v1/detector/register`.
- TradingBot token values are stored hashed in DB (`api_access_tokens.token_hash`).
- Security headers and CSP are applied via `web/middleware.ts`.
- The app redirects `www.goksorry.com` to `goksorry.com` at the edge to keep a single canonical host.
- Community profile rows are app-managed and no longer depend on `auth.users`.
