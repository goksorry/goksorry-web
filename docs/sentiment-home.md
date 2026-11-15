# 통합 홈

홈은 최근 6시간의 지수, 종목별 언급, 커뮤니티 비교와 원문 목록을 함께 제공한다. `/analysis`는 query string을 보존해 홈으로 307 이동한다. 기존 `scene=ecosystem|battle&stock=...`, `scene=broadcast&channels=...`, `channel`, `feed=1` 링크도 같은 선택을 연다. `scene=theater`에는 종료 안내와 현재 데이터를 표시한다.

## 읽기 경로

`Home → getScopedFeed → getFeedSnapshot → fetchRecentFeedRows → Supabase`

- 초기 목록·집계는 서버 렌더링. 이후 `/api/feed`로 60초마다 갱신한다.
- 서버는 고정된 기준 시각의 전체 시간 범위를 500개씩 읽는다. 외부 글이 누락된 페이지도 `scannedCount`로 끝을 판단한다. 종목·출처 필터 **후** 목록을 페이지로 나눈다. 데이터 수집·분류·리포트 생성·기록 저장에는 변경 없다.
- `hours` 기본 6, 최대 24; `limit` 기본 80, 최대 200; `offset`과 기존 `rows`, `nextOffset`, `hasMore`, `errorMessage` 응답 유지.
- 추가 선택: `symbol`(홈 링크의 `stock`도 지원), `channels=toss,ppomppu,blind,dc`, `sentiment=all|bullish|bearish|neutral`. `channels=none`은 선택 없음. 복수 출처는 OR 조건.
- 추가 응답: `summary`, `stocks`, `communities`, `generated_at`, `window_hours`, `market_indicators`, `collection`.
- `summary`의 표본·희망·공포·중립은 종목과 출처 범위 전체다. 감성 필터는 목록에만 적용한다. 희망·공포 비율은 중립을 제외한다. 방향성 표본이 없으면 비율은 `null`이다.
- 전체/출처 지수는 기존 커뮤니티별 점수·시장 보정·수집 상태 제외·평균 산식을 재사용한다. 종목 지수는 기존 WorldFrame 종목 점수 산식을 재사용한다. 지수 산식에 따른 수집 제외와 별개로 기존 피드의 원문 조회 가능 범위는 유지한다.
- 더 보기에는 첫 응답의 `generated_at`을 `asOf`로 보낸다. 시간 범위를 고정하고 서버 정렬(`analyzed_at DESC`, `post_key DESC`)을 유지한다. 새로 수집된 글은 60초 갱신 때 반영한다. 갱신 시 펼친 목록 수를 유지한다.
- 조회 실패는 성공 캐시에 저장하지 않는다. 클라이언트는 마지막 정상 목록·요약·실제 데이터 시각을 유지하고 실패를 표시한다. 새 선택에 실패하면 현재 표시 중인 범위를 함께 표시한다. `summary.data_at`이 30분 이상 오래되면 `갱신 지연`이다.
- 행 수가 커지면 전체 범위를 읽는 서버 비용도 증가한다. 현재 읽기 전용·스키마 변경 없는 방식이며 60초 캐시를 공유한다. DB 집계/RPC 도입은 별도 작업이다.

## 화면과 아트

- 홈은 모든 테마에서 공통 헤더와 기존 테마 색상·설정을 사용한다. 다른 페이지의 프로그램 형태 테마, 계정, 게시판, 곡소리방, 채팅, 정책은 유지한다.
- 960px 미만에서 탐색 목록은 본문 `details`로 펼친다. 페이지 스크롤을 사용한다. 기본 글자 크기에서 현황 영역은 220px 이내다.
- `public/images/pierrot/*.svg`는 같은 얼굴·의상·팔레트로 직접 제작한 픽셀 원본 5종이다. 공포는 손수건·주저앉음, 희망은 한 발 균형, 혼조는 좌우 다른 팔 동작, 중립·소표본은 대기 자세다.
- 상태 변경 때 짧은 CSS 동작 1회. IntersectionObserver, 페이지 가시성, reduced-motion에 따라 정지한다. Three.js, 효과음, 아바타 이동, 이미지 공유, 재생은 홈에서 불러오지 않는다.
- 기존 `WorldFrame v1`, 공개·수집 API 및 저장/기록 경로는 유지한다. 이전 장면 컴포넌트는 홈 번들에서 분리되어 있다.

## 검증

격리된 PostgREST fixture로 API 경계까지 검사한다. 운영 DB에 테스트 데이터를 쓰지 않는다.

```sh
npx tsc --noEmit
npm run build
npm run test:world
```

`home-data.spec.ts`: 복수 출처, 범위 요약, 중립·빈 결과·소표본, 기존 링크.

`home-api.spec.ts`: 500번째 이후 종목, 연속 페이지, 서버 초기 데이터, 307 이동, WorldFrame 계약, 읽기 중간 실패와 재시도.

`home-browser.spec.ts`: 320/360/390/430/768px, 200% 글자 확대, 키보드, 뒤로 가기, 원문 링크, 8개 테마, 예쁜말, 상태별 원본, reduced-motion, 화면 밖 정지, Three.js 요청/코드 0건, 60초 갱신, 실패 시 시각 보존.

기존 집계·시장 보정·공개 API·WorldFrame/기록 테스트도 유지한다. 로컬 검증 결과와 실제 데이터 확인은 `sentiment-home-verification.md`에 기록한다. 배포 결과는 릴리스 시 별도로 확인한다.
