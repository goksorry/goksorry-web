import { expect, test } from "@playwright/test";

const COOKIE_CONSENT_COOKIE = "goksorry-cookie-consent";
const CLEAN_FILTER_COOKIE = "goksorry-clean-filter";
const THEME_COOKIE = "goksorry-theme-mode";
const THEME_STORAGE_KEY = "goksorry-theme";

test.describe("header auth state", () => {
  test("hydrates login state from the client session endpoint", async ({ page }) => {
    let sessionRequestCount = 0;

    await page.context().addCookies([
      {
        name: COOKIE_CONSENT_COOKIE,
        value: "v1:essential",
        domain: "127.0.0.1",
        path: "/"
      },
      {
        name: CLEAN_FILTER_COOKIE,
        value: "on",
        domain: "127.0.0.1",
        path: "/"
      },
      {
        name: THEME_COOKIE,
        value: "light",
        domain: "127.0.0.1",
        path: "/"
      }
    ]);
    await page.addInitScript(
      ([storageKey, theme]) => {
        window.localStorage.setItem(storageKey, theme);
      },
      [THEME_STORAGE_KEY, "light"]
    );
    await page.route("**/api/auth/session", async (route) => {
      sessionRequestCount += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          expires: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          user: {
            id: "test-user",
            email: "tester@example.com",
            nickname: "테스터",
            role: "user",
            profile_setup_required: false
          }
        })
      });
    });

    await page.goto("/");

    await expect(page.getByRole("link", { name: "내 프로필" })).toBeVisible();
    await expect(page.locator(".header-profile-name")).toHaveText("테스터");
    expect(sessionRequestCount).toBeGreaterThan(0);
  });
});
