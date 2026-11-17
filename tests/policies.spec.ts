import { expect, test } from "@playwright/test";
import { formatPolicyDate } from "../lib/policy-metadata";

test.beforeEach(async ({ request }) => { await request.post("http://127.0.0.1:3103/_control?activated=false"); });

test("dates use Korea's calendar for date-only and database timestamps", () => {
  expect(formatPolicyDate("2026-11-25")).toBe("2026. 11. 25.");
  expect(formatPolicyDate("2026-11-24T15:00:00.000Z")).toBe("2026. 11. 25.");
  expect(formatPolicyDate("2026-11-24T14:59:59.000Z")).toBe("2026. 11. 24.");
});

test("current document and both amendment notices render without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:3102/terms");
  await expect(page.locator(".legal-page")).toContainText("현행 내용");
  await expect(page.locator(".policy-change-banner")).toHaveCount(2);
  await expect(page.locator('.policy-change-banner a[href="/terms?version=terms-pending"]')).toBeVisible();
  await expect(page.locator('.policy-change-banner a[href="/privacy?version=privacy-pending"]')).toBeVisible();
  await expect(page.locator(".legal-page")).not.toContainText("비공개 초안");
  await context.close();
});

test("pending terms and privacy have full previews and navigable history", async ({ page }) => {
  await page.goto("/terms?version=terms-pending");
  await expect(page.locator(".legal-page")).toContainText("시행 예정");
  await expect(page.locator(".legal-page")).toContainText("현재 서비스는 무료이며 광고를 게재하지 않습니다");
  await expect(page.getByRole("link", { name: "현행 이용약관", exact: true })).toHaveAttribute("href", "/terms");
  await page.locator(".legal-history summary").click();
  await page.locator('.legal-history a[href="/terms?version=terms-old"]').click();
  await expect(page.locator(".legal-page")).toContainText("이전 내용");
  await page.goto("/privacy?version=privacy-pending");
  await expect(page.locator(".legal-page")).toContainText("최근 30건");
  await expect(page.locator(".legal-page")).toContainText("전송 후 24시간");
  await expect(page.locator(".legal-page")).toContainText("하루 2회(한국시간 03시·15시) 만료 기록을 정리");
  await expect(page.locator(".legal-page")).toContainText("대한민국 서울");
  await expect(page.locator(".legal-page")).toContainText("추가 확인이 필요한 상태");
});

test("chat moderation rejects visitors and cross-origin deletion", async ({ request }) => {
  expect((await request.get("/api/admin/chat/messages")).status()).toBe(401);
  expect((await request.delete("/api/admin/chat/messages", { headers: { Origin: "https://untrusted.invalid" }, data: { id: "fixture" } })).status()).toBe(403);
});

test("unpublished or unknown versions cannot be read", async ({ request }) => {
  for (const version of ["terms-unpublished", "missing", "privacy-pending"]) {
    const response = await request.get(`/terms?version=${version}`);
    // Next.js can start streaming the layout before notFound() resolves.
    expect([200, 404]).toContain(response.status());
    const body = await response.text();
    expect(body).toContain('name="robots" content="noindex"');
    expect(body).not.toContain("비공개 초안");
    expect(body).not.toContain('class="panel legal-page"');
  }
});

test("effective revision takes over without changing the public URL", async ({ request }) => {
  await request.post("http://127.0.0.1:3103/_control?activated=true");
  for (const type of ["terms", "privacy"]) {
    const response = await request.get(`/${type}`);
    const body = await response.text();
    expect(body).toContain("현재 적용 중");
    expect(body).toContain(`${type} pending 변경 요약`);
    expect(body).not.toContain("현행 내용");
  }
});
