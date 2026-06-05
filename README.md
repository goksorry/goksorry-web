# goksorry-web

곡소리닷컴 웹 앱입니다. Next.js App Router 기반으로 피드, 게시판, 곡소리방, 관리자 화면, 공개 곡소리 지수 API, 정책 문서 화면을 제공합니다.

## 주요 기능

- 외부 투자 커뮤니티 감성 피드 `/`
- 자체 게시판 `/community`
- 곡소리방 `/goksorry-room`
- 공개 곡소리 지수 API `/api/overview`
- API 문서 `/docs`, `/docs.txt`, `/openapi.json`
- Google OAuth 로그인과 관리자 기능
- 최초 계정 생성 게이트 `/profile`
- 관리자 정책 문서 편집 `/admin/policies`

## 인증 모델

- 로그인은 NextAuth + Google OAuth를 사용합니다.
- Google 로그인 직후에는 세션만 생기고, `/profile`에서 `가입 완료`를 눌러야 실제 `profiles` 계정이 생성됩니다.
- `profile_setup_required = true` 상태에서는 아직 회원 가입이 완료되지 않은 상태입니다.
- 이 상태에서는 게시판 쓰기, 신고, 채팅 참여, 관리자 기능이 차단됩니다.
- 이 상태에서는 헤더의 `채팅` 탭과 우하단 채팅 독 버튼도 숨깁니다.
- 유저에게 제공되는 API 문서는 공개 곡소리 지수 endpoint 1개만 노출합니다.

## 쿠키 동의 / 브라우저 저장 규칙

- 모든 신규 쿠키, `localStorage` 기반 기능은 먼저 [`lib/persistence-registry.ts`](./lib/persistence-registry.ts)에 등록해야 합니다.
- 브라우저 저장 접근은 직접 `document.cookie` / `window.localStorage`를 쓰지 말고 [`lib/browser-persistence.ts`](./lib/browser-persistence.ts)를 통합니다.
- 카테고리는 `essential` 과 `analytics` 두 가지입니다.
- `essential` 에는 쿠키 동의 상태, 테마, 예쁜말 필터, 비회원 채팅 세션 및 닉네임, 곡소리방 비회원 작성자 세션 같은 서비스 동작용 저장이 들어갑니다.
- `analytics` 는 Google Analytics 같은 방문 통계용 저장만 사용하며, 이용자가 `모두 허용`을 선택한 경우에만 활성화합니다.
- 이용자에게 쿠키 선택을 다시 열어야 할 때는 [`components/cookie-consent-button.tsx`](./components/cookie-consent-button.tsx) 또는 [`components/cookie-consent-provider.tsx`](./components/cookie-consent-provider.tsx)의 `openConsentSettings`를 사용합니다.
- NextAuth가 관리하는 로그인/보안 쿠키는 필수 쿠키로 취급합니다.

## 테마

- 테마 선택은 `goksorry-theme` localStorage에 저장합니다.
- URL 쿼리 `?theme=vscode-dark`처럼 지정하면 저장값보다 우선 적용합니다.
- 모든 테마는 `light`, `dark`, `system` 톤을 지원합니다. `system`은 기기 다크/라이트 설정에 맞춰 같은 테마의 실제 톤을 적용합니다.
- 지원 테마는 `light`, `dark`, `system`, `excel-*`, `powerpoint-*`, `docs-*`, `vscode-*`, `jetbrains-*` 입니다.
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

## 운영 메모

- 외부 출처의 `robots.txt`를 다시 확인하면 [`components/site-footer.tsx`](./components/site-footer.tsx)의 출처 안내 확인 시각도 함께 갱신합니다.

## 성능 / 안정성 작업 메모

- 곡소리방 목록은 글 row와 `reply_count`를 먼저 가져오고, 덧글 본문은 사용자가 덧글 영역을 열 때 `/api/goksorry-room/replies`에서 lazy load합니다.
- `reply_count`는 Supabase trigger로 유지하며, 곡소리방 덧글 최대 길이는 160자입니다.
- 로그인 세션 안정성을 위해 NextAuth session cookie 감지는 chunked cookie(`next-auth.session-token.0`, `__Secure-next-auth.session-token.0`)까지 포함합니다.
- 데스크톱 채팅 사이드바와 모바일 채팅 독은 사용자가 열 때만 `LiveChat` 번들과 chat session/WebSocket 초기화를 시작합니다.
- 정책 변경 배너 조회는 60초 cache를 사용하고, 관리자 정책 저장 시 cache tag를 무효화합니다.

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

### Public Goksorry Index API

- `GET /api/overview`

메모:

- 유저에게 제공되는 공개 API는 이 endpoint 하나입니다.
- 응답은 `goksorry_index`, `generated_at`, `ttl_sec` 만 포함합니다.
- `goksorry_index`는 0..10 표시용 점수이며 높을수록 절망/곡소리입니다.
- 홈 화면과 내부 운영 route는 별도 내부 JSON 구조를 계속 사용합니다.
