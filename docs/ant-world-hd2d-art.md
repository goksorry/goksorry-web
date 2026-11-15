# HD-2D 아트·구현 기준

2026-11-15. 새벽 거래소 골목. 먹색과 청회색, 산화된 금속, 제한된 황색등·붉은 비상등. 희망이 높아져도 기본 골목은 어둡게 유지한다. 개미는 희망·공포·중립 분석 표본을 대표하며 실제 사용자 수가 아니다.

## 원본과 사용 경로

| 파일 | 용도 | 구성 |
| --- | --- | --- |
| `public/world/materials.png` | 원본 재질 atlas | 2×2: 바닥·벽돌 / 금속·회벽 |
| `public/world/ants.png` | 원본 투명 캐릭터 atlas | 4방향 × 정지·걷기 A·걷기 B·공포·희망 |
| `components/world/ant-atlas.json` | 프레임 경계·애니메이션 정의 | alpha > 89 영역에 2px 여백. 일정한 원본 픽셀 밀도와 바닥 기준으로 plane 보정 |
| `public/images/overview-regimes/*.webp` | 기존 5단계 주식 삐에로 밈 | light/dark 원본 10개, HTML 무대와 PNG 공유에 그대로 사용 |
| `public/world/anchor.png` | 이전 생성 앵커 (현재 미사용) | 원본 밈을 캐릭터 소스로 확정하며 렌더 연결 해제 |
| `components/world/hd2d-renderer.ts` | 편집 가능한 3D 장면·재질·광원 원본 | 벽·바닥·계단·아치·관·케이블·셔터·상자·전단, 장면별 소품 |
| `public/world/static-*.png` | WebGL 실패·동작 줄이기용 정적 장면 | 동일 렌더러에서 빈 표본으로 캡처. 데이터 군중은 HTML atlas로 별도 표시 |
| `public/world/source/prompts.json` | 최종 프롬프트 세트 | 기본 제공 `image_gen` 도구 사용. CLI/API 우회 없음 |

세 PNG 원본은 이 작업에서 생성한 독자 에셋이다. 외부 게임의 캐릭터·배경·UI, 스톡 자료를 가져오지 않았다. 원본은 픽셀 편집 가능한 RGBA/RGB PNG이며 별도 레이어가 있는 PSD/Aseprite 파일은 아니다. 3D 모델은 장면 생성 코드가 원본이다. 제3자 에셋 라이선스·저작권 귀속 또는 생성물의 독점권을 주장하지 않는다.

## 렌더 규칙

- Three.js는 클라이언트 동적 import. Next.js·React 18과 `WorldFrame v1` 유지. 삐에로는 기존 밈 원본을 HTML 무대로 표시하며 지수 단계·테마에 맞춰 교체한다. 바닥·벽·캐릭터 atlas는 모든 장면에서 공유한다.
- 고정 사선 orthographic 카메라. 모바일은 frustum과 target을 별도로 지정하고 전체 지도를 축소하지 않는다.
- 재질 atlas를 각 128px texture로 샘플링. 확대는 nearest, 바닥 축소에는 nearest mipmap. 숫자·한글은 HTML.
- 개미는 카메라 방향 plane의 instancing. 프레임별 alpha 경계를 atlas metadata로 보정하고 동일 픽셀 밀도를 사용한다. 공포 자세는 짐·처진 더듬이, 희망 자세는 작은 주먹·황색 스카프.
- 아바타 포함 최대 데스크톱 48 / 모바일 24. 분석 글이 적으면 해당 표본 수만 표현한다. largest remainder 배분으로 희망·공포·중립 건수 비율을 유지한다.
- 건축 geometry는 재질별 병합, 그림자는 정적 캐시, 군중 접지 그림자는 instancing. 프레임버퍼는 데스크톱 폭 1024px 예산, 모바일 DPR 최대 1.25. HTML 정보는 이 해상도 제한에 영향받지 않는다.
- 모바일 30Hz 렌더 상한. 숨김 탭은 rAF·폴링·효과음 중단. 동작 줄이기에서는 Three.js를 로드하지 않는다.
- 이동은 반경이 있는 walkable grid와 선분 검사. 장애물 안 클릭은 무시하고 바리케이드 뒤쪽은 우회 경로를 찾는다.

## 자료

구현 원리 확인: [Three.js billboards](https://threejs.org/manual/pages/billboards.html), [Texture](https://threejs.org/docs/pages/Texture.html). 외부 게임 이미지를 에셋으로 사용하지 않는다.

정적 장면 재생성: 테스트 서버 3100/3101 준비 후 `WORLD_TEST_REUSE_SERVER=1 WORLD_CAPTURE_ART=1 npx playwright test --config playwright.world.config.ts tests/world-hd2d.spec.ts --project chromium`.
