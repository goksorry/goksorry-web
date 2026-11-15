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

- Three.js는 클라이언트 동적 import. Next.js·React 18과 `WorldFrame v1` 유지. 삐에로는 기존 밈 원본을 광장에서는 벽 초상화 텍스처로, 다른 장면에서는 HTML 액자로 표시하며 지수 단계·테마에 맞춰 교체한다. 바닥·벽·캐릭터 atlas는 모든 장면에서 공유한다.
- 정면 perspective 카메라. 시선축은 수평(높이 8.4, 벽에서 32)이고 frustum을 아래로 민 lens shift라서, 정지 상태에서는 벽면이 예전 orthographic(앙각 22°) 구도와 똑같이 직사각형으로 찍히고 바닥·소품에만 원근이 생긴다. 카메라는 내 개미의 x 위치에 따라 벽 중심을 축으로 최대 7°(세로 구역 확대는 4°) 돌아 개미 쪽을 바라본다. 돌아간 동안 벽면 판 버튼은 네 꼭짓점 투영의 바운딩 박스를 쓴다. 화면 맞춤은 `lib/world-wall.ts`의 `wallFit`이 벽·HUD·화면 비율로 계산한다. 가로 화면은 벽 전체, 세로 화면은 벽 한 구역을 확대하고 화살표로 시점을 옮기며 전체보기로 축소한다.
- 재질 atlas를 각 128px texture로 샘플링. 확대는 nearest, 바닥 축소에는 nearest mipmap. 숫자·한글은 HTML.
- 개미는 카메라 방향 plane의 instancing. 프레임별 alpha 경계를 atlas metadata로 보정하고 동일 픽셀 밀도를 사용한다. 공포 자세는 짐·처진 더듬이, 희망 자세는 작은 주먹·황색 스카프.
- 아바타 포함 최대 데스크톱 48 / 모바일 24. 분석 글이 적으면 해당 표본 수만 표현한다. largest remainder 배분으로 희망·공포·중립 건수 비율을 유지한다.
- 건축 geometry는 재질별 병합, 그림자는 정적 캐시, 군중 접지 그림자는 instancing. 프레임버퍼는 데스크톱 폭 1024px 예산, 모바일 DPR 최대 1.25. HTML 정보는 이 해상도 제한에 영향받지 않는다.
- 광장 뒷벽(높이 9, 평면)에 판 5개를 건다: 시장 지수, 곡소리방, 삐에로 초상화, 곡소리 지수, 곡소리 피드. 내용은 `wall-painter.ts`가 CanvasTexture로 그리고 조명을 받지 않는다. 액자는 장면 지오메트리다. 판 위의 투명 DOM 버튼이 클릭·키보드·스크린리더를 맡고 누르면 모달이 열린다. 장식용 문구 없이 개미의 상태별 동작으로 분위기를 전달한다. 혼조는 개별 시차의 이동·정지·방향 전환, 공포·희망은 기존 자세를 사용한다.
- 모바일 30Hz 렌더 상한. 화면 밖 canvas와 판 턱 애니메이션은 정지한다. 숨김 탭은 rAF·폴링·효과음 중단. 동작 줄이기에서는 Three.js를 로드하지 않는다.
- 이동은 반경이 있는 walkable grid와 선분 검사. 장애물 안 클릭은 무시하고 바리케이드 뒤쪽은 우회 경로를 찾는다.

## 자료

구현 원리 확인: [Three.js billboards](https://threejs.org/manual/pages/billboards.html), [Texture](https://threejs.org/docs/pages/Texture.html). 외부 게임 이미지를 에셋으로 사용하지 않는다.

정적 장면 재생성: 테스트 서버 3100/3101 준비 후 `WORLD_TEST_REUSE_SERVER=1 WORLD_CAPTURE_ART=1 npx playwright test --config playwright.world.config.ts tests/world-hd2d.spec.ts --project chromium`.
