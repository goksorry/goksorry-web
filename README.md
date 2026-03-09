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

Read auth headers:

- `Authorization: Bearer <member-issued trading bot token>`
- `X-Client-Id: trading-bot-{name}`
- `X-Request-Id: <uuid>`

### TradingBot token issuance API (member -> web)

- `GET /api/v1/tokens` (list own tokens)
- `POST /api/v1/tokens` (issue new token)
- `POST /api/v1/tokens/{id}/revoke` (revoke)

Auth for token issuance endpoints:

- Supabase user access token (`Authorization: Bearer <user_access_token>`)
- Same-origin browser request required (`Origin` / `Sec-Fetch-Site` validation)
- Responses use `Cache-Control: no-store`
- Issue/revoke are rate-limited per user

Auth session model:

- Browser APIs use server-issued `HttpOnly` session cookie (`gks_session`).
- Client-side components no longer attach bearer access tokens for normal community/admin writes.

## Required env

### web (`web/.env.local`)

```bash
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=local-dev-anon-key
SUPABASE_SERVICE_ROLE_KEY=local-dev-service-role-key
DETECTOR_WRITE_TOKEN=local-dev-detector-token
ADMIN_EMAIL=admin@example.com
APP_VERSION=1.0.0
DEFAULT_TIMEZONE=Asia/Seoul
```

Local Next.js app origin is `http://localhost:3000`.
No separate app base URL env is used by the current code.
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
