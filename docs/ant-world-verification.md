# 개미 월드 로컬 검증

2026-11-15 KST. 운영 DB와 배포 환경을 변경하지 않고 확인했습니다.

## 통과한 검사

| 검사 | 결과 | 범위 |
| --- | --- | --- |
| `npm run build` (`.env.example`) | 통과 | Next.js 14.2.35 최적화 빌드·타입 검사, 새 API 경로 포함 |
| `npx tsc --noEmit` | 통과 | 서버·클라이언트·검사 코드 |
| 기본 Playwright, Chromium, 개발 서버 | 81 통과 / 2 제외 | 기존 지수 산식·공개 API 계약·테마·피드·인증 UI·곡소리방 회귀와 월드 검사 |
| 월드 Playwright, Chromium·Firefox, 최적화 빌드 | 30 통과 | 네 장면, 근거·예쁜말, 아바타, 테마 메뉴와 Escape, 모바일 시트, 극장 날짜·재생·누락, 실제 PNG 다운로드, 공유 링크, 장애·정적 모드·숨김 탭 |
| 독립 월드 API 검사, 기존 서버 없이 시작 | 6 통과 | 테스트 설정이 자체 백엔드·Next 서버를 시작·종료하는 경로까지 확인 |
| PostgreSQL 18 임시 클러스터 | 통과 | 마이그레이션 실행, 버킷 제약, 같은 버킷 upsert, 7일 삭제, RLS, anon 조회 거부, service_role 쓰기. 트랜잭션 롤백 후 클러스터 종료 |
| SQL 3곳 동기화·`git diff --check` | 통과 | CLI 마이그레이션 = 번호 이력, 기준 스키마 포함 |

기본 Playwright에서 제외한 2개는 `CHAT_LAYOUT_ENABLED` 환경 플래그가 필요한 채팅 사이드바·모바일 독 검사입니다. 기본 검사에서는 별도 백엔드가 필요한 `world-api.spec.ts`를 제외하고 월드 설정에서 실행합니다.

월드 API 검사는 실제 Next 경로와 Supabase 클라이언트를 거쳐 테스트 PostgREST 응답 서버를 사용합니다. 620건의 두 페이지 집계, 다음 페이지 종목의 상위 진입, 방문자 GET의 무기록, register 인증, 중복 upsert, 저장 실패 후 수집 성공, 날짜 검증·조회 장애를 확인했습니다. 실제 운영 Supabase나 LLM을 호출하지 않습니다. 시장 개요의 기존 네이버 조회 경로는 재사용합니다.

## 최대 개체 상태

최적화 빌드에서 3초간 requestAnimationFrame 간격을 측정했습니다. 아래 수치는 실물 화면의 프레임 출력이나 Core Web Vitals 측정과 구분합니다.

| 브라우저 | viewport | 개미 수 (내 아바타 포함) | 관측 cadence |
| --- | --- | --- | --- |
| Chromium | 1440×1000 | 48 | 약 60fps |
| Chromium | 390×844 | 24 | 약 60fps |
| Firefox | 1440×1000 | 48 | 약 60fps |
| Firefox | 390×844 | 24 | 약 60fps |

검사는 데스크톱 55fps 이상, 모바일 크기 viewport 30fps 이상을 검사하며 목표치는 각각 60fps·30fps입니다. 각 실행 결과는 `test-results/.../world-frame-cadence.json`에 기록합니다. 실제 모바일 기기·Lighthouse·운영 트래픽은 이번 측정 범위에 포함하지 않았습니다.

## 재현

기본 기능 검사: `npx playwright test --workers=2`.

독립 월드 검사: `npm run test:world`. 이 설정은 포트 3100·3101에서 테스트용 백엔드와 명시적인 로컬 환경 변수를 사용하는 Next 서버를 시작합니다. 포트를 이미 사용 중이면 검사를 시작하지 않으므로 기존 서버를 먼저 종료해야 합니다. 검증용 서버를 직접 준비한 경우에만 `WORLD_TEST_REUSE_SERVER=1`로 재사용할 수 있습니다. 이번 최적화 빌드 검사는 `next start`를 준비한 후 이 방식으로 실행했습니다.

이 호스트의 Ubuntu 26.04는 설치된 Playwright의 플랫폼 표에 없어서 `PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-x64`로 호환 브라우저 빌드를 설치·실행했습니다.

기존 로그인·곡소리방 검사의 일부는 클라이언트 API를 모의 응답으로 바꾸는 검사입니다. 최적화 빌드에서는 서버 초기 데이터가 이미 주입되어 이 모의 응답을 사용하지 않으므로 전체 기존 회귀는 개발 서버 기준으로 확인했습니다. 최적화 빌드의 월드 검사는 별도로 모두 통과했습니다. 실제 Google OAuth 왕복·운영 수집 워커 실행·운영 DB 적용·배포는 검증하지 않았습니다.

## 운영 적용 경계

적용할 변경은 `supabase/migrations/20261114171745_world_snapshots.sql`입니다. `db/migrations/026_world_snapshots.sql`, `db/schema.sql`에 같은 정의를 반영했습니다. 원격 적용 전 `npx supabase db push --workdir . --dry-run`으로 대상 목록을 확인합니다. 기록은 적용 후 첫 수집 완료 register부터 쌓이며 도입 전·누락 구간은 빈 상태로 유지합니다.
