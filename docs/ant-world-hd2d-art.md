# HD-2D 아트·구현 기준

2026-11-15. 새벽 거래소 골목. 먹색과 청회색, 산화된 금속, 제한된 황색등·붉은 비상등. 희망이 높아져도 기본 골목은 어둡게 유지한다. 개미는 희망·공포·중립 분석 표본을 대표하며 실제 사용자 수가 아니다.

## 원본과 사용 경로

| 파일 | 용도 | 구성 |
| --- | --- | --- |
| `public/world/materials.png` | 원본 재질 atlas | 2×2: 바닥·벽돌 / 금속·회벽 |
| `public/world/ants.png` | 원본 투명 캐릭터 atlas | 4방향 × 정지·걷기 A·걷기 B·공포·희망 |
| `art/world/source/ants-diagonal.png` | 대각선 4방향 원본 시트 | 열 앞왼·뒤왼·뒤오른·앞오른 × 행 정지·걷기 A·걷기 B·공포·희망 |
| `art/world/source/ants-phone.png` | 폰 보기·한숨 원본 시트 | 열 앞·왼·오른·뒤 × 행 중립 폰·중립 한숨·공포 폰·희망 폰·희망 한숨 |
| `art/world/source/ants-walk.png` | 감정별 걷기 원본 시트 | 열 앞·왼·오른·뒤 × 행 (공포 걷기 A/B: 미사용)·희망 걷기 A/B·중립 지나가는 발 |
| `art/world/source/ants-fear.png` | 공포 걷기·한숨 원본 시트 | 열 앞·왼·오른·뒤 × 행 공포 걷기 A·걷기 B·지나가는 발·한숨·(중립 정지: 색 보정 기준, 미사용) |
| `scripts/build-ant-atlas.mjs` | atlas 합성 스크립트 (`npm run build:ant-atlas`) | 원본 시트를 잘라 `ant-atlas.png`와 `ant-atlas.json`을 함께 기록. `--check <png>`는 한 장만 검사 |
| `public/world/ant-atlas.png` | 렌더러가 읽는 합성 atlas (생성물) | `ants.png`를 (0,0)에 그대로 두고 새 프레임을 아래에 배치. 직접 수정하지 않는다 |
| `components/world/ant-atlas.json` | 프레임 경계·애니메이션 정의 (생성물, v2) | alpha > 89 영역에 2px 여백. `cells`는 기존 20칸, `frames`는 전체 88프레임 |
| `public/images/overview-regimes/*.webp` | 기존 5단계 주식 삐에로 밈 | light/dark 원본 10개, HTML 무대와 PNG 공유에 그대로 사용 |
| `public/world/anchor.png` | 이전 생성 앵커 (현재 미사용) | 원본 밈을 캐릭터 소스로 확정하며 렌더 연결 해제 |
| `components/world/hd2d-renderer.ts` | 편집 가능한 3D 장면·재질·광원 원본 | 벽·바닥·계단·아치·관·케이블·셔터·상자·전단, 장면별 소품 |
| `public/world/static-*.png` | WebGL 실패·동작 줄이기용 정적 장면 | 동일 렌더러에서 빈 표본으로 캡처. 데이터 군중은 HTML atlas로 별도 표시 |
| `public/world/source/prompts.json` | 최종 프롬프트 세트 | 기본 제공 `image_gen` 도구 사용. CLI/API 우회 없음 |

`materials.png`, `ants.png`, `anchor.png`와 `source/ants-*.png` 세 장은 이 작업에서 생성한 독자 에셋이다. 외부 게임의 캐릭터·배경·UI, 스톡 자료를 가져오지 않았다. 원본은 픽셀 편집 가능한 RGBA/RGB PNG이며 별도 레이어가 있는 PSD/Aseprite 파일은 아니다. 3D 모델은 장면 생성 코드가 원본이다. 제3자 에셋 라이선스·저작권 귀속 또는 생성물의 독점권을 주장하지 않는다.

## 개미 atlas v2

- `frames`의 키는 `감정.자세.방향`이다. 감정 `neutral|fear|hope`, 자세 `idle|walk-a|walk-b|walk-p|phone|sigh`, 방향 `f|fl|l|bl|b|br|r|fr`(f = 카메라 쪽, b = 벽 쪽).
- 값은 `[x, y, w, h, k, ax]`. `k`는 시트 사이 크기 보정 배율이고 지금은 전부 1이다(새 시트의 머리 크기가 기존과 같아 매니페스트의 `norm.ref`를 실측 높이에 맞췄다). `ax`는 개미의 바닥 위치에 놓이는 x(칸 왼쪽 기준 px)로, 불투명 픽셀의 무게중심이다. 발 위치로 잡으면 걷기 프레임마다 35~114px씩 흔들려서 쓰지 않는다. 예외가 필요하면 스크립트의 행 옵션 `"center"`나 `AX` 표로 고정한다.
- `image`는 렌더러가 읽는 파일, `width`/`height`는 그 파일의 크기다. `ants.png`는 수정하지 않으며 CSS 정적 장면과 로고가 계속 그대로 쓴다. 기존 `cells` 좌표는 합성 atlas에서도 유효하고, 광장 외 장면은 `cells`만 쓴다.
- 없는 프레임은 `lib/world-crowd.ts`의 `antFrameCandidates`가 같은 감정의 다른 자세, 중립, 좌우 반전(UV 폭을 음수로) 순으로 대체한다.
- 합성할 때 스크립트가 새 시트에만 세 가지 보정을 한다(원본 파일은 건드리지 않는다). ① 색 맞춤: 생성 시트가 `ants.png`보다 15~20% 밝게 나와서, 매니페스트 `tone` 행의 평균색이 기준 행과 같아지도록 채널별 배율을 곱한다. 이게 없으면 걷는 동안 프레임마다 개미 색이 바뀐다. ② 폰 프레임의 흰 빛 번짐을 어두운 청록으로 낮춘다(게임 크기에서 마스크처럼 보였다). ③ 용량: 렌더러는 alpha .35에서 자르기만 하므로 alpha를 0/255로 만들고 가려지는 픽셀을 비우며, 새 프레임은 채널당 5비트로 줄인다(최대 4/255 차이). `ants.png` 영역의 색은 그대로다. 결과 `ant-atlas.png`는 약 2.2MB다(보정 전 4.3MB, `ants.png` 1.1MB).
- 추가 원본 시트 네 장은 `art/world/source/`에 둔다(합 4.5MB). `public/` 밖이라 배포·서빙되지 않고, 합성 스크립트만 읽는다. 프롬프트 기록은 `public/world/source/prompts.json`에 그대로 있다.
- 원본 시트를 바꾸면 `npm run build:ant-atlas`를 다시 실행하고 PNG와 JSON을 함께 커밋한다.

## 광장 군중

- 인원: 광장은 내 개미 포함 데스크톱 21 / 모바일 13, 다른 장면은 48 / 24 (`crowdCapacity`).
- `lib/world-crowd.ts`가 시드 고정 시뮬레이션을 돌린다. 개미는 화면에 보이는 바닥 전체(뒤쪽 z -2.9부터 화면 아래 끝까지)를 걸어 다니고, 대부분의 시간은 벽의 판을 향해 서 있다(8~20초). 그중 일부는 폰을 3~6초 보고 1.8초 한숨을 쉰 뒤 다시 서 있거나 걷는다. 혼조일 때는 서 있는 시간이 ×.75로 짧아져 조금 더 자주 움직이지만 그래도 평균 70% 안팎이 벽을 본다. 폰·한숨은 동시에 전체의 15%(20마리 중 3, 12마리 중 2)까지만 한다.
- 서 있을 자리는 스프라이트 폭만큼(가로 1.1, 앞뒤 1.3) 서로 떨어지고, 내 개미 바로 앞(가리는 자리)은 피한다. 세로 확대 화면에서는 구역 화살표가 놓이는 바닥 앞쪽 1.2만큼을 비운다.
- 서로와 내 개미를 피해 걷고, 화면이 줄어 바닥이 가려지면 순간이동 없이 걸어 나온다. 세로 확대 화면에서는 보고 있는 구역으로 몇 초에 걸쳐 모인다.
- 걷는 방향이 대각선이면 대각선 프레임을 쓴다. 공포·희망 개미는 대각선 걷기 아트가 없어 4방향으로 걷고, 지나가는 발 프레임이 없는 조합은 걷기 A/B 두 장을 번갈아 쓴다. `ants-walk.png`의 공포 걷기 A/B는 그림이 거의 같아 미끄러져 보였기 때문에 `ants-fear.png`로 교체했다. 걷는 개미는 모두 걸음마다 살짝 튀어 오른다.
- 한숨의 입김은 아트가 아니라 렌더러가 그리는 작은 인스턴스 메쉬다. 같은 메쉬가 폰 프레임이 없을 때만 폰 화면도 그린다. 클릭 판정에는 들어가지 않는다.
- 다른 장면의 개미 배치와 동작은 이전과 같다.

## 렌더 규칙

- Three.js는 클라이언트 동적 import. Next.js·React 18과 `WorldFrame v1` 유지. 삐에로는 기존 밈 원본을 광장에서는 벽 초상화 텍스처로, 다른 장면에서는 HTML 액자로 표시하며 지수 단계·테마에 맞춰 교체한다. 바닥·벽·캐릭터 atlas는 모든 장면에서 공유한다.
- 정면 perspective 카메라. 시선축은 수평(높이 8.4, 벽에서 32)이고 frustum을 아래로 민 lens shift라서, 정지 상태에서는 벽면이 예전 orthographic(앙각 22°) 구도와 똑같이 직사각형으로 찍히고 바닥·소품에만 원근이 생긴다. 카메라는 내 개미의 x 위치에 비례해 개미 쪽을 바라본다. 벽 전체 보기에서는 제자리에서 최대 10° 고개를 돌리고 그쪽으로 조금 따라가 개미가 화면 중앙에 가까워지며, 이때 반대쪽 끝 판은 화면 밖으로 나갈 수 있다(초광폭 화면은 벽 끝이 드러나지 않게 각도를 줄인다). 세로 구역 확대에서는 여유 폭이 없어 벽 중심을 축으로 최대 4° 돈다. 돌아간 동안 벽면 판 버튼은 네 꼭짓점 투영의 바운딩 박스를 쓴다. 화면 맞춤은 `lib/world-wall.ts`의 `wallFit`이 벽·HUD·화면 비율로 계산한다. 가로 화면은 벽 전체, 세로 화면은 벽 한 구역을 확대하고 화살표로 시점을 옮기며 전체보기로 축소한다.
- 재질 atlas를 각 128px texture로 샘플링. 확대는 nearest, 바닥 축소에는 nearest mipmap. 숫자·한글은 HTML.
- 개미는 카메라 방향 plane의 instancing. 프레임별 alpha 경계를 atlas metadata로 보정하고 동일 픽셀 밀도를 사용한다. 공포 자세는 짐·처진 더듬이, 희망 자세는 작은 주먹·황색 스카프.
- 아바타 포함 최대 데스크톱 48 / 모바일 24, 광장은 21 / 13. 분석 글이 적으면 해당 표본 수만 표현한다. largest remainder 배분으로 희망·공포·중립 건수 비율을 유지한다.
- 건축 geometry는 재질별 병합, 그림자는 정적 캐시, 군중 접지 그림자는 instancing. 프레임버퍼는 데스크톱 폭 1024px 예산, 모바일 DPR 최대 1.25. HTML 정보는 이 해상도 제한에 영향받지 않는다.
- 광장 뒷벽(높이 9, 평면)에 판 5개를 건다: 시장 지수, 곡소리방, 삐에로 초상화, 곡소리 지수, 곡소리 피드. 내용은 `wall-painter.ts`가 CanvasTexture로 그리고 조명을 받지 않는다. 액자는 장면 지오메트리다. 판 위의 투명 DOM 버튼이 클릭·키보드·스크린리더를 맡고 누르면 모달이 열린다. 장식용 문구 없이 개미의 상태별 동작으로 분위기를 전달한다. 광장 밖 장면에서 혼조는 개별 시차의 이동·정지·방향 전환, 공포·희망은 기존 자세를 사용한다.
- 모바일 30Hz 렌더 상한. 화면 밖 canvas와 판 턱 애니메이션은 정지한다. 숨김 탭은 rAF·폴링·효과음 중단. 동작 줄이기에서는 Three.js를 로드하지 않는다.
- 이동은 반경이 있는 walkable grid와 선분 검사. 장애물 안 클릭은 무시하고 바리케이드 뒤쪽은 우회 경로를 찾는다.

## 자료

구현 원리 확인: [Three.js billboards](https://threejs.org/manual/pages/billboards.html), [Texture](https://threejs.org/docs/pages/Texture.html). 외부 게임 이미지를 에셋으로 사용하지 않는다.

정적 장면 재생성: 테스트 서버 3100/3101 준비 후 `WORLD_TEST_REUSE_SERVER=1 WORLD_CAPTURE_ART=1 npx playwright test --config playwright.world.config.ts tests/world-hd2d.spec.ts --project chromium`.

추가 개미 시트 생성(2026-11-15, codex-cli 0.167.0, 세 장 모두 첫 시도 채택): 저장소 루트에서 시트마다 새로 실행한다. 다시 만들 때도 `codex exec resume`이 아니라 새 실행을 쓴다. 프롬프트·래퍼 원문은 `public/world/source/prompts.json`의 `sprites-diagonal`, `sprites-phone`, `sprites-walk`, `companion_sheets`에 있다.

```bash
codex exec -s workspace-write -C . -c 'model_reasoning_effort="medium"' -i public/world/ants.png -o <scratch>/codex-<name>-1.txt -- "<WRAPPER>" </dev/null
node scripts/build-ant-atlas.mjs --check art/world/source/ants-<name>.png   # 20칸 확인
npm run build:ant-atlas
```
