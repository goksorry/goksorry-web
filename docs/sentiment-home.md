# 메타버스 홈과 피드

홈의 중심은 기존 5단계 한국 주식 삐에로 밈과 개미 메타버스다. 광장·종목 개미굴·심리 전장·커뮤니티 재난방송·개미극장을 유지한다. 개미 이동·색상·감정 표현·기본 무음 효과음, 극장 날짜 탐색·재생·PNG·링크 공유도 유지한다. `/analysis`는 query string을 보존해 홈으로 307 이동한다.

## 캐릭터 원본

- `public/images/overview-regimes/overview-regime-{extreme-bullish,bullish,neutral,bearish,extreme-bearish}-{light,dark}.webp`가 캐릭터 소스다. 원본 10개 파일의 바이트, 얼굴, 의상, 구도는 수정하지 않는다.
- 기존 지수 단계 함수로 이미지를 선택한다. 소표본은 중립 원본과 `표본 부족` 상태로 표시한다. 극장에서는 현재 실시간 지수가 아닌 재생 중인 저장 프레임의 지수를 따른다.
- 원본을 월드의 HTML 무대 화면과 저장 PNG에 그대로 사용한다. 새 픽셀 삐에로 SVG와 별도 생성 앵커는 홈에서 사용하지 않는다. 원본 기반 3D 캐릭터 모델/리깅을 새로 제작한 것은 아니다.
- 배경과 개미는 기존 Three.js HD-2D 월드다. reduced-motion과 WebGL 실패에는 정적 장면, 숨김 탭에는 렌더·갱신 정지가 적용된다.
- 모바일은 무대·목록을 문서 흐름으로 배치한다. 원본 이미지를 카드 뒤에 숨기지 않는다. 데스크톱에서도 문서 스크롤을 허용한다.

## 피드

- 기본은 공포/희망 좌우 비교다. `통합 보기`는 중립을 포함하는 최신순 목록이며 전체·공포·희망·중립 필터를 제공한다. 좁은 화면의 좌우 보기는 각 열을 가로로 넘겨 읽는 기존 동작을 유지한다.
- 보기 전환은 종목·출처 범위를 유지한다. 좌우 보기로 돌아오면 감성 필터를 해제해 두 진영을 함께 보여준다.
- 전체 범위 집계는 목록 감성 필터와 독립적이다. 중립은 희망·공포 비율에서 제외한다. 페이지의 일부 글만으로 비율을 다시 계산하지 않는다.
- 원문 URL, 예쁜말 필터, 개별 원문 제목 확인, 추가 페이지 조회를 유지한다.

## 데이터 계약

월드는 기존 `/api/internal/world` 및 `/api/internal/world/replay`를 사용하고 실시간 프레임은 60초마다 갱신한다. 초기 월드 조회는 클라이언트에서 수행한다. 실패 시 마지막 정상 프레임과 실제 데이터 시각을 유지한다.

`HomeFeedShell → /api/feed → getScopedFeed → getFeedSnapshot → fetchRecentFeedRows → Supabase`

- 최근 시간 범위를 서버에서 500개씩 끝까지 읽고, 종목·출처를 먼저 필터링한 뒤 페이지로 나눈다. 첫 500개 뒤에 있는 종목도 조회한다.
- 기존 `hours`(기본 6, 최대 24), `limit`(기본 80, 최대 200), `offset`, `rows`, `nextOffset`, `hasMore`, `errorMessage` 유지.
- 선택적 `symbol`/`stock`, `channels`/`channel`, `sentiment`와 응답 `summary`, `stocks`, `communities`, `generated_at`, `window_hours`, `market_indicators`, `collection` 유지.
- 감성 필터는 목록에만 적용한다. 전체·출처 지수는 기존 커뮤니티별 점수·시장 보정·수집 제외 산식, 종목 지수는 기존 종목 산식을 재사용한다.
- 추가 페이지는 첫 응답의 `generated_at`을 `asOf`로 전송한다. 60초 갱신은 펼친 페이지 수만큼 원자적으로 교체한다. 일부 페이지 실패 시 이전 목록·집계·실제 시각을 보존한다.
- 공개 API, WorldFrame v1, 수집·AI 분류·리포트·기록 저장과 DB 스키마는 변경하지 않는다.

## 검증

`npx tsc --noEmit`, `npm run build`, `npm run test:world`.

격리된 PostgREST fixture를 사용하는 API 검사, 기존 월드·기록·지수 검사, 원본 5단계/테마/극장 이미지 전환, 좌우/통합 보기, 500번째 뒤 종목, 페이지 추가, 갱신 실패, 모바일과 실제 WebGL 검사를 포함한다. 현재 검증 기록은 `metaverse-restoration-verification.md`에 별도로 남긴다.
