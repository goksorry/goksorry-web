# goksorry-web

곡소리닷컴 웹 앱입니다. Next.js App Router 기반으로 피드, 게시판, 곡소리방, 관리자 화면, Trading Bot read API, 정책 문서 화면을 제공합니다.

## 주요 기능

- 외부 투자 커뮤니티 감성 피드 `/`
- 자체 게시판 `/community`
- 곡소리방 `/goksorry-room`
- Trading Bot read API `/api/v1/*`
- API 문서 `/docs`, `/docs.txt`, `/openapi.json`
- Google OAuth 로그인과 관리자 기능
- 최초 계정 생성 게이트 `/profile`
- 관리자 정책 문서 편집 `/admin/policies`

## 인증 모델

- 로그인은 NextAuth + Google OAuth를 사용합니다.
- Google 로그인 직후에는 세션만 생기고, `/profile`에서 `가입 완료`를 눌러야 실제 `profiles` 계정이 생성됩니다.
- `profile_setup_required = true` 상태에서는 아직 회원 가입이 완료되지 않은 상태입니다.
- 이 상태에서는 게시판 쓰기, 신고, 채팅 참여, Trading Bot 토큰 기능, 관리자 기능이 차단됩니다.
- 이 상태에서는 헤더의 `채팅` 탭과 우하단 채팅 독 버튼도 숨깁니다.
- 브라우저 기반 토큰 요청/claim/revoke는 `/profile`에서 처리합니다.
- 일반 API 문서에는 브라우저 세션 전용 토큰 API를 노출하지 않습니다.
- Trading Bot read API는 member-issued token + `X-Client-Id` + `X-Request-Id`를 요구합니다.

## 쿠키 동의 / 브라우저 저장 규칙

- 모든 신규 쿠키, `localStorage` 기반 기능은 먼저 [`lib/persistence-registry.ts`](./lib/persistence-registry.ts)에 등록해야 합니다.
- 브라우저 저장 접근은 직접 `document.cookie` / `window.localStorage`를 쓰지 말고 [`lib/browser-persistence.ts`](./lib/browser-persistence.ts)를 통합니다.
- 카테고리는 `essential` 과 `analytics` 두 가지입니다.
- `essential` 에는 쿠키 동의 상태, 테마, 예쁜말 필터, 홈 시장 보정, 비회원 채팅 세션 및 닉네임, 곡소리방 비회원 작성자 세션 같은 서비스 동작용 저장이 들어갑니다.
- `analytics` 는 Google Analytics 같은 방문 통계용 저장만 사용하며, 이용자가 `모두 허용`을 선택한 경우에만 활성화합니다.
- 이용자에게 쿠키 선택을 다시 열어야 할 때는 [`components/cookie-consent-button.tsx`](./components/cookie-consent-button.tsx) 또는 [`components/cookie-consent-provider.tsx`](./components/cookie-consent-provider.tsx)의 `openConsentSettings`를 사용합니다.
- NextAuth가 관리하는 로그인/보안 쿠키는 필수 쿠키로 취급합니다.

## 테마

- 테마 선택은 `goksorry-theme` localStorage에 저장합니다.
- URL 쿼리 `?theme=vscode-dark`처럼 지정하면 저장값보다 우선 적용합니다.
- 모든 테마는 `light`, `dark`, `system` 톤을 지원합니다. `system`은 기기 다크/라이트 설정에 맞춰 같은 테마의 실제 톤을 적용합니다.
- 지원 테마는 `light`, `dark`, `system`, `excel-*`, `powerpoint-*`, `docs-*`, `vscode-*`, `jetbrains-*`, `vs-*` 입니다.
- 기본 테마는 기존 사이트 레이아웃을 유지하고, 컨셉 테마는 기존 헤더를 각 프로그램형 shell 헤더로 대체합니다.

## 환경 변수

기본 예시는 [`.env.example`](./.env.example) 에 있습니다.

필수:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXTAUTH_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `DETECTOR_WRITE_TOKEN`
- `ADMIN_EMAIL`

선택:

- `APP_VERSION`
- `DEFAULT_TIMEZONE`
- `CHAT_TOKEN_SECRET`
- `CHAT_WS_BASE_URL`

## 로컬 실행

```bash
npm install
npm run dev
npm run test:e2e
```

기본 개발 주소는 `http://localhost:3000`입니다.

## DB / Migration Workflow

- Supabase CLI를 사용합니다.
- 기본 작업 디렉터리는 repo root 기준 `npx supabase ... --workdir .` 입니다.
- 링크된 프로젝트 ref는 `oldbntwoxhtaehpirepn` 입니다.
- CLI 적용 경로는 `supabase/migrations` 입니다.
- 리포의 숫자 기반 SQL 히스토리는 `db/migrations` 에 함께 유지합니다.
- 장기 스키마 기준 파일은 `db/schema.sql` 입니다.

## 실시간 채팅 메모

- 채팅 UI는 `/chat` 입니다.
- 웹 앱은 `POST /api/chat/session` 에서 member/guest 세션을 발급합니다.
- 계정 생성 전 상태(`profile_setup_required = true`)에서는 채팅 진입 UI를 숨깁니다.
- 실시간 WebSocket 허브는 별도 Cloudflare Worker/Durable Object를 전제로 합니다.
- 메시지는 영구 저장하지 않고 최근 30개만 유지하는 전제입니다.

## API 요약

### Detector write API

- `POST /api/ingest`
- `POST /api/v1/detector/register`

### Trading Bot read API

- `GET /api/v1/health`
- `GET /api/v1/signals/latest`
- `GET /api/v1/signals/{symbol}`
- `GET /api/v1/market/latest`
- `GET /api/v1/status`

메모:

- 이 API는 `community-derived` 신호만 제공합니다.
- 공식 가격, 지수, 매크로 데이터는 별도 수집 대상입니다.

### Home Overview API

- `GET /api/community-indicators`
- `GET /api/overview`
- 선택 쿼리: `market_adjustment=on|off`
- 기본값은 `on` 입니다. `off`, `false`, `0` 도 비활성화로 해석합니다.

메모:

- 홈 상단 `곡소리 지수` 점수 옆 토글 버튼은 같은 `market_adjustment` 쿼리를 사용합니다.
- 마지막 토글 상태는 쿠키로 저장되며, 홈에 재진입할 때 쿼리가 없으면 마지막 `off` 상태를 URL로 복원합니다.
- 홈에서 크게 보이는 `곡소리 지수`는 높을수록 절망/곡소리, 낮을수록 희망을 뜻하는 표시용 반전 점수입니다.
- 응답의 `overall_sentiment_score`, `base_score`, `score` 는 내부 원감성 점수이며 `1..10` 에서 높을수록 희망입니다.
- 응답의 `overall_goksorry_index`, `goksorry_index` 는 홈 표시용 곡소리 지수이며 `0..10` 에서 높을수록 절망입니다.
- 시장 보정은 연속형 로그 곡선으로 계산하며, 소스 성격에 따라 `시장전체 / 국장 / 나스닥` 중 하나를 참조합니다.
- `국장` 보정은 `KOSPI 55% + KOSDAQ 45%`에 `원/달러 환율` 리스크를 함께 반영합니다.
- `시장전체` 보정은 `국장 보정 + NASDAQ` 혼합값을 사용합니다.
- 소스별 기본 매핑:
  - `blind_stock_invest` → 시장전체
  - `dc_stock`, `dc_krstock`, `ppomppu_stock` → 국장
  - `dc_usstock`, `dc_tenbagger` → 나스닥
  - `toss_stock_community_*` → 종목 시장(`KR/US`) 기준
  - `toss_lounge_kr_*` → 국장
  - `toss_lounge_us_*` → 나스닥
  - 그 외 `toss_lounge_*` → 시장전체
- 응답에는 `market_adjustment_enabled`, `overall_base_score`, `overall_market_adjustment`, `overall_sentiment_score`, `overall_goksorry_index` 와 각 섹션별 `base_score`, `market_adjustment`, `score`, `goksorry_index` 가 함께 포함됩니다.
