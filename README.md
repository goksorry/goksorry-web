# goksorry-web

곡소리닷컴 웹 앱입니다. Next.js App Router 기반으로 피드, 커뮤니티, 관리자 화면, Trading Bot read API, 문서 화면을 제공합니다.

## 주요 기능

- 외부 투자 커뮤니티 감성 피드 `/`
- 자체 커뮤니티 `/community`
- Trading Bot read API `/api/v1/*`
- API 문서 `/docs`, `/docs.txt`, `/openapi.json`
- Google OAuth 로그인과 관리자 기능

## 인증 모델

- 로그인은 NextAuth + Google OAuth를 사용합니다.
- 브라우저 기반 토큰 요청/claim/revoke는 `/profile`에서 처리합니다.
- 일반 API 문서에는 브라우저 세션 전용 토큰 API를 노출하지 않습니다.
- Trading Bot read API는 member-issued token + `X-Client-Id` + `X-Request-Id`를 요구합니다.

## 광고 / CMP 메모

- AdSense 소유권 확인용 메타 태그와 `/ads.txt`는 코드에 연결돼 있습니다.
- 기본 퍼블리셔 계정은 `ca-pub-0419198986672065`입니다.
- Google CMP는 AdSense `Privacy & messaging`에서 `European regulations` 메시지를 생성하고 publish해야 실제로 뜹니다.
- 사이트 하단과 개인정보처리방침에는 동의 설정을 다시 여는 버튼이 준비돼 있습니다.
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

## 로컬 실행

```bash
npm install
npm run dev
```

기본 개발 주소는 `http://localhost:3000`입니다.

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
