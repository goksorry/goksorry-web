# goksorry-web

곡소리닷컴 웹 앱입니다. Next.js App Router 기반으로 피드, 커뮤니티, 관리자 화면, Trading Bot read API, 정책 문서 화면을 제공합니다.

## 주요 기능

- 외부 투자 커뮤니티 감성 피드 `/`
- 자체 커뮤니티 `/community`
- Trading Bot read API `/api/v1/*`
- API 문서 `/docs`, `/docs.txt`, `/openapi.json`
- Google OAuth 로그인과 관리자 기능
- 최초 계정 생성 게이트 `/profile`
- 관리자 정책 문서 편집 `/admin/policies`

## 인증 모델

- 로그인은 NextAuth + Google OAuth를 사용합니다.
- Google 로그인 직후에는 세션만 생기고, `/profile`에서 `가입 완료`를 눌러야 실제 `profiles` 계정이 생성됩니다.
- `profile_setup_required = true` 상태에서는 아직 회원 가입이 완료되지 않은 상태입니다.
- 이 상태에서는 커뮤니티 쓰기, 신고, 채팅 참여, Trading Bot 토큰 기능, 관리자 기능이 차단됩니다.
- 이 상태에서는 헤더의 `채팅` 탭과 우하단 채팅 독 버튼도 숨깁니다.
- 브라우저 기반 토큰 요청/claim/revoke는 `/profile`에서 처리합니다.
- 일반 API 문서에는 브라우저 세션 전용 토큰 API를 노출하지 않습니다.
- Trading Bot read API는 member-issued token + `X-Client-Id` + `X-Request-Id`를 요구합니다.

## 광고 / CMP 메모

- AdSense 소유권 확인용 메타 태그와 `/ads.txt`는 코드에 연결돼 있습니다.
- 기본 퍼블리셔 계정은 `ca-pub-0419198986672065`입니다.
- Google CMP는 AdSense `Privacy & messaging`에서 `European regulations` 메시지를 생성하고 publish해야 실제로 뜹니다.
- 현재 사이트 하단이나 개인정보처리방침에 별도 동의 설정 재오픈 버튼은 노출하지 않습니다.
- `robots.txt`는 `/community`, `/community/`, `/ads.txt`만 허용합니다.

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
- `NEXT_PUBLIC_GOOGLE_ADSENSE_ACCOUNT`
- `GOOGLE_ADSENSE_ADS_TXT`
- `CHAT_TOKEN_SECRET`
- `CHAT_WS_BASE_URL`

## 로컬 실행

```bash
npm install
npm run dev
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
- 메시지는 영구 저장하지 않고 최근 20개만 유지하는 전제입니다.

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

- 홈 상단 `실시간 체감 지수` 점수 옆 토글 버튼은 같은 `market_adjustment` 쿼리를 사용합니다.
- 마지막 토글 상태는 쿠키로 저장되며, 홈에 재진입할 때 쿼리가 없으면 마지막 `off` 상태를 URL로 복원합니다.
- 점수는 홈에서 실제로 보이는 `공포/희망` 샘플 기준으로 계산합니다.
- 시장 보정은 연속형 로그 곡선으로 계산하며, 장중 실시간 지수 변화율을 점수에 가감합니다.
- 일반 커뮤니티는 시간대에 따라 한국 장중에는 `KOSPI 55% + KOSDAQ 45%`, 미국 정규장에는 `NASDAQ` 를 참고합니다.
- 디시는 시간대가 아니라 갤러리 주제 기준으로 참조 시장을 고정합니다.
  - `dc_stock`, `dc_krstock` → 한국 시장
  - `dc_usstock`, `dc_tenbagger` → 미국 시장
- 응답에는 `market_adjustment_enabled`, `overall_base_score`, `overall_market_adjustment` 와 각 섹션별 `base_score`, `market_adjustment` 가 함께 포함됩니다.
