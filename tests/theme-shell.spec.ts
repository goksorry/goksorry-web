import { expect, test, type Page } from "@playwright/test";

const CLEAN_FILTER_COOKIE = "goksorry-clean-filter";
const THEME_STORAGE_KEY = "goksorry-theme";

const prepareThemePage = async (page: Page, storedTheme = "light") => {
  await page.context().addCookies([
    {
      name: CLEAN_FILTER_COOKIE,
      value: "on",
      domain: "127.0.0.1",
      path: "/"
    }
  ]);
  await page.addInitScript(
    ([key, value]) => {
      window.localStorage.setItem(key, value);
    },
    [THEME_STORAGE_KEY, storedTheme]
  );
};

const expectConceptHeaderReplacesSiteHeader = async (page: Page, shell: string) => {
  await expect(page.locator(".header")).toHaveCount(0);
  await expect(page.getByTestId("program-shell")).toHaveAttribute("data-program-shell", shell);
  await expect(page.getByTestId("program-header")).toBeVisible();
  await expect(page.getByTestId("concept-header-actions")).toBeVisible();
  await expect(page.getByTestId("program-header").getByRole("link", { name: "곡소리닷컴 홈" })).toBeVisible();
  await expect(page.getByTestId("program-header").getByRole("link", { name: "피드" })).toBeVisible();
  await expect(page.getByTestId("program-header").getByRole("link", { name: "게시판" })).toBeVisible();
  await expect(page.getByTestId("program-header").getByRole("link", { name: "곡소리방" })).toBeVisible();
  await expect(page.getByTestId("program-content-area")).toBeVisible();
  await expect(page.getByTestId("program-status-bar")).toBeVisible();
};

test.describe("program theme shells", () => {
  test("default light theme keeps the original site shell", async ({ page }) => {
    await prepareThemePage(page);
    await page.goto("/");

    await expect(page.locator("html")).toHaveAttribute("data-theme-id", "light");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(page.locator("html")).toHaveAttribute("data-theme-shell", "default");
    await expect(page.getByTestId("program-shell")).toHaveCount(0);
    await expect(page.locator(".header")).toBeVisible();
  });

  test("default system follows the device color scheme", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await prepareThemePage(page, "system");
    await page.goto("/");

    await expect(page.locator("html")).toHaveAttribute("data-theme-id", "system");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.locator("html")).toHaveAttribute("data-theme-effective-tone", "dark");
    await expect(page.locator("html")).toHaveAttribute("data-theme-shell", "default");
  });

  test("excel theme renders a full ribbon shell and replaces the site header", async ({ page }, testInfo) => {
    await prepareThemePage(page);
    await page.goto("/?theme=excel-light");

    await expect(page.locator("html")).toHaveAttribute("data-theme-id", "excel-light");
    await expect(page.locator("html")).toHaveAttribute("data-theme-shell", "excel");
    await expectConceptHeaderReplacesSiteHeader(page, "excel");
    await expect(page.getByTestId("excel-ribbon")).toBeVisible();
    await expect(page.getByTestId("excel-formula-bar")).toBeVisible();
    await expect(page.getByTestId("excel-sheet-tabs")).toBeVisible();

    const currentUrl = page.url();
    await page.getByRole("button", { name: "Paste mock command" }).click();
    await expect(page).toHaveURL(currentUrl);
    await page.screenshot({ path: testInfo.outputPath("excel-light.png"), fullPage: false });
  });

  test("each concept theme has distinct chrome and no legacy header", async ({ page }, testInfo) => {
    const cases = [
      { theme: "powerpoint-dark", shell: "powerpoint", locator: "powerpoint-slide-rail" },
      { theme: "docs-light", shell: "docs", locator: "docs-sidebar" },
      { theme: "vscode-dark", shell: "vscode", locator: "vscode-sidebar" },
      { theme: "jetbrains-light", shell: "jetbrains", locator: "jetbrains-sidebar" },
      { theme: "vs-dark", shell: "visual-studio", locator: "visual-studio-sidebar" }
    ];

    for (const item of cases) {
      await prepareThemePage(page);
      await page.goto(`/?theme=${item.theme}`);

      await expect(page.locator("html")).toHaveAttribute("data-theme-id", item.theme);
      await expect(page.locator("html")).toHaveAttribute("data-theme-shell", item.shell);
      await expectConceptHeaderReplacesSiteHeader(page, item.shell);
      await expect(page.getByTestId(item.locator)).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath(`${item.theme}.png`), fullPage: false });
    }
  });

  test("concept system themes resolve to the current device tone", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await prepareThemePage(page);
    await page.goto("/?theme=vscode-system");

    await expect(page.locator("html")).toHaveAttribute("data-theme-id", "vscode-system");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "vscode-dark");
    await expect(page.locator("html")).toHaveAttribute("data-theme-tone", "system");
    await expect(page.locator("html")).toHaveAttribute("data-theme-effective-tone", "dark");
    await expectConceptHeaderReplacesSiteHeader(page, "vscode");
  });

  test("blog and unknown theme values always fall back to the default theme", async ({ page }) => {
    await prepareThemePage(page, "blog-dark");
    await page.goto("/?theme=unknown");

    await expect(page.locator("html")).toHaveAttribute("data-theme-id", "light");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(page.locator("html")).toHaveAttribute("data-theme-shell", "default");
    await expect(page.getByTestId("program-shell")).toHaveCount(0);
    await expect(page.locator(".header")).toBeVisible();
  });
});
