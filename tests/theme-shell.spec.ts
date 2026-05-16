import { expect, test } from "@playwright/test";

const CLEAN_FILTER_COOKIE = "goksorry-clean-filter";
const THEME_STORAGE_KEY = "goksorry-theme";

const prepareThemePage = async (page: import("@playwright/test").Page) => {
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
    [THEME_STORAGE_KEY, "light"]
  );
};

test.describe("program theme shells", () => {
  test("default light theme keeps the original site shell", async ({ page }) => {
    await prepareThemePage(page);
    await page.goto("/");

    await expect(page.locator("html")).toHaveAttribute("data-theme-shell", "default");
    await expect(page.getByTestId("program-shell")).toHaveCount(0);
    await expect(page.locator(".header")).toBeVisible();
  });

  test("excel theme renders ribbon, formula bar, sheet tabs, and status bar", async ({ page }, testInfo) => {
    await prepareThemePage(page);
    await page.goto("/?theme=excel-light");

    await expect(page.locator("html")).toHaveAttribute("data-theme-shell", "excel");
    await expect(page.getByTestId("program-shell")).toHaveAttribute("data-program-shell", "excel");
    await expect(page.getByTestId("excel-ribbon")).toBeVisible();
    await expect(page.getByTestId("excel-formula-bar")).toBeVisible();
    await expect(page.getByTestId("excel-sheet-tabs")).toBeVisible();
    await expect(page.getByTestId("program-status-bar")).toBeVisible();

    const currentUrl = page.url();
    await page.getByRole("button", { name: "Paste mock command" }).click();
    await expect(page).toHaveURL(currentUrl);
    await page.screenshot({ path: testInfo.outputPath("excel-light.png"), fullPage: false });
  });

  test("ide themes render explorer, editor tabs, content, and status bar", async ({ page }, testInfo) => {
    await prepareThemePage(page);
    await page.goto("/?theme=vscode-dark");

    await expect(page.locator("html")).toHaveAttribute("data-theme-shell", "ide");
    await expect(page.getByTestId("ide-sidebar")).toBeVisible();
    await expect(page.getByTestId("ide-editor-tabs")).toBeVisible();
    await expect(page.getByTestId("program-content-area")).toBeVisible();
    await expect(page.getByTestId("program-status-bar")).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("vscode-dark.png"), fullPage: false });
  });

  test("presentation, blog, and docs themes render their program chrome", async ({ page }, testInfo) => {
    const cases = [
      { theme: "powerpoint-light", shell: "presentation", locator: "presentation-sidebar" },
      { theme: "blog-dark", shell: "blog", locator: "blog-sidebar" },
      { theme: "docs-dark", shell: "docs", locator: "docs-sidebar" }
    ];

    for (const item of cases) {
      await prepareThemePage(page);
      await page.goto(`/?theme=${item.theme}`);

      await expect(page.locator("html")).toHaveAttribute("data-theme-shell", item.shell);
      await expect(page.getByTestId("program-shell")).toHaveAttribute("data-program-shell", item.shell);
      await expect(page.getByTestId(item.locator)).toBeVisible();
      await expect(page.getByTestId("program-content-area")).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath(`${item.theme}.png`), fullPage: false });
    }
  });
});
