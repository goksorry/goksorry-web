import { expect, test } from "@playwright/test";
import { prepareWorld } from "./world-fixture";
import { readFile, writeFile } from "node:fs/promises";
import { worldDate } from "../lib/world";

test("plaza buildings, four scenes, evidence and avatar movement", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", (e) => errors.push(e.message));
  await prepareWorld(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "오늘도, 개미는 출근 중." })).toBeVisible();
  await expect(page.locator("[data-world-panel]")).toHaveCount(0);
  await page.getByRole("button", { name: "개미 생태계 입장" }).click();
  await expect(page).toHaveURL(/scene=ecosystem/);
  await expect(page.getByRole("button", { name: /개미굴 ·/ })).toHaveCount(12);
  await page.getByRole("button", { name: /삼성전자 개미굴/ }).click();
  await expect(page.getByRole("dialog", { name: /삼성전자 · 근거 글/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /삼성전자 오늘의 생각/ }).first()).toHaveAttribute("href", /example.com/);
  await page.getByRole("button", { name: "클린필터 끄기", exact: true }).click();
  await expect(page.getByRole("link", { name: /삼성전자 시발/ }).first()).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("navigation", { name: "월드 장면 선택" }).getByRole("button", { name: /심리 전장/ }).click();
  await page.getByLabel("전장 종목", { exact: true }).selectOption("S0");
  await expect(page.locator("[data-world-ant]")).toHaveCount(48);
  await page.getByRole("button", { name: "희망군 근거 글" }).click();
  await expect(page.getByRole("dialog", { name: /희망군 · 근거 글/ })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "절망군 근거 글" }).click();
  await expect(page.getByText("이 분류의 글이 없습니다.", { exact: false })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "중립 글 확인" }).click();
  await expect(page.getByRole("button", { name: "중립 0건" })).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape");
  const avatar = page.getByTestId("world-avatar");
  const before = await avatar.getAttribute("transform");
  const floor = page.getByRole("group", { name: /개미 월드. 바닥/ });
  await floor.focus(); await page.keyboard.press("ArrowRight");
  await expect(avatar).not.toHaveAttribute("transform", before!);
  const box = await floor.boundingBox();
  await floor.click({ position: { x: box!.width * .52, y: box!.height * .65 } });
  await page.getByRole("button", { name: "내 개미 색상 3" }).click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("goksorry-world-avatar-color"))).toBe("#efa5ac");
  await page.getByRole("button", { name: "♡ 감정 표현" }).click();
  await expect(avatar).toContainText("♡");
  await page.getByRole("navigation", { name: "월드 장면 선택" }).getByRole("button", { name: /재난방송/ }).click();
  await expect(page.getByText("삐에로 앵커", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "토스증권 현장 근거 글" }).click();
  await expect(page.getByRole("dialog", { name: /토스증권 현장/ })).toBeVisible();
  await page.screenshot({ path: "test-results/world-evidence.png" });
  expect(errors).toEqual([]);
});

test("index/feed toggle independently, filters and theme/auth remain accessible", async ({ page }) => {
  await prepareWorld(page); await page.goto("/?channels=toss");
  const feed = page.getByRole("dialog", { name: "외부 감성 피드", exact: true });
  await expect(feed).toBeVisible();
  await expect(feed.locator(".feed-channel-buttons .filter-chip-active")).toHaveText("토스증권");
  await page.locator(".world-index-toggle").click();
  const index = page.getByRole("dialog", { name: "지수·시장 개요" });
  await expect(index).toBeVisible(); await expect(feed).toBeVisible();
  await expect(index.locator(".overview-value").first()).toHaveText("1,234.56");
  await feed.getByRole("button", { name: "더 보기" }).click();
  await feed.getByRole("button", { name: "더 보기" }).click();
  await expect(feed.locator(".feed-pagination")).toContainText("최근 6시간 피드를 모두 불러왔습니다.");
  await index.getByRole("button", { name: "지수·시장 개요 닫기" }).click();
  await expect(feed).toBeVisible();
  await feed.getByRole("button", { name: "외부 감성 피드 닫기" }).click();
  await page.getByRole("button", { name: "☰ 메뉴" }).click();
  const menu = page.getByRole("dialog", { name: "사이트 메뉴·출처·정책" });
  await expect(menu.getByRole("button", { name: "구글 로그인", exact: true })).toBeVisible();
  await expect(menu.getByRole("link", { name: "이용약관", exact: true })).toBeVisible();
  await expect(menu.getByRole("link", { name: "한국투자증권(종목정보)" })).toBeVisible();
  await menu.getByRole("button", { name: /테마 선택/ }).click();
  await expect(page.getByRole("menu", { name: "테마 선택" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu", { name: "테마 선택" })).toHaveCount(0);
  await expect(menu).toBeVisible();
  await menu.getByRole("button", { name: /테마 선택/ }).click();
  await page.getByRole("button", { name: "테마 VS Code", exact: true }).click();
  await page.getByRole("button", { name: "색상 다크", exact: true }).click();
  await page.getByRole("button", { name: "적용", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme-id", "vscode-dark");
  await expect(page.locator(".world-root")).toBeVisible();
  await expect(page.getByTestId("program-shell")).toHaveCount(0);
});

test("mobile sheet switching, capped ants, no horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await prepareWorld(page); await page.goto("/?scene=battle&stock=S0");
  await expect(page.locator("[data-world-ant]")).toHaveCount(24);
  await page.locator(".world-index-toggle").click();
  await expect(page.getByRole("dialog", { name: "지수·시장 개요" })).toBeVisible();
  await page.locator(".world-sheet-tabs").getByRole("button", { name: "피드", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "외부 감성 피드", exact: true })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "지수·시장 개요" })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "지수·시장 개요" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/world-mobile.png" });
});

test("replay gaps, seek/play/pause, date URL and real PNG export", async ({ page }) => {
  await prepareWorld(page); await page.goto("/?scene=theater");
  const yesterday = worldDate(new Date(Date.now() - 86_400_000));
  await page.getByLabel("기록 날짜").fill(yesterday);
  await expect(page).toHaveURL(new RegExp(`date=${yesterday}`));
  await expect(page.getByRole("button", { name: "재생", exact: true })).toBeEnabled();
  await page.getByLabel("극장 시간 탐색", { exact: true }).fill("0.3");
  await expect(page.getByText("이 구간은 기록이 없습니다", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "재생", exact: true }).click();
  await expect(page.getByRole("button", { name: "일시정지", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "일시정지", exact: true }).click();
  await page.getByLabel("극장 시간 탐색", { exact: true }).fill("30");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "PNG 저장", exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(`goksorry-${yesterday}.png`);
  const path = await download.path(); const png = await readFile(path!);
  expect(png.subarray(1, 4).toString()).toBe("PNG");
  expect(png.readUInt32BE(16)).toBe(1200); expect(png.readUInt32BE(20)).toBe(800);
  await page.getByRole("button", { name: "링크 공유", exact: true }).click();
  await expect(page.getByLabel("극장 공유 링크")).toHaveValue(/scene=theater.*date=/);
  await page.screenshot({ path: "test-results/world-theater.png" });
});

test("data failure and reduced motion keep controls and information available", async ({ page }) => {
  await prepareWorld(page); await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/internal/world", (route) => route.fulfill({ status: 503, json: { error: "테스트 데이터 장애" } }));
  await page.goto("/");
  await expect(page.getByText("테스트 데이터 장애", { exact: false })).toBeVisible();
  await expect(page.locator(".world-root")).toHaveAttribute("data-paused", "true");
  await page.getByRole("button", { name: "개미 생태계 입장" }).click();
  await expect(page.getByText("아직 조용한 개미굴", { exact: false })).toBeVisible();
  await page.locator(".world-index-toggle").click();
  await expect(page.getByRole("dialog", { name: "지수·시장 개요" })).toBeVisible();
});

test("maximum population frame cadence, desktop and mobile", async ({ page }, testInfo) => {
  await prepareWorld(page);
  const metrics: Record<string, unknown>[] = [];
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport); await page.goto("/?scene=battle&stock=S0");
    const expected = viewport.width > 760 ? 48 : 24;
    await expect(page.locator("[data-world-ant]")).toHaveCount(expected);
    const measurement = await page.evaluate(() => new Promise<{ fps: number; p95: number }>((resolve) => {
      const times: number[] = []; let last = 0, start = 0;
      const tick = (now: number) => {
        if (!start) start = now;
        if (last) times.push(now - last); last = now;
        if (now - start < 3000) requestAnimationFrame(tick);
        else { const sorted = [...times].sort((a,b) => a-b); resolve({ fps: times.length / ((now - start) / 1000), p95: sorted[Math.floor(sorted.length * .95)] }); }
      }; requestAnimationFrame(tick);
    }));
    metrics.push({ ...viewport, ants: expected, ...measurement });
    expect(measurement.fps).toBeGreaterThanOrEqual(viewport.width > 760 ? 55 : 30);
  }
  const path = testInfo.outputPath("world-frame-cadence.json");
  await writeFile(path, JSON.stringify(metrics, null, 2));
  await testInfo.attach("world-frame-cadence.json", { path, contentType: "application/json" });
});

test("hidden tab stops polling and motion; sound and avatar preferences persist", async ({ page }) => {
  await prepareWorld(page);
  let reads = 0;
  page.on("request", (request) => { if (new URL(request.url()).pathname === "/api/internal/world") reads++; });
  await page.clock.install(); await page.goto("/");
  await expect(page.locator(".world-live-badge")).toContainText("관측 중");
  await expect(page.getByRole("button", { name: "효과음 켜기", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "효과음 켜기", exact: true }).click();
  expect(await page.evaluate(() => localStorage.getItem("goksorry-world-muted"))).toBe("off");
  await page.getByRole("button", { name: "내 개미 색상 2" }).click();
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, value: true }); document.dispatchEvent(new Event("visibilitychange")); });
  await expect(page.locator(".world-root")).toHaveAttribute("data-paused", "true");
  const hiddenReads = reads;
  await page.clock.fastForward(120_000); expect(reads).toBe(hiddenReads);
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, value: false }); document.dispatchEvent(new Event("visibilitychange")); });
  await expect.poll(() => reads).toBe(hiddenReads + 1);
  await page.reload();
  await expect(page.getByRole("button", { name: "효과음 끄기", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "내 개미 색상 2" })).toHaveAttribute("aria-pressed", "true");
});
