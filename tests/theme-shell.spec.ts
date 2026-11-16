import { expect, test, type Page } from "@playwright/test";

const CLEAN_FILTER_COOKIE = "goksorry-clean-filter";
const COOKIE_CONSENT_COOKIE = "goksorry-cookie-consent";
const THEME_STORAGE_KEY = "goksorry-theme";
const THEME_COOKIE = "goksorry-theme-mode";
const CHANGE_COLOR_MODE_STORAGE_KEY = "goksorry-change-color-mode";
const CHANGE_COLOR_MODE_COOKIE = "goksorry-change-color-mode";
const CHAT_LAYOUT_ENABLED = Boolean(process.env.CHAT_WS_BASE_URL);
const EXCEL_CONTROL_RADIUS = 3;
const THEME_ICON_PATH_BY_SHELL: Record<string, string> = {
  excel: "/theme-icons/excel.svg",
  docs: "/theme-icons/docs.svg",
  vscode: "/theme-icons/vscode.svg"
};

const prepareThemePage = async (page: Page, storedTheme = "light", storedChangeColorMode = "hybrid") => {
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
      value: storedTheme,
      domain: "127.0.0.1",
      path: "/"
    },
    {
      name: CHANGE_COLOR_MODE_COOKIE,
      value: storedChangeColorMode,
      domain: "127.0.0.1",
      path: "/"
    }
  ]);
  await page.addInitScript(
    ([themeKey, themeValue, changeColorModeKey, changeColorModeValue]) => {
      window.localStorage.setItem(themeKey, themeValue);
      window.localStorage.setItem(changeColorModeKey, changeColorModeValue);
    },
    [THEME_STORAGE_KEY, storedTheme, CHANGE_COLOR_MODE_STORAGE_KEY, storedChangeColorMode]
  );
};

const prepareSetupHintFirstVisitPage = async (page: Page) => {
  await page.context().addCookies([
    {
      name: COOKIE_CONSENT_COOKIE,
      value: "v1:essential",
      domain: "127.0.0.1",
      path: "/"
    }
  ]);
  await page.addInitScript(
    ([themeKey, changeColorModeKey]) => {
      window.localStorage.removeItem(themeKey);
      window.localStorage.removeItem(changeColorModeKey);
    },
    [THEME_STORAGE_KEY, CHANGE_COLOR_MODE_STORAGE_KEY]
  );
};

const readFirstVisitHintTargetMetrics = async (page: Page) =>
  page.evaluate(() => {
    const header = document.querySelector(".header") as HTMLElement;
    const hint = document.querySelector(".first-visit-header-hint") as HTMLElement;
    const controls = document.querySelector(".header .header-controls") as HTMLElement;
    const themeButton = document.querySelector(".header .theme-menu-trigger") as HTMLElement;
    const loginButton = document.querySelector(
      ".header-profile .header-login-button, .header-profile .header-auth-shell"
    ) as HTMLElement;
    const hintRect = hint.getBoundingClientRect();
    const controlsRect = controls.getBoundingClientRect();
    const themeButtonRect = themeButton.getBoundingClientRect();
    const loginRect = loginButton.getBoundingClientRect();
    const headerRect = header.getBoundingClientRect();
    const pointerX = Number.parseFloat(window.getComputedStyle(hint).getPropertyValue("--first-visit-hint-pointer-x"));
    const pointerPageX = hintRect.left + pointerX;
    const controlsCenter = controlsRect.left + controlsRect.width / 2;

    return {
      topGap: hintRect.top - headerRect.bottom,
      leftGap: hintRect.left - headerRect.left,
      pointerToControlsCenter: Math.abs(pointerPageX - controlsCenter),
      pointerInsideControls: pointerPageX >= controlsRect.left && pointerPageX <= controlsRect.right,
      themeLeftOfLogin: themeButtonRect.right < loginRect.left,
      pointerLeftOfLogin: pointerPageX < loginRect.left,
      themeButtonLeftDelta: Math.abs(hintRect.left - themeButtonRect.left)
    };
  });

const mockGuestChatSession = async (page: Page, onRequest?: () => void) => {
  await page.route("**/api/chat/session", async (route) => {
    onRequest?.();
    const chatBaseUrl = process.env.CHAT_WS_BASE_URL ?? "ws://127.0.0.1:8787/ws";
    const separator = chatBaseUrl.includes("?") ? "&" : "?";

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ws_url: `${chatBaseUrl}${separator}token=playwright-chat-token`,
        viewer: {
          kind: "guest",
          display_name: "guest",
          can_filter_guests: false,
          can_send: true,
          default_filter: "all"
        },
        expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString()
      })
    });
  });
};

const readRootThemeVars = async (page: Page, names: string[]) => {
  return page.evaluate((varNames) => {
    const style = window.getComputedStyle(document.documentElement);
    return Object.fromEntries(varNames.map((name) => [name, style.getPropertyValue(name).trim()]));
  }, names);
};

const expectConceptHeaderReplacesSiteHeader = async (page: Page, shell: string) => {
  const header = page.getByTestId("program-header");
  const iconPath = THEME_ICON_PATH_BY_SHELL[shell];
  await expect(page.locator(".header")).toHaveCount(0);
  await expect(page.getByTestId("program-shell")).toHaveAttribute("data-program-shell", shell);
  await expect(header).toBeVisible();
  await expect(page.getByTestId("concept-header-actions")).toBeVisible();
  await expect(header.locator(".theme-shell-logo")).toHaveCount(0);
  await expect(header.locator('img[src*="goksorry_logo"]')).toHaveCount(0);
  await expect(header.getByTestId("theme-shell-brand-icon")).toHaveAttribute("src", iconPath);
  await expect(header.getByRole("link", { name: "곡소리닷컴 홈" })).toBeVisible();
  if (shell === "docs") {
    await expect(header.getByRole("link", { name: "피드" })).toHaveCount(0);
    await expect(header.getByRole("link", { name: "게시판" })).toHaveCount(0);
    await expect(header.getByRole("link", { name: "곡소리방" })).toHaveCount(0);
    await expect(page.getByTestId("docs-menu-bar").getByRole("button", { name: "File" })).toBeVisible();
    await expect(page.getByTestId("docs-sidebar").getByRole("link", { name: "home.goksorry" })).toBeVisible();
  } else if (shell === "excel") {
    await expect(header.getByRole("link", { name: "피드" })).toHaveCount(0);
    await expect(header.getByRole("link", { name: "게시판" })).toHaveCount(0);
    await expect(header.getByRole("link", { name: "곡소리방" })).toHaveCount(0);
    await expect(page.getByTestId("excel-ribbon").getByRole("button", { name: "Home" })).toBeVisible();
    await expect(page.getByTestId("excel-sheet-tabs").getByRole("link", { name: "홈", exact: true })).toBeVisible();
  } else {
    await expect(header.getByRole("link", { name: "곡소리닷컴 홈" })).toHaveText("곡소리닷컴");
    await expect(header.getByRole("link", { name: "홈", exact: true })).toBeVisible();
    await expect(header.getByRole("link", { name: "게시판" })).toBeVisible();
    await expect(header.getByRole("link", { name: "곡소리방" })).toBeVisible();
  }
  await expect(header.getByRole("link", { name: "채팅" })).toHaveCount(0);
  await expect(page.getByTestId("concept-header-actions").getByRole("button", { name: /테마 선택/ })).toHaveText("🎨");
  await expect(page.getByTestId("program-content-area")).toBeVisible();
  await expect(page.getByTestId("program-status-bar")).toBeVisible();
  await expect(page.getByTestId("theme-content-document")).toBeVisible();
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const link = document.querySelector('link[data-theme-favicon="true"]') as HTMLLinkElement | null;
        return link ? new URL(link.href, window.location.href).pathname : null;
      })
    )
    .toBe(iconPath);
};

const expectConceptHeaderFixed = async (page: Page) => {
  const header = page.getByTestId("program-header");
  const topBefore = await header.evaluate((element) => Math.round(element.getBoundingClientRect().top));

  await page.locator(".theme-shell-content-frame").first().evaluate((element) => {
    element.scrollTop = 900;
  });

  await expect
    .poll(async () => header.evaluate((element) => Math.round(element.getBoundingClientRect().top)))
    .toBe(topBefore);

  await page.locator(".theme-shell-content-frame").first().evaluate((element) => {
    element.scrollTop = 0;
  });
};

type ExcelGridMetric = {
  selector: string;
  present: boolean;
  left: number;
  top: number;
  width: number;
  height: number;
  columnWidth: number;
  rowHeight: number;
};

const distanceToGridLine = (value: number, cellSize: number) => {
  const remainder = Math.abs(value % cellSize);
  return Math.min(remainder, Math.abs(cellSize - remainder));
};

const readExcelGridMetrics = async (page: Page, selectors: string[]) => {
  return page.evaluate((targetSelectors) => {
    const documentElement = document.querySelector("[data-testid='theme-content-document']") as HTMLElement;
    const rowHeader = document.querySelector(".excel-row-headers span") as HTMLElement;
    const documentStyle = window.getComputedStyle(documentElement);
    const documentRect = documentElement.getBoundingClientRect();
    const columnWidth = Number.parseFloat(documentStyle.getPropertyValue("--excel-column-width"));
    const rowHeight = rowHeader.getBoundingClientRect().height;

    return targetSelectors.map((selector) => {
      const element = document.querySelector(selector) as HTMLElement | null;
      if (!element) {
        return {
          selector,
          present: false,
          left: 0,
          top: 0,
          width: 0,
          height: 0,
          columnWidth,
          rowHeight
        };
      }

      const rect = element.getBoundingClientRect();
      return {
        selector,
        present: true,
        left: rect.left - documentRect.left,
        top: rect.top - documentRect.top,
        width: rect.width,
        height: rect.height,
        columnWidth,
        rowHeight
      };
    });
  }, selectors) as Promise<ExcelGridMetric[]>;
};

const expectExcelGridAligned = (
  metrics: ExcelGridMetric[],
  fields: Array<"left" | "top" | "width" | "height"> = ["left", "top", "width", "height"]
) => {
  for (const metric of metrics) {
    expect(metric.present, `${metric.selector} should exist`).toBe(true);
    for (const field of fields) {
      const cellSize = field === "left" || field === "width" ? metric.columnWidth : metric.rowHeight;
      expect(distanceToGridLine(metric[field], cellSize), `${metric.selector}.${field}`).toBeLessThanOrEqual(1.5);
    }
  }
};

const buildRoomEntry = (id: string, index: number) => ({
  id,
  content: `무한 스크롤 테스트 의견 ${index}`,
  author_kind: "guest",
  author_label: "테스터",
  created_at: new Date(Date.UTC(2026, 4, 17, 0, index, 0)).toISOString(),
  reply_count: 0,
  can_delete: false,
  is_mine: false,
  replies: []
});

const roomThemeCases = [
  { url: "/goksorry-room", shell: "default", root: "" },
  { url: "/goksorry-room?theme=excel-light", shell: "excel", root: ".theme-shell-excel" },
  { url: "/goksorry-room?theme=docs-light", shell: "docs", root: ".theme-shell-docs" },
  { url: "/goksorry-room?theme=vscode-light", shell: "vscode", root: ".theme-shell-vscode" }
];

const roomSelector = (root: string, selector: string) => `${root ? `${root} ` : ""}${selector}`;

test.describe("program theme shells", () => {
  test("default light theme keeps the original site shell", async ({ page }) => {
    await prepareThemePage(page);
    await page.goto("/auth/login");

    await expect(page.locator("html")).toHaveAttribute("data-theme-id", "light");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(page.locator("html")).toHaveAttribute("data-theme-shell", "default");
    await expect(page.getByTestId("program-shell")).toHaveCount(0);
    await expect(page.locator(".header")).toBeVisible();
    await expect(page.getByTestId("theme-shell-brand-icon")).toHaveCount(0);
    await expect(page.locator(".header").getByRole("link", { name: "채팅" })).toHaveCount(0);
    await expect(page.locator(".header").getByRole("button", { name: /테마 선택/ })).toHaveText("🎨");
      await expect
        .poll(async () =>
          page.evaluate(() => {
            const link = document.querySelector('link[data-theme-favicon="true"]') as HTMLLinkElement | null;
            return link ? new URL(link.href, window.location.href).pathname : null;
          })
        )
        .toBe("/favicon.ico");

      await page.goto("/community");
      await expect(page.locator("html")).toHaveAttribute("data-theme-shell", "default");
      await expect(page.locator(".community-board-panel")).toBeVisible();

      const defaultBoardLayout = await page.evaluate(() => {
        const main = document.querySelector(".main") as HTMLElement;
        const panel = document.querySelector(".community-board-panel") as HTMLElement;
        const cards = Array.from(panel.querySelectorAll(".board-card")) as HTMLElement[];
        const panelStyle = window.getComputedStyle(panel);
        const panelRect = panel.getBoundingClientRect();
        const visibleChildren = Array.from(panel.children).filter((child) => {
          return window.getComputedStyle(child).display !== "none";
        }) as HTMLElement[];
        const childRects = visibleChildren.map((child) => child.getBoundingClientRect());
        const contentTop = Math.min(...childRects.map((rect) => rect.top));
        const contentBottom = Math.max(...childRects.map((rect) => rect.bottom));
        const expectedPanelHeight =
          contentBottom -
          contentTop +
          Number.parseFloat(panelStyle.paddingTop) +
          Number.parseFloat(panelStyle.paddingBottom) +
          Number.parseFloat(panelStyle.borderTopWidth) +
          Number.parseFloat(panelStyle.borderBottomWidth);

        return {
          mainAlignContent: window.getComputedStyle(main).alignContent,
          panelAlignSelf: panelStyle.alignSelf,
          panelHeight: panelRect.height,
          expectedPanelHeight,
          cardMinHeights: cards.map((card) => window.getComputedStyle(card).minHeight)
        };
      });
      expect(defaultBoardLayout.mainAlignContent).toBe("start");
      expect(defaultBoardLayout.panelAlignSelf).toBe("start");
      expect(defaultBoardLayout.cardMinHeights.every((height) => height === "0px")).toBe(true);
      expect(defaultBoardLayout.panelHeight).toBeLessThanOrEqual(defaultBoardLayout.expectedPanelHeight + 1);
    });

  test("header share button is mobile-only", async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 760 });
    await prepareThemePage(page);
    await page.goto("/auth/login");

    const defaultShareButton = page.locator(".header .header-share-button");
    await expect(defaultShareButton).toHaveCount(1);
    await expect(defaultShareButton).toBeHidden();

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(defaultShareButton).toBeVisible();

    await page.setViewportSize({ width: 1180, height: 760 });
    await page.goto("/auth/login?theme=excel-light");

    const conceptShareButton = page.getByTestId("concept-header-actions").locator(".header-share-button");
    await expect(conceptShareButton).toHaveCount(1);
    await expect(conceptShareButton).toBeHidden();

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(conceptShareButton).toBeVisible();
  });

  test("default system follows the device color scheme", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await prepareThemePage(page, "system");
    await page.goto("/auth/login");

    await expect(page.locator("html")).toHaveAttribute("data-theme-id", "system");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.locator("html")).toHaveAttribute("data-theme-effective-tone", "dark");
    await expect(page.locator("html")).toHaveAttribute("data-theme-shell", "default");
  });

  test("theme shell is server-rendered from URL and cookie preferences", async ({ request }) => {
    const urlThemeResponse = await request.get("/auth/login?theme=vscode-dark", {
      headers: {
        cookie: `${THEME_COOKIE}=docs-dark`
      }
    });
    const urlThemeHtml = await urlThemeResponse.text();
    expect(urlThemeResponse.ok()).toBe(true);
    expect(urlThemeHtml).toContain('data-theme-id="vscode-dark"');
    expect(urlThemeHtml).toContain('data-theme-shell="vscode"');
    expect(urlThemeHtml).toContain("theme-shell-vscode");

    const cookieThemeResponse = await request.get("/auth/login", {
      headers: {
        cookie: `${THEME_COOKIE}=docs-dark`
      }
    });
    const cookieThemeHtml = await cookieThemeResponse.text();
    expect(cookieThemeResponse.ok()).toBe(true);
    expect(cookieThemeHtml).toContain('data-theme-id="docs-dark"');
    expect(cookieThemeHtml).toContain('data-theme-shell="docs"');
    expect(cookieThemeHtml).toContain("theme-shell-docs");

    const removedThemeResponse = await request.get("/auth/login", {
      headers: {
        cookie: `${THEME_COOKIE}=powerpoint-dark`
      }
    });
    const removedThemeHtml = await removedThemeResponse.text();
    expect(removedThemeResponse.ok()).toBe(true);
    expect(removedThemeHtml).toContain('data-theme-id="light"');
    expect(removedThemeHtml).toContain('data-theme-shell="default"');
    expect(removedThemeHtml).not.toContain("theme-shell-powerpoint");
  });

  test("theme selection persists to cookie and local storage", async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 760 });
    await prepareThemePage(page);
    await page.goto("/auth/login?channels=toss");

    await page.getByRole("button", { name: /테마 선택/ }).click();
    await page.getByRole("button", { name: "테마 VS Code" }).click();
    await page.getByRole("button", { name: "색상 다크" }).click();
    await page.getByRole("button", { name: "적용" }).click();

    await expect(page.locator("html")).toHaveAttribute("data-theme-id", "vscode-dark");
    await expect
      .poll(async () => {
        const url = new URL(page.url());
        return {
          channels: url.searchParams.get("channels"),
          theme: url.searchParams.get("theme")
        };
      })
      .toEqual({
        channels: "toss",
        theme: "vscode-dark"
      });
    await expect
      .poll(async () =>
        page.evaluate(
          ([cookieName, storageKey]) => ({
            cookie: document.cookie
              .split(";")
              .map((part) => part.trim())
              .find((part) => part.startsWith(`${cookieName}=`)),
            storage: window.localStorage.getItem(storageKey)
          }),
          [THEME_COOKIE, THEME_STORAGE_KEY]
        )
      )
      .toEqual({
        cookie: `${THEME_COOKIE}=vscode-dark`,
        storage: "vscode-dark"
      });
  });

  test("change color mode selection uses symbol labels and persists", async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 760 });
    await prepareThemePage(page);
    await page.goto("/auth/login");

    await expect(page.locator("html")).toHaveAttribute("data-change-color-mode", "hybrid");
    await page.getByRole("button", { name: /테마 선택/ }).click();

    const koreanMode = page.getByRole("button", { name: "등락률 색상 한국식" });
    const usMode = page.getByRole("button", { name: "등락률 색상 미국식" });
    const hybridMode = page.getByRole("button", { name: "등락률 색상 하이브리드" });
    await expect(koreanMode).toHaveText(/🇰🇷\s*↑\s*↓/);
    await expect(usMode).toHaveText(/🇺🇸\s*↑\s*↓/);
    await expect(hybridMode).toHaveText("🔀");

    const arrowColors = await page.evaluate(() => {
      const read = (selector: string) => window.getComputedStyle(document.querySelector(selector) as HTMLElement).color;
      return {
        krUp: read("[aria-label='등락률 색상 한국식'] .theme-menu-change-up"),
        krDown: read("[aria-label='등락률 색상 한국식'] .theme-menu-change-down"),
        usUp: read("[aria-label='등락률 색상 미국식'] .theme-menu-change-up"),
        usDown: read("[aria-label='등락률 색상 미국식'] .theme-menu-change-down")
      };
    });
    expect(arrowColors).toEqual({
      krUp: "rgb(211, 47, 47)",
      krDown: "rgb(30, 99, 216)",
      usUp: "rgb(22, 138, 82)",
      usDown: "rgb(195, 66, 54)"
    });

    await usMode.click();
    await page.getByRole("button", { name: "적용" }).click();

    await expect(page.locator("html")).toHaveAttribute("data-change-color-mode", "us");
    await expect
      .poll(async () =>
        page.evaluate(
          ([cookieName, storageKey]) => ({
            cookie: document.cookie
              .split(";")
              .map((part) => part.trim())
              .find((part) => part.startsWith(`${cookieName}=`)),
            storage: window.localStorage.getItem(storageKey)
          }),
          [CHANGE_COLOR_MODE_COOKIE, CHANGE_COLOR_MODE_STORAGE_KEY]
        )
      )
      .toEqual({
        cookie: `${CHANGE_COLOR_MODE_COOKIE}=us`,
        storage: "us"
      });
  });

  test("site share URL includes the active theme", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "share", {
        configurable: true,
        value: async (data: ShareData) => {
          (window as Window & { __lastSharedUrl?: string }).__lastSharedUrl = data.url;
        }
      });
    });
    await prepareThemePage(page, "vscode-dark");
    await page.goto("/community?sort=recent#board");

    await expect
      .poll(async () => {
        const url = new URL(page.url());
        return {
          sort: url.searchParams.get("sort"),
          theme: url.searchParams.get("theme"),
          hash: url.hash
        };
      })
      .toEqual({
        sort: "recent",
        theme: "vscode-dark",
        hash: "#board"
      });

    const shareButton = page.locator(".header-share-button");
    await expect(shareButton).toBeVisible();
    await shareButton.click();

    await expect
      .poll(async () => page.evaluate(() => (window as Window & { __lastSharedUrl?: string }).__lastSharedUrl ?? null))
      .toBe("https://goksorry.com/community?sort=recent&theme=vscode-dark#board");
  });

  test("excel theme renders a single-line ribbon shell and replaces the site header", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1180, height: 760 });
    await prepareThemePage(page);
    await page.goto("/auth/login?theme=excel-light");

    await expect(page.locator("html")).toHaveAttribute("data-theme-id", "excel-light");
    await expect(page.locator("html")).toHaveAttribute("data-theme-shell", "excel");
    await expectConceptHeaderReplacesSiteHeader(page, "excel");
    await expectConceptHeaderFixed(page);
    await expect(page.getByTestId("excel-ribbon")).toBeVisible();
    await expect(page.getByTestId("excel-formula-bar")).toBeVisible();
    await expect(page.getByTestId("excel-sheet-tabs")).toBeVisible();
    await expect(page.getByTestId("excel-column-headers")).toBeVisible();
    await expect(page.getByTestId("excel-row-headers")).toBeVisible();
    await expect(page.getByTestId("excel-row-headers").locator("span").first()).toHaveText("1");
    await expect(page.getByTestId("program-header").getByRole("button", { name: "Microsoft 365 app launcher mock command" })).toBeVisible();
    await expect(page.getByTestId("program-header").getByRole("button", { name: "Share workbook mock command" })).toBeVisible();
    await expect(page.getByTestId("excel-ribbon").getByRole("button", { name: "Automate" })).toBeVisible();
    await expect(page.getByTestId("excel-ribbon").getByRole("button", { name: "AutoSum mock command" })).toBeVisible();
    await expect(page.getByTestId("excel-single-line-ribbon")).toBeVisible();
    await expect(page.getByTestId("excel-ribbon").getByRole("button", { name: "Ribbon display options mock command" })).toBeVisible();
    await expect(page.getByTestId("program-header").getByRole("button", { name: "Save mock command" })).toHaveCount(0);
    await expect(page.getByTestId("program-header").getByRole("button", { name: "Undo mock command" })).toHaveCount(0);
    await expect(page.getByTestId("program-header").getByRole("button", { name: "Analyze mock command" })).toHaveCount(0);
    await expect(page.getByTestId("program-header").getByText("Saved to Goksorry")).toBeVisible();
    await expect(page.getByTestId("program-header").getByText("Saved to OneDrive")).toHaveCount(0);

    const excelLauncherChrome = await page.evaluate(() => {
      const titlebar = document.querySelector(".excel-titlebar") as HTMLElement;
      const launcher = document.querySelector(".excel-app-launcher") as HTMLElement;
      const launcherDot = document.querySelector(".excel-app-launcher span") as HTMLElement;

      return {
        titlebarBackground: window.getComputedStyle(titlebar).backgroundColor,
        launcherColor: window.getComputedStyle(launcher).color,
        launcherDotBackground: window.getComputedStyle(launcherDot).backgroundColor
      };
    });
    expect(excelLauncherChrome.launcherDotBackground).toBe(excelLauncherChrome.launcherColor);
    expect(excelLauncherChrome.launcherDotBackground).not.toBe(excelLauncherChrome.titlebarBackground);

    const excelRibbonMetrics = await page.evaluate(() => {
      const commandButtons = Array.from(document.querySelectorAll(".excel-ribbon-command")) as HTMLElement[];
      const plainCommandButtons = Array.from(
        document.querySelectorAll(".excel-ribbon-command:not(.excel-ribbon-command-select)")
      ) as HTMLElement[];
      const selectButtons = Array.from(document.querySelectorAll(".excel-ribbon-command-select")) as HTMLElement[];
      const commandRects = commandButtons.map((button) => button.getBoundingClientRect());
      const ribbonRect = (document.querySelector("[data-testid='excel-single-line-ribbon']") as HTMLElement).getBoundingClientRect();
      const commandTops = commandRects.map((rect) => Math.round(rect.top));
      const plainCommandStyles = plainCommandButtons.map((button) => window.getComputedStyle(button));
      const selectButtonStyles = selectButtons.map((button) => window.getComputedStyle(button));

      return {
        commandCount: commandButtons.length,
        iconCount: document.querySelectorAll(".excel-ribbon-command .excel-command-icon").length,
        groupLabelCount: document.querySelectorAll(".excel-ribbon-group p").length,
        legacyLargeCount: document.querySelectorAll(".excel-ribbon-command-large").length,
        separatorCount: document.querySelectorAll(".excel-ribbon-separator").length,
        selectCount: selectButtons.length,
        commandHeights: commandRects.map((rect) => Math.round(rect.height)),
        plainCommandBorderWidths: plainCommandStyles.map((style) => Number.parseFloat(style.borderTopWidth)),
        plainCommandRadii: plainCommandStyles.map((style) => Number.parseFloat(style.borderTopLeftRadius)),
        selectCommandBorderWidths: selectButtonStyles.map((style) => Number.parseFloat(style.borderTopWidth)),
        selectCommandRadii: selectButtonStyles.map((style) => Number.parseFloat(style.borderTopLeftRadius)),
        topSpread: Math.max(...commandTops) - Math.min(...commandTops),
        ribbonHeight: Math.round(ribbonRect.height)
      };
    });
    expect(excelRibbonMetrics.commandCount).toBeGreaterThanOrEqual(18);
    expect(excelRibbonMetrics.iconCount).toBeGreaterThanOrEqual(excelRibbonMetrics.commandCount - 1);
    expect(excelRibbonMetrics.groupLabelCount).toBe(0);
    expect(excelRibbonMetrics.legacyLargeCount).toBe(0);
    expect(excelRibbonMetrics.separatorCount).toBeGreaterThanOrEqual(4);
    expect(excelRibbonMetrics.selectCount).toBeGreaterThanOrEqual(5);
    expect(new Set(excelRibbonMetrics.commandHeights).size).toBe(1);
    expect(new Set(excelRibbonMetrics.plainCommandBorderWidths)).toEqual(new Set([0]));
    expect(new Set(excelRibbonMetrics.plainCommandRadii)).toEqual(new Set([EXCEL_CONTROL_RADIUS]));
    expect(new Set(excelRibbonMetrics.selectCommandBorderWidths)).toEqual(new Set([1]));
    expect(new Set(excelRibbonMetrics.selectCommandRadii)).toEqual(new Set([EXCEL_CONTROL_RADIUS]));
    expect(excelRibbonMetrics.topSpread).toBeLessThanOrEqual(1);
    expect(excelRibbonMetrics.ribbonHeight).toBeLessThanOrEqual(52);

    const excelFormulaMetrics = await page.evaluate(() => {
      const controls = Array.from(
        document.querySelectorAll(".excel-name-box, .excel-formula-control-group, .excel-formula-bar input")
      ) as HTMLElement[];

      return controls.map((control) => Math.round(control.getBoundingClientRect().height));
    });
    expect(new Set(excelFormulaMetrics).size).toBe(1);

    await expect.poll(async () => page.getByTestId("excel-column-headers").locator("span").count()).toBeGreaterThanOrEqual(8);

    const sheetMetrics = await page.evaluate(() => {
      const frame = document.querySelector(".excel-content-frame") as HTMLElement;
      const headers = Array.from(document.querySelectorAll("[data-testid='excel-column-headers'] span")) as HTMLElement[];
      const firstHeaderWidth = headers[0]?.getBoundingClientRect().width ?? 0;

      return {
        columnCount: headers.length,
        contentWidth: frame.clientWidth,
        firstHeaderWidth,
        lastColumn: headers.at(-1)?.textContent ?? ""
      };
    });
    const expectedColumnCount = Math.max(1, Math.floor(sheetMetrics.contentWidth / 100));
    expect(expectedColumnCount).toBeGreaterThanOrEqual(8);
    expect(sheetMetrics.columnCount).toBe(expectedColumnCount);
    if (expectedColumnCount > 8) {
      expect(sheetMetrics.lastColumn).not.toBe("H");
    }
    expect(Math.abs(sheetMetrics.firstHeaderWidth - sheetMetrics.contentWidth / expectedColumnCount)).toBeLessThanOrEqual(1);

  });

  test("excel titlebar keeps right actions visible with compact search", async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 760 });
    await prepareThemePage(page);
    await page.goto("/auth/login?theme=excel-light");

    await expect(page.getByTestId("program-header").getByRole("button", { name: "Share workbook mock command" })).toBeVisible();

    const titlebarLayout = await page.evaluate(() => {
      const header = document.querySelector(".excel-titlebar") as HTMLElement;
      const search = document.querySelector(".excel-search") as HTMLElement;
      const actions = document.querySelector(".excel-top-actions") as HTMLElement;
      const shareButton = document.querySelector(".excel-share-button") as HTMLElement;
      const conceptActions = document.querySelector(".theme-shell-excel .theme-shell-actions") as HTMLElement;
      const headerRect = header.getBoundingClientRect();
      const searchRect = search.getBoundingClientRect();
      const actionsRect = actions.getBoundingClientRect();
      const shareButtonRect = shareButton.getBoundingClientRect();

      return {
        headerRight: headerRect.right,
        searchWidth: searchRect.width,
        searchRight: searchRect.right,
        actionsLeft: actionsRect.left,
        actionsRight: actionsRect.right,
        actionsClientWidth: actions.clientWidth,
        actionsScrollWidth: actions.scrollWidth,
        conceptActionsClientWidth: conceptActions.clientWidth,
        conceptActionsScrollWidth: conceptActions.scrollWidth,
        shareButtonRight: shareButtonRect.right
      };
    });

    expect(titlebarLayout.searchWidth).toBeLessThanOrEqual(15 * 16 + 1);
    expect(titlebarLayout.searchRight).toBeLessThanOrEqual(titlebarLayout.actionsLeft - 4);
    expect(titlebarLayout.actionsRight).toBeLessThanOrEqual(titlebarLayout.headerRight + 1);
    expect(titlebarLayout.shareButtonRight).toBeLessThanOrEqual(titlebarLayout.headerRight + 1);
    expect(titlebarLayout.actionsScrollWidth).toBeLessThanOrEqual(titlebarLayout.actionsClientWidth + 1);
    expect(titlebarLayout.conceptActionsScrollWidth).toBeLessThanOrEqual(titlebarLayout.conceptActionsClientWidth + 1);
  });

  test("excel theme aligns community and room content blocks to worksheet cells", async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 760 });
    await prepareThemePage(page);
    await page.goto("/community?theme=excel-light");
    await expect(page.locator("html")).toHaveAttribute("data-theme-shell", "excel");
    await page.locator(".theme-shell-excel .theme-shell-page .main").evaluate((main) => {
      main.insertAdjacentHTML(
        "afterbegin",
        `<section class="panel excel-grid-fixture">
          <h2>셀 정렬 fixture</h2>
          <div class="board-grid">
            <a href="/community/free" class="card board-card"><h3>자유게시판</h3></a>
            <a href="/community/notice" class="card board-card"><h3>공지</h3></a>
            <a href="/community/market" class="card board-card"><h3>시장 이야기</h3></a>
          </div>
          <div class="actions">
            <a href="/community/free/new" class="btn">글쓰기</a>
            <a href="/community" class="btn btn-secondary">게시판 목록</a>
          </div>
            <div class="community-post-list">
              <article class="community-post-row community-post-row-board">
                <span class="community-post-board">자유</span>
                <a href="/community/free/post-1" class="community-post-title-link">
                  <strong class="community-post-title">
                    <span>엑셀 셀 정렬 검증용 게시글입니다</span>
                    <span class="community-post-comment-count">[3]</span>
                  </strong>
                </a>
                <span class="community-post-separator community-post-separator-board" aria-hidden="true">|</span>
                <span class="community-post-meta community-post-meta-board">
                  <span class="community-post-board-mobile">자유</span>
                  <span class="community-post-separator community-post-separator-author" aria-hidden="true">|</span>
                  <span class="community-post-author">테스터</span>
                  <span class="community-post-separator community-post-separator-time" aria-hidden="true">|</span>
                  <time class="community-post-time" datetime="2026-05-16T00:00:00.000Z">2026.05.16</time>
                </span>
              </article>
            </div>
        </section>`
      );
    });
    const communityMetrics = await readExcelGridMetrics(page, [
      ".theme-shell-excel .excel-grid-fixture",
      ".theme-shell-excel .excel-grid-fixture h2",
      ".theme-shell-excel .excel-grid-fixture .board-grid",
      ".theme-shell-excel .excel-grid-fixture .board-card",
      ".theme-shell-excel .excel-grid-fixture .actions",
      ".theme-shell-excel .excel-grid-fixture .community-post-list",
      ".theme-shell-excel .excel-grid-fixture .community-post-row",
      ".theme-shell-excel .excel-grid-fixture .community-post-board",
      ".theme-shell-excel .excel-grid-fixture .community-post-title",
      ".theme-shell-excel .excel-grid-fixture .community-post-meta",
      ".theme-shell-excel .excel-grid-fixture .community-post-author",
      ".theme-shell-excel .excel-grid-fixture .community-post-time"
    ]);
    expectExcelGridAligned(communityMetrics);

    await page.route("**/api/goksorry-room**", async (route) => {
      const requestUrl = new URL(route.request().url());
      if (requestUrl.pathname.endsWith("/api/goksorry-room/replies")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            replies: [
              {
                id: "reply-1",
                entry_id: "entry-1",
                content: "덧글도 같은 셀 높이에 맞습니다.",
                author_kind: "guest",
                author_label: "응답자",
                created_at: "2026-05-16T00:01:00.000Z",
                can_delete: false
              }
            ]
          })
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          entries: [
            {
              id: "entry-1",
              content: "엑셀 셀 경계에 맞춘 곡소리방 의견입니다.",
              author_kind: "guest",
              author_label: "테스터",
              created_at: "2026-05-16T00:00:00.000Z",
              reply_count: 1,
              can_delete: false,
              replies: []
            }
          ],
          next_cursor: null
        })
      });
    });
    await page.goto("/goksorry-room?theme=excel-light");
    await expect(page.locator("html")).toHaveAttribute("data-theme-shell", "excel");
    await expect(page.locator(".theme-shell-excel .goksorry-room-entry")).toHaveCount(1);
    await page.getByRole("button", { name: "덧글 1" }).click();
    await expect(page.locator(".theme-shell-excel .goksorry-room-reply-form")).toBeVisible();
    await expect(page.locator(".theme-shell-excel .goksorry-room-reply")).toHaveCount(1);
    await expect(page.locator(".theme-shell-excel .goksorry-room-entry-form textarea")).toHaveCount(0);
    await expect(page.locator(".theme-shell-excel .goksorry-room-reply-form textarea")).toHaveCount(0);
    await expect(page.locator(".theme-shell-excel .goksorry-room-entry-form .goksorry-room-input-label input")).toHaveAttribute(
      "maxlength",
      "160"
    );
    await expect(page.locator(".theme-shell-excel .goksorry-room-reply-form .goksorry-room-input-label input")).toHaveAttribute(
      "maxlength",
      "160"
    );
    await expect(page.locator(".theme-shell-excel .goksorry-room-entry-form .goksorry-room-nickname-label input")).toHaveAttribute(
      "maxlength",
      "10"
    );

    const roomMetrics = await readExcelGridMetrics(page, [
      ".theme-shell-excel .goksorry-room-panel",
      ".theme-shell-excel .goksorry-room-panel > h1",
      ".theme-shell-excel .goksorry-room-entry-form",
      ".theme-shell-excel .goksorry-room-entry-form .goksorry-room-input-label",
      ".theme-shell-excel .goksorry-room-entry-form input",
      ".theme-shell-excel .goksorry-room-entry-form .goksorry-room-nickname-label",
      ".theme-shell-excel .goksorry-room-entry-form .goksorry-room-count",
      ".theme-shell-excel .goksorry-room-list",
      ".theme-shell-excel .goksorry-room-entry",
      ".theme-shell-excel .goksorry-room-entry-main",
      ".theme-shell-excel .goksorry-room-actions",
      ".theme-shell-excel .goksorry-room-replies",
      ".theme-shell-excel .goksorry-room-reply",
      ".theme-shell-excel .goksorry-room-reply-form",
      ".theme-shell-excel .goksorry-room-reply-form .goksorry-room-input-label",
      ".theme-shell-excel .goksorry-room-reply-form input",
      ".theme-shell-excel .goksorry-room-reply-form .goksorry-room-nickname-label",
      ".theme-shell-excel .goksorry-room-reply-form .goksorry-room-count"
    ]);
    expectExcelGridAligned(roomMetrics);
  });

  test("goksorry room guest nickname is required and reused for entries and replies", async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 760 });
    await prepareThemePage(page);

    let entryPostBody: Record<string, unknown> | null = null;
    let replyPostBody: Record<string, unknown> | null = null;
    await page.route("**/api/goksorry-room**", async (route) => {
      const request = route.request();
      const requestUrl = new URL(request.url());
      const method = request.method();

      if (requestUrl.pathname.endsWith("/api/goksorry-room/entries") && method === "POST") {
        entryPostBody = JSON.parse(request.postData() ?? "{}") as Record<string, unknown>;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            entry: {
              id: "entry-created",
              content: entryPostBody.content,
              author_kind: "guest",
              author_label: entryPostBody.guest_nickname,
              created_at: "2026-05-18T01:00:00.000Z",
              reply_count: 0,
              can_delete: true,
              is_mine: true,
              replies: []
            }
          })
        });
        return;
      }

      if (requestUrl.pathname.endsWith("/api/goksorry-room/replies") && method === "POST") {
        replyPostBody = JSON.parse(request.postData() ?? "{}") as Record<string, unknown>;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            reply: {
              id: "reply-created",
              entry_id: replyPostBody.entry_id,
              content: replyPostBody.content,
              author_kind: "guest",
              author_label: replyPostBody.guest_nickname,
              created_at: "2026-05-18T01:01:00.000Z",
              can_delete: true,
              is_mine: true
            }
          })
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          viewer: { kind: "guest" },
          entries: [
            {
              id: "entry-base",
              content: "기존 익명 의견",
              author_kind: "guest",
              author_label: "기존닉",
              created_at: "2026-05-18T00:00:00.000Z",
              reply_count: 0,
              can_delete: false,
              is_mine: false,
              replies: []
            }
          ],
          next_cursor: null
        })
      });
    });

    await page.goto("/goksorry-room");
    const entryForm = page.locator(".goksorry-room-entry-form");
    await expect(entryForm.locator(".goksorry-room-nickname-label input")).toBeVisible();
    await expect(entryForm.locator(".goksorry-room-nickname-label input")).toHaveAttribute("maxlength", "10");
    await entryForm.locator(".goksorry-room-input-label input").fill("익명 글");
    await expect(entryForm.locator("button[type='submit']")).toBeDisabled();
    await entryForm.locator(".goksorry-room-nickname-label input").fill("개미");
    await expect(entryForm.locator("button[type='submit']")).toBeEnabled();
    await entryForm.locator("button[type='submit']").click();

    await expect.poll(() => entryPostBody).toEqual({
      content: "익명 글",
      guest_nickname: "개미"
    });
    const createdEntry = page.locator(".goksorry-room-entry").first();
    await expect(createdEntry.locator(".goksorry-room-author-name")).toHaveText("개미");
    await expect(createdEntry.locator(".goksorry-room-guest-marker")).toHaveText("*");
    const createdAuthorWeight = await createdEntry
      .locator(".goksorry-room-author-name")
      .evaluate((element) => Number.parseInt(window.getComputedStyle(element).fontWeight, 10));
    expect(createdAuthorWeight).toBeGreaterThanOrEqual(700);
    await expect
      .poll(async () =>
        page.evaluate((cookieName) => {
          const entry = document.cookie
            .split(";")
            .map((part) => part.trim())
            .find((part) => part.startsWith(`${cookieName}=`));
          return entry ? decodeURIComponent(entry.slice(cookieName.length + 1)) : null;
        }, "goksorry_guest_chat_nickname")
      )
      .toBe("개미");

    await createdEntry.getByRole("button", { name: "덧글 0" }).click();
    const replyForm = createdEntry.locator(".goksorry-room-reply-form");
    await replyForm.locator(".goksorry-room-input-label input").fill("익명 덧글");
    await replyForm.locator("button[type='submit']").click();
    await expect.poll(() => replyPostBody).toEqual({
      entry_id: "entry-created",
      content: "익명 덧글",
      guest_nickname: "개미"
    });
    await expect(createdEntry.locator(".goksorry-room-reply .goksorry-room-author-name")).toHaveText("개미");
    await expect(createdEntry.locator(".goksorry-room-reply .goksorry-room-guest-marker")).toHaveText("*");
  });

  test("goksorry room guest nickname defaults from chat nickname payload", async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 760 });
    await prepareThemePage(page);

    const entryPostBodies: Record<string, unknown>[] = [];
    await page.route("**/api/goksorry-room**", async (route) => {
      const request = route.request();
      const requestUrl = new URL(request.url());
      const method = request.method();

      if (requestUrl.pathname.endsWith("/api/goksorry-room/entries") && method === "POST") {
        const entryPostBody = JSON.parse(request.postData() ?? "{}") as Record<string, unknown>;
        entryPostBodies.push(entryPostBody);
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            entry: {
              id: `entry-created-${entryPostBodies.length}`,
              content: entryPostBody.content,
              author_kind: "guest",
              author_label: entryPostBody.guest_nickname,
              created_at: "2026-05-18T01:00:00.000Z",
              reply_count: 0,
              can_delete: true,
              is_mine: true,
              replies: []
            }
          })
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          viewer: {
            kind: "guest",
            default_guest_nickname: "채팅닉"
          },
          entries: [],
          next_cursor: null
        })
      });
    });

    await page.goto("/goksorry-room");
    const entryForm = page.locator(".goksorry-room-entry-form");
    const nicknameInput = entryForm.locator(".goksorry-room-nickname-label input");
    const contentInput = entryForm.locator(".goksorry-room-input-label input");
    const submitButton = entryForm.locator("button[type='submit']");

    await expect(nicknameInput).toHaveValue("채팅닉");
    await contentInput.fill("기본 닉 글");
    await expect(submitButton).toBeEnabled();
    await submitButton.click();
    await expect.poll(() => entryPostBodies[0]).toEqual({
      content: "기본 닉 글",
      guest_nickname: "채팅닉"
    });

    await nicknameInput.fill("수정닉");
    await contentInput.fill("수정 닉 글");
    await submitButton.click();
    await expect.poll(() => entryPostBodies[1]).toEqual({
      content: "수정 닉 글",
      guest_nickname: "수정닉"
    });
  });

  test("goksorry room author markers distinguish guest, owner, and admin-delete rows", async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 760 });
    await prepareThemePage(page);
    await page.route("**/api/goksorry-room**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          viewer: { kind: "member" },
          entries: [
            {
              id: "entry-admin-delete",
              content: "관리자는 삭제할 수 있지만 내 글은 아닙니다.",
              author_kind: "guest",
              author_label: "손님",
              created_at: "2026-05-18T00:00:00.000Z",
              reply_count: 0,
              can_delete: true,
              is_mine: false,
              replies: []
            },
            {
              id: "entry-mine",
              content: "내 회원 글입니다.",
              author_kind: "member",
              author_label: "내닉",
              created_at: "2026-05-18T00:01:00.000Z",
              reply_count: 0,
              can_delete: true,
              is_mine: true,
              replies: []
            }
          ],
          next_cursor: null
        })
      });
    });

    await page.goto("/goksorry-room");
    await expect(page.locator(".goksorry-room-nickname-label")).toHaveCount(0);
    await expect(page.locator(".goksorry-room-entry")).toHaveCount(2);
    const guestEntry = page.locator(".goksorry-room-entry").first();
    const mineEntry = page.locator(".goksorry-room-entry").nth(1);
    await expect(guestEntry.locator(".goksorry-room-guest-marker")).toHaveText("*");
    await expect(guestEntry.getByRole("button", { name: "삭제" })).toBeVisible();
    await expect(mineEntry.locator(".goksorry-room-guest-marker")).toHaveCount(0);

    const weights = await page.evaluate(() => {
      const read = (selector: string) =>
        Number.parseInt(window.getComputedStyle(document.querySelector(selector) as HTMLElement).fontWeight, 10);
      return {
        guest: read(".goksorry-room-entry:first-child .goksorry-room-author-name"),
        mine: read(".goksorry-room-entry:nth-child(2) .goksorry-room-author-name")
      };
    });
    expect(weights.mine).toBeGreaterThanOrEqual(700);
    expect(weights.guest).toBeLessThan(weights.mine);
  });

  test("excel mobile room guest forms split input and nickname footer without overflow", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await prepareThemePage(page);
    await page.route("**/api/goksorry-room**", async (route) => {
      const requestUrl = new URL(route.request().url());
      if (requestUrl.pathname.endsWith("/api/goksorry-room/replies")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            replies: [
              {
                id: "reply-excel-mobile-1",
                entry_id: "entry-excel-mobile-1",
                content: "엑셀 모바일 답글 입력 폼 검증입니다.",
                author_kind: "guest",
                author_label: "응답자",
                created_at: "2026-05-16T00:01:00.000Z",
                can_delete: false
              }
            ]
          })
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          entries: [
            {
              id: "entry-excel-mobile-1",
              content: "엑셀 모바일 곡소리방 입력 폼 검증입니다.",
              author_kind: "guest",
              author_label: "테스터",
              created_at: "2026-05-16T00:00:00.000Z",
              reply_count: 1,
              can_delete: false,
              replies: []
            }
          ],
          next_cursor: null
        })
      });
    });

    const readMobileFormLayout = async (selector: string) =>
      page.locator(selector).evaluate((formElement) => {
        const form = formElement as HTMLElement;
        const documentElement = document.querySelector("[data-testid='theme-content-document']") as HTMLElement;
        const columnWidth = Number.parseFloat(window.getComputedStyle(documentElement).getPropertyValue("--excel-column-width"));
        const inputLabel = form.querySelector(".goksorry-room-input-label") as HTMLElement;
        const input = inputLabel.querySelector("input") as HTMLElement;
        const footer = form.querySelector(".goksorry-room-form-footer") as HTMLElement;
        const count = footer.querySelector(".goksorry-room-count") as HTMLElement;
        const nickname = footer.querySelector(".goksorry-room-nickname-label") as HTMLElement;
        const nicknameInput = nickname.querySelector("input") as HTMLElement;
        const button = footer.querySelector("button") as HTMLElement;
        const rect = (element: HTMLElement) => element.getBoundingClientRect();
        const inputStyle = window.getComputedStyle(input);
        const nicknameStyle = window.getComputedStyle(nicknameInput);
        const buttonStyle = window.getComputedStyle(button);

        return {
          columnWidth,
          formWidth: rect(form).width,
          formScrollWidth: form.scrollWidth,
          formClientWidth: form.clientWidth,
          inputLabelWidth: rect(inputLabel).width,
          inputWidth: rect(input).width,
          inputHeight: rect(input).height,
          footerWidth: rect(footer).width,
          footerLeft: rect(footer).left,
          footerRight: rect(footer).right,
          footerDisplay: window.getComputedStyle(footer).display,
          countLeft: rect(count).left,
          countRight: rect(count).right,
          nicknameWidth: rect(nickname).width,
          nicknameInputWidth: rect(nicknameInput).width,
          nicknameLeft: rect(nickname).left,
          nicknameRight: rect(nickname).right,
          buttonLeft: rect(button).left,
          buttonRight: rect(button).right,
          buttonHeight: rect(button).height,
          inputFontSize: Number.parseFloat(inputStyle.fontSize),
          nicknameFontSize: Number.parseFloat(nicknameStyle.fontSize),
          buttonFontSize: Number.parseFloat(buttonStyle.fontSize)
        };
      });
    const expectMobileFormCells = (layout: Awaited<ReturnType<typeof readMobileFormLayout>>) => {
      expect(layout.formWidth).toBeLessThanOrEqual(layout.columnWidth * 4 + 2);
      expect(Math.abs(layout.inputLabelWidth - layout.footerWidth)).toBeLessThanOrEqual(2);
      expect(Math.abs(layout.inputWidth - layout.inputLabelWidth)).toBeLessThanOrEqual(1);
      expect(layout.footerDisplay).toBe("grid");
      expect(layout.countLeft).toBeGreaterThanOrEqual(layout.footerLeft - 1);
      expect(layout.countRight).toBeLessThanOrEqual(layout.footerRight + 1);
      expect(layout.nicknameLeft).toBeGreaterThanOrEqual(layout.footerLeft - 1);
      expect(layout.nicknameRight).toBeLessThanOrEqual(layout.footerRight + 1);
      expect(layout.nicknameInputWidth).toBeLessThanOrEqual(layout.nicknameWidth + 1);
      expect(layout.buttonLeft).toBeGreaterThanOrEqual(layout.footerLeft - 1);
      expect(layout.buttonRight).toBeLessThanOrEqual(layout.footerRight + 1);
      expect(layout.buttonHeight).toBeLessThan(layout.inputHeight);
      expect(layout.nicknameFontSize).toBeLessThan(layout.inputFontSize);
      expect(layout.buttonFontSize).toBeLessThan(layout.inputFontSize);
      expect(layout.formScrollWidth).toBeLessThanOrEqual(layout.formClientWidth + 1);
    };

    await page.goto("/goksorry-room?theme=excel-light");
    await expect(page.locator("html")).toHaveAttribute("data-theme-shell", "excel");
    await expect(page.locator(".theme-shell-excel .goksorry-room-entry")).toHaveCount(1);
    await page.getByRole("button", { name: "덧글 1" }).click();
    await expect(page.locator(".theme-shell-excel .goksorry-room-reply-form")).toBeVisible();

    expectMobileFormCells(await readMobileFormLayout(".theme-shell-excel .goksorry-room-entry-form"));
    expectMobileFormCells(await readMobileFormLayout(".theme-shell-excel .goksorry-room-reply-form"));
  });

  test("goksorry room infinite scroll appends entries inside the list region across themes", async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 760 });
    await prepareThemePage(page);
    await page.route("**/api/goksorry-room**", async (route) => {
      const requestUrl = new URL(route.request().url());
      const cursor = requestUrl.searchParams.get("cursor");
      const entries =
        cursor === "cursor-2"
          ? Array.from({ length: 3 }, (_, index) => buildRoomEntry(`page-2-${index + 1}`, index + 41))
          : Array.from({ length: 40 }, (_, index) => buildRoomEntry(`page-1-${index + 1}`, index + 1));

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          entries,
          next_cursor: cursor === "cursor-2" ? null : "cursor-2"
        })
      });
    });

    for (const item of roomThemeCases) {
      await page.goto(item.url);
      if (item.shell === "default") {
        await expect(page.locator("html")).toHaveAttribute("data-theme-shell", "default");
      } else {
        await expect(page.getByTestId("program-shell")).toHaveAttribute("data-program-shell", item.shell);
      }

      const entrySelector = roomSelector(item.root, ".goksorry-room-entry");
      const listRegion = page.locator(roomSelector(item.root, ".goksorry-room-list-region")).first();
      await expect(page.locator(entrySelector)).toHaveCount(40);
      await expect(listRegion).toBeVisible();

      const listMetrics = await listRegion.evaluate((element) => ({
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight,
        windowScrollHeight: document.documentElement.scrollHeight,
        windowClientHeight: document.documentElement.clientHeight
      }));
      expect(listMetrics.scrollHeight).toBeGreaterThan(listMetrics.clientHeight);

      await listRegion.evaluate((element) => {
        element.scrollTop = element.scrollHeight;
      });
      await expect(page.locator(entrySelector)).toHaveCount(43);
    }
  });

  test("goksorry room mobile puts entry and reply content above meta rows across themes", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await prepareThemePage(page);
    const entryContent =
      "모바일 곡소리방 긴 의견은 첫 번째 줄 영역에서 여러 줄로 자연스럽게 이어지고 작성자와 날짜와 버튼들은 아래 줄에 모여야 합니다.";
    const replyContent =
      "모바일 답글도 긴 문장이 내용 영역에서 여러 줄로 표시되고 작성자와 날짜와 삭제 버튼은 그 아래 줄에 표시되어야 합니다.";

    await page.route("**/api/goksorry-room**", async (route) => {
      const requestUrl = new URL(route.request().url());
      if (requestUrl.pathname.endsWith("/api/goksorry-room/replies")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            replies: [
              {
                id: "reply-mobile-1",
                entry_id: "entry-mobile-1",
                content: replyContent,
                author_kind: "guest",
                author_label: "답글작성자",
                created_at: "2026-05-17T01:01:00.000Z",
                can_delete: true
              }
            ]
          })
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          entries: [
            {
              id: "entry-mobile-1",
              content: entryContent,
              author_kind: "guest",
              author_label: "작성자",
              created_at: "2026-05-17T01:00:00.000Z",
              reply_count: 1,
              can_delete: true,
              replies: []
            }
          ],
          next_cursor: null
        })
      });
    });

    const readEntryMobileLayout = async (root: string) =>
      page.locator(roomSelector(root, ".goksorry-room-entry")).first().evaluate((entry) => {
        const content = entry.querySelector(".goksorry-room-entry-main > p") as HTMLElement;
        const meta = entry.querySelector(".goksorry-room-entry-main .goksorry-room-meta") as HTMLElement;
        const actions = entry.querySelector(".goksorry-room-actions") as HTMLElement;
        const time = meta.querySelector("time") as HTMLElement;
        const contentRect = content.getBoundingClientRect();
        const metaRect = meta.getBoundingClientRect();
        const actionsRect = actions.getBoundingClientRect();
        const contentStyle = window.getComputedStyle(content);
        const range = document.createRange();
        range.selectNodeContents(content);
        const contentLineCount = Array.from(range.getClientRects()).filter(
          (rect) => rect.width > 0 && rect.height > 0
        ).length;
        range.detach();

        return {
          contentLineCount,
          contentWhiteSpace: contentStyle.whiteSpace,
          contentTextOverflow: contentStyle.textOverflow,
          contentBottom: contentRect.bottom,
          metaTop: metaRect.top,
          actionsTop: actionsRect.top,
          metaCenterY: metaRect.top + metaRect.height / 2,
          actionsCenterY: actionsRect.top + actionsRect.height / 2,
          timeDisplay: window.getComputedStyle(time).display,
          scrollWidth: entry.scrollWidth,
          clientWidth: entry.clientWidth
        };
      });
    const readReplyMobileLayout = async (root: string) =>
      page.locator(roomSelector(root, ".goksorry-room-reply")).first().evaluate((reply) => {
        const content = reply.querySelector("p") as HTMLElement;
        const meta = reply.querySelector(".goksorry-room-meta") as HTMLElement;
        const time = meta.querySelector("time") as HTMLElement;
        const contentRect = content.getBoundingClientRect();
        const metaRect = meta.getBoundingClientRect();
        const contentStyle = window.getComputedStyle(content);
        const range = document.createRange();
        range.selectNodeContents(content);
        const contentLineCount = Array.from(range.getClientRects()).filter(
          (rect) => rect.width > 0 && rect.height > 0
        ).length;
        range.detach();

        return {
          contentLineCount,
          contentWhiteSpace: contentStyle.whiteSpace,
          contentTextOverflow: contentStyle.textOverflow,
          contentBottom: contentRect.bottom,
          metaTop: metaRect.top,
          timeDisplay: window.getComputedStyle(time).display,
          scrollWidth: reply.scrollWidth,
          clientWidth: reply.clientWidth
        };
      });

    for (const item of roomThemeCases) {
      await page.goto(item.url);
      if (item.shell === "default") {
        await expect(page.locator("html")).toHaveAttribute("data-theme-shell", "default");
      } else {
        await expect(page.getByTestId("program-shell")).toHaveAttribute("data-program-shell", item.shell);
      }

      await expect(page.locator(roomSelector(item.root, ".goksorry-room-entry"))).toHaveCount(1);
      await page
        .locator(roomSelector(item.root, ".goksorry-room-actions"))
        .getByRole("button", { name: "덧글 1" })
        .click();
      await expect(page.locator(roomSelector(item.root, ".goksorry-room-reply"))).toHaveCount(1);

      const entryLayout = await readEntryMobileLayout(item.root);
      expect(entryLayout.contentWhiteSpace).not.toBe("nowrap");
      expect(entryLayout.contentTextOverflow).not.toBe("ellipsis");
      expect(entryLayout.contentLineCount).toBeGreaterThanOrEqual(2);
      expect(Math.min(entryLayout.metaTop, entryLayout.actionsTop)).toBeGreaterThanOrEqual(entryLayout.contentBottom - 1);
      expect(Math.abs(entryLayout.metaCenterY - entryLayout.actionsCenterY)).toBeLessThanOrEqual(14);
      expect(entryLayout.timeDisplay).not.toBe("none");
      expect(entryLayout.scrollWidth).toBeLessThanOrEqual(entryLayout.clientWidth + 1);

      const replyLayout = await readReplyMobileLayout(item.root);
      expect(replyLayout.contentWhiteSpace).not.toBe("nowrap");
      expect(replyLayout.contentTextOverflow).not.toBe("ellipsis");
      expect(replyLayout.contentLineCount).toBeGreaterThanOrEqual(2);
      expect(replyLayout.metaTop).toBeGreaterThanOrEqual(replyLayout.contentBottom - 1);
      expect(replyLayout.timeDisplay).not.toBe("none");
      expect(replyLayout.scrollWidth).toBeLessThanOrEqual(replyLayout.clientWidth + 1);
    }
  });

  test("goksorry room load-more errors wait for manual retry instead of looping", async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 760 });
    await prepareThemePage(page);
    let cursorRequests = 0;

    await page.route("**/api/goksorry-room**", async (route) => {
      const requestUrl = new URL(route.request().url());
      const cursor = requestUrl.searchParams.get("cursor");

      if (cursor === "cursor-2") {
        cursorRequests += 1;
        if (cursorRequests === 1) {
          await route.fulfill({
            status: 500,
            contentType: "application/json",
            body: JSON.stringify({ error: "일시 실패" })
          });
          return;
        }
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          entries:
            cursor === "cursor-2"
              ? Array.from({ length: 3 }, (_, index) => buildRoomEntry(`retry-page-2-${index + 1}`, index + 31))
              : Array.from({ length: 30 }, (_, index) => buildRoomEntry(`retry-page-1-${index + 1}`, index + 1)),
          next_cursor: cursor === "cursor-2" ? null : "cursor-2"
        })
      });
    });

    await page.goto("/goksorry-room");
    await expect(page.locator(".goksorry-room-entry")).toHaveCount(30);

    const listRegion = page.locator(".goksorry-room-list-region").first();
    await listRegion.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    await expect(page.getByText("일시 실패")).toBeVisible();
    expect(cursorRequests).toBe(1);

    await page.waitForTimeout(250);
    expect(cursorRequests).toBe(1);

    await page.getByRole("button", { name: "다시 시도" }).click();
    await expect(page.locator(".goksorry-room-entry")).toHaveCount(33);
    expect(cursorRequests).toBe(2);
  });

  // Home overview geometry is covered by home-browser.spec.ts.

  // Home overview geometry is covered by home-browser.spec.ts.

  test("each concept theme has distinct chrome and no legacy header", async ({ page }, testInfo) => {
    const cases = [
      { theme: "docs-light", shell: "docs", locator: "docs-sidebar" },
      { theme: "vscode-dark", shell: "vscode", locator: "vscode-sidebar" }
    ];

    for (const item of cases) {
      await prepareThemePage(page);
      await page.goto(`/auth/login?theme=${item.theme}`);

      await expect(page.locator("html")).toHaveAttribute("data-theme-id", item.theme);
      await expect(page.locator("html")).toHaveAttribute("data-theme-shell", item.shell);
      await expectConceptHeaderReplacesSiteHeader(page, item.shell);
      await expectConceptHeaderFixed(page);
      await expect(page.getByTestId(item.locator)).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath(`${item.theme}.png`), fullPage: false });
    }
  });

  test("chat moves to an open desktop right sidebar when chat env is enabled", async ({ page }) => {
    test.skip(!CHAT_LAYOUT_ENABLED, "desktop chat sidebar requires CHAT_WS_BASE_URL in the test server env");
    await mockGuestChatSession(page);

    const cases = [
      { theme: "light", shell: "default" },
      { theme: "excel-light", shell: "excel" },
      { theme: "docs-light", shell: "docs" },
      { theme: "vscode-dark", shell: "vscode" }
    ];

    for (const item of cases) {
      await page.setViewportSize({ width: 1180, height: 760 });
      await prepareThemePage(page);
      await page.goto(`/auth/login?theme=${item.theme}`);

      await expect(page.locator("html")).toHaveAttribute("data-theme-shell", item.shell);
      await expect(page.getByRole("link", { name: "채팅" })).toHaveCount(0);
      const sidebar = page.getByTestId("desktop-chat-sidebar");
      await expect(sidebar).toBeVisible();
      await expect(sidebar).toHaveAttribute("data-state", "open");
      await expect(sidebar.getByText("전체 채팅")).toBeVisible();
      await expect(page.locator(".chat-sidebar-live .chat-input-wrap textarea")).toHaveCount(0);
      await expect(page.locator(".chat-sidebar-live .chat-input-wrap input")).toHaveAttribute("maxlength", "100");
      await expect(page.locator(".chat-sidebar-live .chat-nickname-wrap input")).toHaveAttribute("maxlength", "10");
      await expect(page.locator(".chat-sidebar-live .chat-form-footer")).toContainText("0/100");

      const chatScroll = await page.evaluate(() => {
        const sidebar = document.querySelector("[data-testid='desktop-chat-sidebar']") as HTMLElement;
        const panel = document.querySelector(".chat-sidebar-panel") as HTMLElement;
        const live = document.querySelector(".chat-sidebar-live") as HTMLElement;
        const log = document.querySelector(".chat-sidebar-live .chat-log") as HTMLElement;

        return {
          sidebarOverflowY: window.getComputedStyle(sidebar).overflowY,
          panelOverflowY: window.getComputedStyle(panel).overflowY,
          liveOverflowY: window.getComputedStyle(live).overflowY,
          logOverflowY: window.getComputedStyle(log).overflowY,
          liveHeight: live.getBoundingClientRect().height,
          logHeight: log.getBoundingClientRect().height
        };
      });
      expect(chatScroll.sidebarOverflowY).toBe("hidden");
      expect(chatScroll.panelOverflowY).toBe("hidden");
      expect(chatScroll.liveOverflowY).toBe("hidden");
      expect(chatScroll.logOverflowY).toBe("auto");
      expect(chatScroll.logHeight).toBeGreaterThan(0);
      expect(chatScroll.logHeight).toBeLessThan(chatScroll.liveHeight);

      const layoutSeparation = await page.evaluate((shell) => {
        const sidebar = document.querySelector("[data-testid='desktop-chat-sidebar']") as HTMLElement;

        if (shell === "default") {
          const workspace = document.querySelector(".default-chat-workspace") as HTMLElement;
          const content = document.querySelector(".default-chat-content") as HTMLElement;
          const scrollingElement = document.scrollingElement as HTMLElement;
          const sidebarTopBefore = sidebar.getBoundingClientRect().top;
          scrollingElement.scrollTop = Math.min(400, scrollingElement.scrollHeight - scrollingElement.clientHeight);
          content.scrollTop = Math.min(400, content.scrollHeight - content.clientHeight);
          const sidebarTopAfter = sidebar.getBoundingClientRect().top;

          return {
            contentContainsSidebar: content.contains(sidebar),
            sidebarParentIsWorkspace: sidebar.parentElement === workspace,
            documentScrollable: scrollingElement.scrollHeight > scrollingElement.clientHeight + 1,
            documentScrollTopAfter: scrollingElement.scrollTop,
            contentScrollable: content.scrollHeight > content.clientHeight + 1,
            contentScrollTopAfter: content.scrollTop,
            workspaceOverflowY: window.getComputedStyle(workspace).overflowY,
            contentOverflowY: window.getComputedStyle(content).overflowY,
            contentFrameContainsSidebar: false,
            sidebarTopDelta: sidebarTopAfter - sidebarTopBefore
          };
        }

        const workspace = sidebar.closest(".theme-shell-workspace") as HTMLElement;
        const contentFrame = document.querySelector(".theme-shell-content-frame") as HTMLElement;

        return {
          contentContainsSidebar: false,
          sidebarParentIsWorkspace: sidebar.parentElement === workspace,
          documentScrollable: false,
          documentScrollTopAfter: 0,
          contentScrollable: false,
          contentScrollTopAfter: 0,
          workspaceOverflowY: window.getComputedStyle(workspace).overflowY,
          contentOverflowY: window.getComputedStyle(contentFrame).overflowY,
          contentFrameContainsSidebar: contentFrame.contains(sidebar),
          sidebarTopDelta: 0
        };
      }, item.shell);
      expect(layoutSeparation.contentContainsSidebar).toBe(false);
      expect(layoutSeparation.contentFrameContainsSidebar).toBe(false);
      expect(layoutSeparation.sidebarParentIsWorkspace).toBe(true);
      if (item.shell === "default") {
        expect(layoutSeparation.documentScrollable).toBe(false);
        expect(layoutSeparation.documentScrollTopAfter).toBe(0);
        expect(layoutSeparation.contentScrollable).toBe(true);
        expect(layoutSeparation.contentScrollTopAfter).toBeGreaterThan(0);
        expect(layoutSeparation.workspaceOverflowY).toBe("hidden");
        expect(layoutSeparation.contentOverflowY).toBe("auto");
        expect(Math.abs(layoutSeparation.sidebarTopDelta)).toBeLessThanOrEqual(1);
      } else {
        expect(layoutSeparation.documentScrollable).toBe(false);
        expect(layoutSeparation.workspaceOverflowY).toBe("hidden");
        expect(layoutSeparation.contentOverflowY).toBe("auto");
      }
    }

    const sidebar = page.getByTestId("desktop-chat-sidebar");
    await sidebar.getByRole("button", { name: "채팅 사이드바 닫기" }).click({ force: true });
    await expect(sidebar).toHaveAttribute("data-state", "collapsed");
    await expect
      .poll(async () => page.evaluate(() => window.localStorage.getItem("goksorry-chat-sidebar-state")))
      .toBe("collapsed");
    await page.reload();
    await expect(page.getByTestId("desktop-chat-sidebar")).toHaveAttribute("data-state", "collapsed");

    await sidebar.getByRole("button", { name: "채팅 사이드바 열기" }).click({ force: true });
    await expect(page.getByTestId("desktop-chat-sidebar")).toHaveAttribute("data-state", "open");
    await expect
      .poll(async () => page.evaluate(() => window.localStorage.getItem("goksorry-chat-sidebar-state")))
      .toBe("open");
    await page.reload();
    await expect(page.getByTestId("desktop-chat-sidebar")).toHaveAttribute("data-state", "open");
  });

  test("chat keeps an opaque bottom fab overlay in mobile concept themes", async ({ page }) => {
    test.skip(!CHAT_LAYOUT_ENABLED, "mobile chat dock requires CHAT_WS_BASE_URL in the test server env");
    await mockGuestChatSession(page);

    await page.setViewportSize({ width: 390, height: 844 });
    await prepareThemePage(page);

    const cases = [
      { theme: "excel-light", shell: "excel" },
      { theme: "docs-light", shell: "docs" },
      { theme: "vscode-dark", shell: "vscode" }
    ];

    for (const item of cases) {
      await page.goto(`/auth/login?theme=${item.theme}`);

      await expect(page.locator("html")).toHaveAttribute("data-theme-shell", item.shell);
      await expect(page.getByTestId("desktop-chat-sidebar")).toHaveCount(0);
      const chatToggle = page.getByRole("button", { name: "실시간 채팅" });
      await expect(chatToggle).toBeVisible();
      await expect(chatToggle).toHaveText("💬");

      const chatToggleMetrics = await chatToggle.evaluate((button) => {
        const bounds = button.getBoundingClientRect();
        const style = window.getComputedStyle(button);

        return {
          width: bounds.width,
          height: bounds.height,
          rightOffset: window.innerWidth - bounds.right,
          bottomOffset: window.innerHeight - bounds.bottom,
          borderRadius: Number.parseFloat(style.borderTopLeftRadius),
          position: style.position
        };
      });
      expect(Math.abs(chatToggleMetrics.width - chatToggleMetrics.height)).toBeLessThanOrEqual(1);
      expect(chatToggleMetrics.width).toBeLessThanOrEqual(56);
      expect(chatToggleMetrics.borderRadius).toBeGreaterThanOrEqual(chatToggleMetrics.width / 2);
      expect(chatToggleMetrics.rightOffset).toBeGreaterThan(0);
      expect(chatToggleMetrics.bottomOffset).toBeGreaterThan(0);
      expect(chatToggleMetrics.position).toBe("fixed");

      await chatToggle.click();
      await expect(page.locator("#global-chat-dock")).toBeVisible();
      await expect(page.locator("#global-chat-dock").getByText("전체 채팅")).toBeVisible();
      await expect(page.locator(".chat-dock-live .chat-input-wrap textarea")).toHaveCount(0);
      await expect(page.locator(".chat-dock-live .chat-input-wrap input")).toHaveAttribute("maxlength", "100");
      await expect(page.locator(".chat-dock-live .chat-nickname-wrap input")).toHaveAttribute("maxlength", "10");
      await expect(page.locator(".chat-dock-live .chat-form-footer")).toContainText("0/100");

      const mobileChatScroll = await page.evaluate(() => {
        const panel = document.querySelector("#global-chat-dock") as HTMLElement;
        const live = document.querySelector(".chat-dock-live") as HTMLElement;
        const log = document.querySelector(".chat-dock-live .chat-log") as HTMLElement;
        const panelStyle = window.getComputedStyle(panel);
        const backgroundColor = panelStyle.backgroundColor;
        const backgroundChannels = backgroundColor.match(/[\d.]+/g)?.map(Number) ?? [];

        return {
          panelBackgroundColor: backgroundColor,
          panelBackgroundAlpha: backgroundChannels.length >= 4 ? backgroundChannels[3] : 1,
          panelOverflowY: panelStyle.overflowY,
          liveOverflowY: window.getComputedStyle(live).overflowY,
          logOverflowY: window.getComputedStyle(log).overflowY,
          panelHeight: panel.getBoundingClientRect().height,
          logHeight: log.getBoundingClientRect().height
        };
      });
      expect(mobileChatScroll.panelBackgroundColor).not.toBe("rgba(0, 0, 0, 0)");
      expect(mobileChatScroll.panelBackgroundAlpha).toBe(1);
      expect(mobileChatScroll.panelOverflowY).toBe("hidden");
      expect(mobileChatScroll.liveOverflowY).toBe("hidden");
      expect(mobileChatScroll.logOverflowY).toBe("auto");
      expect(mobileChatScroll.logHeight).toBeGreaterThan(0);
      expect(mobileChatScroll.logHeight).toBeLessThan(mobileChatScroll.panelHeight);
    }
  });

  test("VS Code left rail buttons use brighter restrained chrome", async ({ page }) => {
    await prepareThemePage(page);
    await page.goto("/auth/login?theme=vscode-dark");

    const vscodeRailChrome = await page.locator(".vscode-activity-bar").evaluate((bar) => {
      const active = bar.querySelector(".theme-shell-active") as HTMLElement;
      const inactive = Array.from(bar.querySelectorAll("button")).find((button) => button !== active) as HTMLElement;
      const activeStyle = window.getComputedStyle(active);
      const inactiveStyle = window.getComputedStyle(inactive);
      const barStyle = window.getComputedStyle(bar);
      const shellStyle = window.getComputedStyle(document.querySelector(".theme-shell-vscode") as Element);
      const brightness = (value: string) => {
        const channels = value.match(/\d+(\.\d+)?/g)?.slice(0, 3).map(Number) ?? [0, 0, 0];
        return channels.reduce((sum, channel) => sum + channel, 0);
      };

      return {
        barBackgroundImage: barStyle.backgroundImage,
        barBrightness: brightness(barStyle.backgroundColor),
        shellBrightness: brightness(shellStyle.backgroundColor),
        activeBackground: activeStyle.backgroundColor,
        activeColor: activeStyle.color,
        activeShadow: activeStyle.boxShadow,
        inactiveBackground: inactiveStyle.backgroundColor,
        inactiveColor: inactiveStyle.color
      };
    });
    expect(vscodeRailChrome.barBackgroundImage).toBe("none");
    expect(vscodeRailChrome.barBrightness).toBeGreaterThan(vscodeRailChrome.shellBrightness);
    expect(vscodeRailChrome.activeBackground).not.toBe(vscodeRailChrome.inactiveBackground);
    expect(vscodeRailChrome.activeColor).not.toBe(vscodeRailChrome.inactiveColor);
    expect(vscodeRailChrome.activeShadow).not.toBe("none");
  });

  test("concept theme section colors follow product chrome references", async ({ page }) => {
    await prepareThemePage(page);

    await page.goto("/auth/login?theme=excel-light");
    expect(await readRootThemeVars(page, ["--brand", "--bg", "--panel-soft"])).toMatchObject({
      "--brand": "#217346",
      "--bg": "#f3f2f1",
      "--panel-soft": "#f6f8f7"
    });
    await expect.poll(async () => page.locator(".excel-titlebar").evaluate((element) => getComputedStyle(element).backgroundColor)).toBe(
      "rgb(248, 248, 248)"
    );
    await expect.poll(async () => page.locator(".excel-ribbon").evaluate((element) => getComputedStyle(element).backgroundColor)).toBe(
      "rgb(255, 255, 255)"
    );
    await expect.poll(async () => page.locator(".excel-content-frame").evaluate((element) => getComputedStyle(element).backgroundColor)).toBe(
      "rgb(255, 255, 255)"
    );

    await page.goto("/auth/login?theme=docs-light");
    expect(await readRootThemeVars(page, ["--brand", "--bg", "--panel-soft", "--ink"])).toMatchObject({
      "--brand": "#1a73e8",
      "--bg": "#f8fafd",
      "--panel-soft": "#edf2fa",
      "--ink": "#202124"
    });
    const docsChrome = await page.evaluate(() => ({
      header: getComputedStyle(document.querySelector(".docs-app-header") as HTMLElement).backgroundColor,
      toolbarPill: getComputedStyle(document.querySelector(".docs-tool-finder") as HTMLElement).backgroundColor,
      outline: getComputedStyle(document.querySelector(".docs-outline") as HTMLElement).backgroundColor,
      editor: getComputedStyle(document.querySelector(".docs-content-frame") as HTMLElement).backgroundColor,
      page: getComputedStyle(document.querySelector(".theme-shell-docs .theme-shell-content-document") as HTMLElement).backgroundColor
    }));
    expect(docsChrome).toMatchObject({
      header: "rgb(255, 255, 255)",
      toolbarPill: "rgb(237, 242, 250)",
      outline: "rgb(255, 255, 255)",
      editor: "rgb(241, 243, 244)",
      page: "rgb(255, 255, 255)"
    });

    await page.goto("/auth/login?theme=vscode-light");
    expect(await readRootThemeVars(page, ["--brand", "--vscode-activity-bg", "--vscode-side-bar-bg", "--vscode-editor-bg"])).toMatchObject({
      "--brand": "#007acc",
      "--vscode-activity-bg": "#2c2c2c",
      "--vscode-side-bar-bg": "#f3f3f3",
      "--vscode-editor-bg": "#ffffff"
    });
    const vscodeChrome = await page.evaluate(() => ({
      activity: getComputedStyle(document.querySelector(".vscode-activity-bar") as HTMLElement).backgroundColor,
      explorer: getComputedStyle(document.querySelector(".vscode-explorer") as HTMLElement).backgroundColor,
      status: getComputedStyle(document.querySelector("[data-testid='program-status-bar']") as HTMLElement).backgroundColor
    }));
    expect(vscodeChrome).toMatchObject({
      activity: "rgb(44, 44, 44)",
      explorer: "rgb(243, 243, 243)",
      status: "rgb(0, 122, 204)"
    });
  });

  test("concept header action buttons use theme-specific chrome", async ({ page }) => {
    await prepareThemePage(page);
    await page.goto("/auth/login?theme=excel-light");
    const excelThemeButton = page.getByTestId("concept-header-actions").getByRole("button", { name: /테마 선택/ });
    const excelChrome = await excelThemeButton.evaluate((element) => {
      const style = window.getComputedStyle(element);
      return {
        backgroundColor: style.backgroundColor,
        borderRadius: style.borderRadius
      };
    });

    await page.goto("/auth/login?theme=vscode-dark");
    const vscodeThemeButton = page.getByTestId("concept-header-actions").getByRole("button", { name: /테마 선택/ });
    const vscodeChrome = await vscodeThemeButton.evaluate((element) => {
      const style = window.getComputedStyle(element);
      return {
        backgroundColor: style.backgroundColor,
        borderRadius: style.borderRadius
      };
    });

    await expect(vscodeThemeButton).toHaveText("🎨");
    expect(excelChrome.borderRadius).not.toBe(vscodeChrome.borderRadius);
    expect(excelChrome.backgroundColor).not.toBe(vscodeChrome.backgroundColor);
  });

  test("default themes use the system sans-serif font stack", async ({ page }) => {
    await prepareThemePage(page);

    for (const theme of ["light", "dark", "system"]) {
      await page.goto(`/auth/login?theme=${theme}`);
      const typography = await page.evaluate(() => {
        const rootStyle = getComputedStyle(document.documentElement);
        const bodyStyle = getComputedStyle(document.body);

        return {
          siteFont: rootStyle.getPropertyValue("--site-font").toLowerCase(),
          bodyFont: bodyStyle.fontFamily.toLowerCase(),
          bodyFontSize: bodyStyle.fontSize
        };
      });

      expect(typography.siteFont).toContain("apple sd gothic neo");
      expect(typography.siteFont).toContain("sans-serif");
      expect(typography.siteFont).not.toContain("gowun");
      expect(typography.bodyFont).not.toContain("gowun");
      expect(typography.bodyFontSize).toBe("15px");
    }
  });

  test("mobile concept theme menu opens outside header overflow", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await prepareThemePage(page);

    const cases = [
      { theme: "excel-light", shell: "excel" },
      { theme: "docs-light", shell: "docs" },
      { theme: "vscode-dark", shell: "vscode" }
    ];

    for (const item of cases) {
      await page.goto(`/auth/login?theme=${item.theme}`);
      await expect(page.getByTestId("program-shell")).toHaveAttribute("data-program-shell", item.shell);

      await page.getByTestId("concept-header-actions").getByRole("button", { name: /테마 선택/ }).click();
      const menu = page.getByRole("menu", { name: "테마 선택" });
      await expect(menu).toBeVisible();
      await expect(menu.getByText("테마", { exact: true })).toBeVisible();
      await expect(menu.getByText("색상", { exact: true })).toBeVisible();
      await expect(menu.getByRole("button", { name: "테마 Excel" })).toHaveText("Excel");
      await expect(menu.getByRole("button", { name: "테마 PowerPoint" })).toHaveCount(0);
      await expect(menu.getByRole("button", { name: "테마 JetBrains" })).toHaveCount(0);
      await expect(menu.getByRole("button", { name: "색상 라이트" })).toHaveText("라이트");
      await expect(menu.getByRole("button", { name: "색상 다크" })).toHaveText("다크");
      await expect(menu.getByRole("button", { name: "색상 시스템" })).toHaveText("시스템");
      await expect(menu.getByRole("button", { name: "적용" })).toBeVisible();
      await expect(menu.getByText("excel-light")).toHaveCount(0);
      await expect(menu.getByText("엑셀 라이트")).toHaveCount(0);

      const metrics = await menu.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const hitX = rect.left + Math.min(24, rect.width / 2);
        const hitY = rect.top + Math.min(24, rect.height / 2);
        const hit = document.elementFromPoint(hitX, hitY);

        return {
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
          left: rect.left,
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
          hitInside: hit ? element.contains(hit) : false
        };
      });

      expect(metrics.left).toBeGreaterThanOrEqual(0);
      expect(metrics.top).toBeGreaterThanOrEqual(0);
      expect(metrics.right).toBeLessThanOrEqual(metrics.viewportWidth);
      expect(metrics.bottom).toBeLessThanOrEqual(metrics.viewportHeight);
      expect(metrics.hitInside).toBe(true);

      await page.keyboard.press("Escape");
      await expect(menu).toHaveCount(0);
    }

    await page.goto("/auth/login?theme=excel-dark");
    await page.getByTestId("concept-header-actions").getByRole("button", { name: /테마 선택/ }).click();
    await page.getByRole("menu", { name: "테마 선택" }).getByRole("button", { name: "테마 Docs" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme-id", "excel-dark");
    await expect(page.getByRole("menu", { name: "테마 선택" })).toBeVisible();
    await page.getByRole("menu", { name: "테마 선택" }).getByRole("button", { name: "적용" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme-id", "docs-dark");
    await expect(page.getByRole("menu", { name: "테마 선택" })).toHaveCount(0);

    await page.getByTestId("concept-header-actions").getByRole("button", { name: /테마 선택/ }).click();
    await page.getByRole("menu", { name: "테마 선택" }).getByRole("button", { name: "색상 시스템" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme-id", "docs-dark");
    await expect(page.getByRole("menu", { name: "테마 선택" })).toBeVisible();
    await page.getByRole("menu", { name: "테마 선택" }).getByRole("button", { name: "적용" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme-id", "docs-system");
    await expect(page.getByRole("menu", { name: "테마 선택" })).toHaveCount(0);
  });

  test("mobile concept auth controls sit at the top right", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await prepareThemePage(page);

    const cases = [
      { theme: "excel-light", shell: "excel" },
      { theme: "docs-light", shell: "docs" },
      { theme: "vscode-dark", shell: "vscode" }
    ];

    for (const item of cases) {
      await page.goto(`/auth/login?theme=${item.theme}`);
      await expect(page.getByTestId("program-shell")).toHaveAttribute("data-program-shell", item.shell);

      const actions = page.getByTestId("concept-header-actions");
      const authButton = actions.getByRole("button", { name: "구글 로그인" });
      await expect(authButton).toBeVisible();
      await expect(actions.getByRole("button", { name: /테마 선택/ })).toBeVisible();
      await expect(actions.locator(".clean-filter-toggle")).toBeVisible();

      const metrics = await page.evaluate(() => {
        const header = document.querySelector("[data-testid='program-header']") as HTMLElement;
        const auth = document.querySelector(".theme-shell-auth-slot") as HTMLElement;
        const headerRect = header.getBoundingClientRect();
        const authRect = auth.getBoundingClientRect();

        return {
          authTopOffset: authRect.top - headerRect.top,
          authRightGap: headerRect.right - authRect.right,
          authLeft: authRect.left,
          headerLeft: headerRect.left,
          authWidth: authRect.width,
          authHeight: authRect.height
        };
      });

      expect(metrics.authTopOffset).toBeGreaterThanOrEqual(0);
      expect(metrics.authTopOffset).toBeLessThanOrEqual(14);
      expect(metrics.authRightGap).toBeGreaterThanOrEqual(0);
      expect(metrics.authRightGap).toBeLessThanOrEqual(12);
      expect(metrics.authLeft).toBeGreaterThanOrEqual(metrics.headerLeft);
      expect(metrics.authWidth).toBeGreaterThan(0);
      expect(metrics.authHeight).toBeGreaterThan(0);
    }

    await page.goto("/auth/login?theme=light");
    await expect(page.locator(".header")).toBeVisible();
    await expect(page.locator(".theme-shell-auth-slot")).toHaveCount(0);
    await expect(page.locator(".header").getByRole("button", { name: "구글 로그인" })).toBeVisible();
  });

  test("first visit setup hint replaces clean filter and theme dialogs", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await prepareSetupHintFirstVisitPage(page);
    await page.goto("/auth/login");

    await expect(page.getByRole("dialog", { name: "이쁜말 필터를 켤까요?" })).toHaveCount(0);
    await expect(page.getByRole("dialog", { name: "사이트 분위기를 고르세요." })).toHaveCount(0);

    const hint = page.getByRole("note", { name: "초기 설정 안내" });
    await expect(hint).toBeVisible();
    await expect(hint).toContainText("이쁜말필터와 테마는 여기서 바꿀 수 있어요.");
    await expect(page.locator(".header").getByRole("button", { name: /테마 선택/ })).toBeVisible();
    await expect(page.locator(".header").locator(".clean-filter-toggle")).toBeVisible();

    const hintPlacement = await readFirstVisitHintTargetMetrics(page);
    expect(hintPlacement.topGap).toBeGreaterThanOrEqual(-4);
    expect(hintPlacement.leftGap).toBeGreaterThanOrEqual(8);
    expect(hintPlacement.themeButtonLeftDelta).toBeLessThanOrEqual(8);
    expect(hintPlacement.pointerInsideControls).toBe(true);

    await hint.getByRole("button", { name: "초기 설정 안내 닫기" }).click();
    await expect(hint).toHaveCount(0);
    await expect
      .poll(async () =>
        page.evaluate(() => ({
          cleanFilterCookie: document.cookie.includes("goksorry-clean-filter=on"),
          themeStorage: window.localStorage.getItem("goksorry-theme")
        }))
      )
      .toEqual({
        cleanFilterCookie: true,
        themeStorage: "light"
      });

    await page.reload();
    await expect(page.getByRole("note", { name: "초기 설정 안내" })).toHaveCount(0);
  });

  test("desktop first visit setup hint points at theme controls before login", async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 760 });
    await prepareSetupHintFirstVisitPage(page);
    await page.goto("/auth/login");

    const hint = page.getByRole("note", { name: "초기 설정 안내" });
    await expect(hint).toBeVisible();
    await expect(page.locator(".header").getByRole("button", { name: /테마 선택/ })).toBeVisible();
    await expect(page.locator(".header").getByRole("button", { name: "구글 로그인" })).toBeVisible();

    const hintPlacement = await readFirstVisitHintTargetMetrics(page);
    expect(hintPlacement.topGap).toBeGreaterThanOrEqual(8);
    expect(hintPlacement.pointerToControlsCenter).toBeLessThanOrEqual(2);
    expect(hintPlacement.pointerInsideControls).toBe(true);
    expect(hintPlacement.themeLeftOfLogin).toBe(true);
    expect(hintPlacement.pointerLeftOfLogin).toBe(true);
  });

  test("VS Code concept theme renders page content as plain editor text", async ({ page }) => {
    await prepareThemePage(page);

    const cases = [{ theme: "vscode-dark", shell: "vscode", shellClass: "theme-shell-vscode" }];
    const readOverviewEditorLayout = async (shellClass: string) => {
      return page.evaluate((targetShellClass) => {
        const root = document.querySelector(`.${targetShellClass} .theme-shell-page .main`) as HTMLElement;
        const marketBlock = root.querySelector(".overview-market-block") as HTMLElement;
        const overviewPanel = root.querySelector(".overview-panel") as HTMLElement;
        const marketRow = root.querySelector(".overview-market-row") as HTMLElement;
        const bottomRow = root.querySelector(".overview-bottom-row") as HTMLElement;
        const marketCards = Array.from(root.querySelectorAll(".overview-market-stat")) as HTMLElement[];
        const communityCards = Array.from(root.querySelectorAll(".overview-card-community")) as HTMLElement[];
        const lineHeight = Number.parseFloat(window.getComputedStyle(root).lineHeight);
        const readMarketCardLayout = (card: HTMLElement) => {
          const cardRect = card.getBoundingClientRect();
          const label = card.querySelector(".overview-label") as HTMLElement;
          const note = card.querySelector(".overview-note") as HTMLElement | null;
          const main = card.querySelector(".overview-market-main") as HTMLElement;
          const value = card.querySelector(".overview-value") as HTMLElement;
          const delta = card.querySelector(".overview-delta") as HTMLElement;
          const labelRect = label.getBoundingClientRect();
          const valueRect = value.getBoundingClientRect();

          return {
            height: cardRect.height,
            labelTopOffset: labelRect.top - cardRect.top,
            labelLeftOffset: labelRect.left - cardRect.left,
            valueTopOffset: valueRect.top - cardRect.top,
            valueRightOffset: cardRect.right - valueRect.right,
            valueBottomOffset: cardRect.bottom - valueRect.bottom,
            noteDisplay: note ? window.getComputedStyle(note).display : null,
            mainDisplay: window.getComputedStyle(main).display,
            mainJustifyContent: window.getComputedStyle(main).justifyContent,
            valueOrder: window.getComputedStyle(value).order,
            deltaOrder: window.getComputedStyle(delta).order
          };
        };
        const readCommunityCardLayout = (card: HTMLElement) => {
          const cardRect = card.getBoundingClientRect();
          const label = card.querySelector(".overview-label") as HTMLElement;
          const head = card.querySelector(".overview-community-head") as HTMLElement;
          const score = card.querySelector(".overview-score-badge") as HTMLElement;
          const labelRect = label.getBoundingClientRect();
          const scoreRect = score.getBoundingClientRect();

          return {
            height: cardRect.height,
            labelTopOffset: labelRect.top - cardRect.top,
            labelLeftOffset: labelRect.left - cardRect.left,
            scoreTopOffset: scoreRect.top - cardRect.top,
            scoreRightOffset: cardRect.right - scoreRect.right,
            scoreBottomOffset: cardRect.bottom - scoreRect.bottom,
            headDisplay: window.getComputedStyle(head).display,
            scoreDisplay: window.getComputedStyle(score).display,
            scoreJustifyContent: window.getComputedStyle(score).justifyContent
          };
        };
        const readRow = (row: HTMLElement, cards: HTMLElement[]) => {
          const rects = cards.map((card) => card.getBoundingClientRect());
          const tops = rects.map((rect) => rect.top);
          const lefts = rects.map((rect) => rect.left);
          const rowRect = row.getBoundingClientRect();

          return {
            count: cards.length,
            rowDisplay: window.getComputedStyle(row).display,
            rowHeight: rowRect.height,
            clientWidth: row.clientWidth,
            scrollWidth: row.scrollWidth,
            gridColumnCount: window
              .getComputedStyle(row)
              .gridTemplateColumns.split(" ")
              .filter(Boolean).length,
            topSpread: tops.length ? Math.max(...tops) - Math.min(...tops) : 0,
            leftSpread: lefts.length ? Math.max(...lefts) - Math.min(...lefts) : 0,
            topIncreases: rects.slice(1).every((rect, index) => rect.top > rects[index].top),
            cardDisplays: cards.map((card) => window.getComputedStyle(card).display),
            secondSeparator: cards[1] ? window.getComputedStyle(cards[1], "::before").content : "",
            secondLineSeparator: cards[1] ? window.getComputedStyle(cards[1], "::after").content : ""
          };
        };

        return {
          lineHeight,
          marketBefore: window.getComputedStyle(marketBlock, "::before").content,
          marketAfter: window.getComputedStyle(marketBlock, "::after").content,
          communityBefore: window.getComputedStyle(overviewPanel, "::before").content,
          communityAfter: window.getComputedStyle(overviewPanel, "::after").content,
          market: readRow(marketRow, marketCards),
          marketCards: marketCards.map(readMarketCardLayout),
          community: readRow(bottomRow, communityCards),
          communityCards: communityCards.map(readCommunityCardLayout)
        };
      }, shellClass);
    };
    const readFeedEditorLayout = async (shellClass: string) => {
      return page.evaluate((targetShellClass) => {
        const root = document.querySelector(`.${targetShellClass} .theme-shell-page .main`) as HTMLElement;
        const columns = root.querySelector(".sentiment-columns") as HTMLElement;
        const lanes = Array.from(root.querySelectorAll(".sentiment-lane")) as HTMLElement[];
        const laneRects = lanes.map((lane) => lane.getBoundingClientRect());
        const tops = laneRects.map((rect) => rect.top);

        return {
          columnsDisplay: window.getComputedStyle(columns).display,
          gridColumnCount: window
            .getComputedStyle(columns)
            .gridTemplateColumns.split(" ")
            .filter(Boolean).length,
          laneCount: lanes.length,
          laneDisplays: lanes.map((lane) => window.getComputedStyle(lane).display),
          laneTopSpread: tops.length ? Math.max(...tops) - Math.min(...tops) : 0,
          secondLaneStartsAfterFirst: laneRects[1] ? laneRects[1].left >= laneRects[0].right - 1 : false,
          scrollWidth: columns.scrollWidth,
          clientWidth: columns.clientWidth
        };
      }, shellClass);
    };
    const readBoardEditorLayout = async (shellClass: string) => {
      return page.evaluate((targetShellClass) => {
        const root = document.querySelector(`.${targetShellClass} .theme-shell-page .main`) as HTMLElement;
        const grid = root.querySelector(".board-grid") as HTMLElement;
        if (grid.querySelectorAll(".board-card").length < 3) {
          grid.innerHTML = `
            <a href="/community/free" class="card board-card"><h3>자유게시판</h3></a>
            <span class="board-link-separator" aria-hidden="true">|</span>
            <a href="/community/notice" class="card board-card"><h3>공지</h3></a>
            <span class="board-link-separator" aria-hidden="true">|</span>
            <a href="/community/market" class="card board-card"><h3>시장 이야기</h3></a>
          `;
        }
        const cards = Array.from(grid.querySelectorAll(".board-card")).slice(0, 3) as HTMLElement[];
        const separators = Array.from(grid.querySelectorAll(".board-link-separator")).slice(0, 2) as HTMLElement[];
        const headings = cards.map((card) => card.querySelector("h3") as HTMLElement);
        const gridStyle = window.getComputedStyle(grid);
        const gridRect = grid.getBoundingClientRect();
        const rects = cards.map((card) => card.getBoundingClientRect());
        const separatorRects = separators.map((separator) => separator.getBoundingClientRect());
        const tops = rects.map((rect) => rect.top);
        const widths = rects.map((rect) => rect.width);
        const heights = rects.map((rect) => rect.height);
        const headingStyles = headings.map((heading) => window.getComputedStyle(heading));

        return {
          display: gridStyle.display,
          flexWrap: gridStyle.flexWrap,
          cardCount: cards.length,
          separatorCount: separators.length,
          topSpread: Math.max(...tops) - Math.min(...tops),
          widthSpread: Math.max(...widths) - Math.min(...widths),
          height: gridRect.height,
          lineHeight: Number.parseFloat(window.getComputedStyle(headings[0]).lineHeight),
          maxCardHeight: Math.max(...heights),
          cardDisplays: cards.map((card) => window.getComputedStyle(card).display),
          separatorTexts: separators.map((separator) => separator.textContent?.trim()),
          separatorDisplays: separators.map((separator) => window.getComputedStyle(separator).display),
          separatorInsideLinks: separators.map((separator) => Boolean(separator.closest("a"))),
          firstSeparatorBetweenLinks: separatorRects[0]
            ? rects[0].right < separatorRects[0].left && separatorRects[0].right < rects[1].left
            : false,
          secondSeparatorBetweenLinks: separatorRects[1]
            ? rects[1].right < separatorRects[1].left && separatorRects[1].right < rects[2].left
            : false,
          headingWhiteSpaces: headingStyles.map((style) => style.whiteSpace),
          headingOverflows: headingStyles.map((style) => style.overflowX),
          headingTextOverflows: headingStyles.map((style) => style.textOverflow),
          scrollWidth: grid.scrollWidth,
          clientWidth: grid.clientWidth
        };
      }, shellClass);
    };
    const readPostAndRoomSeparatorLayout = async (shellClass: string) => {
      return page.evaluate((targetShellClass) => {
        const root = document.querySelector(`.${targetShellClass} .theme-shell-page .main`) as HTMLElement;
        let postList = root.querySelector(".community-post-list") as HTMLElement | null;
        if (!postList) {
          postList = document.createElement("div");
          postList.className = "community-post-list";
          root.appendChild(postList);
        }
          postList.innerHTML = `<article class="community-post-row community-post-row-board">
            <span class="community-post-board">자유게시판</span>
            <a href="/community/free/post-1" class="community-post-title-link">
              <strong class="community-post-title">
                <span>IDE 테마 게시글 제목</span>
                <span class="community-post-comment-count">[3]</span>
              </strong>
            </a>
            <span class="community-post-separator community-post-separator-board" aria-hidden="true">|</span>
            <span class="community-post-meta community-post-meta-board">
              <span class="community-post-board-mobile">자유게시판</span>
              <span class="community-post-separator community-post-separator-author" aria-hidden="true">|</span>
              <span class="community-post-author">작성자</span>
              <span class="community-post-separator community-post-separator-time" aria-hidden="true">|</span>
              <time class="community-post-time" datetime="2026-05-17T00:00:00.000Z">2026.05.17</time>
            </span>
          </article>`;

        const roomEntry = document.createElement("article");
        roomEntry.className = "goksorry-room-entry ide-room-separator-fixture";
        roomEntry.innerHTML = `<div class="goksorry-room-entry-main">
          <p title="곡소리방 의견 제목">곡소리방 의견 제목</p>
          <div class="goksorry-room-meta">
            <span>작성자</span>
            <time datetime="2026-05-17T00:00:00.000Z">2026.05.17</time>
          </div>
        </div>
        <div class="goksorry-room-actions">
          <span class="goksorry-room-action-separator goksorry-room-action-separator-replies" aria-hidden="true">|</span>
          <button type="button" class="btn-secondary">덧글 2</button>
          <span class="goksorry-room-action-separator goksorry-room-action-separator-delete" aria-hidden="true">|</span>
          <button type="button" class="btn-secondary">삭제</button>
        </div>`;
        root.appendChild(roomEntry);

          const postRow = postList.querySelector(".community-post-row") as HTMLElement;
          const postTitleLink = postRow.querySelector(".community-post-title-link") as HTMLElement;
          const postTitle = postRow.querySelector(".community-post-title") as HTMLElement;
          const postBoardSeparator = postRow.querySelector(".community-post-separator-board") as HTMLElement;
          const postBoard = postRow.querySelector(".community-post-board") as HTMLElement;
          const postMobileBoard = postRow.querySelector(".community-post-board-mobile") as HTMLElement;
          const postAuthorSeparator = postRow.querySelector(".community-post-separator-author") as HTMLElement;
          const postAuthor = postRow.querySelector(".community-post-author") as HTMLElement;
          const postTimeSeparator = postRow.querySelector(".community-post-separator-time") as HTMLElement;
          const postTime = postRow.querySelector(".community-post-time") as HTMLElement;
        const roomTitle = roomEntry.querySelector(".goksorry-room-entry-main > p") as HTMLElement;
        const roomAuthor = roomEntry.querySelector(".goksorry-room-meta > span") as HTMLElement;
        const roomTime = roomEntry.querySelector(".goksorry-room-meta > time") as HTMLElement;
        const [replySeparator, deleteSeparator] = Array.from(
          roomEntry.querySelectorAll(".goksorry-room-action-separator")
        ) as HTMLElement[];
        const [replyButton, deleteButton] = Array.from(roomEntry.querySelectorAll(".goksorry-room-actions > button")) as HTMLElement[];
        const rect = (element: HTMLElement) => element.getBoundingClientRect();
        const centerY = (element: HTMLElement) => {
          const bounds = rect(element);
          return bounds.top + bounds.height / 2;
        };

        return {
            post: {
              rowDisplay: window.getComputedStyle(postRow).display,
              rowFlexWrap: window.getComputedStyle(postRow).flexWrap,
              rowTagName: postRow.tagName,
              titleLinkTagName: postTitleLink.tagName,
              titleLeft: rect(postTitleLink).left,
              boardSeparatorLeft: rect(postBoardSeparator).left,
              boardLeft: rect(postBoard).left,
              authorSeparatorLeft: rect(postAuthorSeparator).left,
              authorLeft: rect(postAuthor).left,
              timeSeparatorLeft: rect(postTimeSeparator).left,
              timeLeft: rect(postTime).left,
              titleCenterY: centerY(postTitleLink),
              boardSeparatorCenterY: centerY(postBoardSeparator),
              boardCenterY: centerY(postBoard),
              authorSeparatorCenterY: centerY(postAuthorSeparator),
              authorCenterY: centerY(postAuthor),
              timeSeparatorCenterY: centerY(postTimeSeparator),
              timeCenterY: centerY(postTime),
              separatorTexts: [postBoardSeparator, postAuthorSeparator, postTimeSeparator].map((separator) =>
                separator.textContent?.trim()
              ),
              separatorsInsideLinks: [postBoardSeparator, postAuthorSeparator, postTimeSeparator].some((separator) =>
                Boolean(separator.closest("a"))
              ),
              titleDisplay: window.getComputedStyle(postTitle).display,
              mobileBoardDisplay: window.getComputedStyle(postMobileBoard).display
            },
          room: {
            rowDisplay: window.getComputedStyle(roomEntry).display,
            rowFlexWrap: window.getComputedStyle(roomEntry).flexWrap,
            titleLeft: rect(roomTitle).left,
            authorLeft: rect(roomAuthor).left,
            replySeparatorLeft: rect(replySeparator).left,
            replyLeft: rect(replyButton).left,
            deleteSeparatorLeft: rect(deleteSeparator).left,
            deleteLeft: rect(deleteButton).left,
            titleTop: Math.round(rect(roomTitle).top),
            authorTop: Math.round(rect(roomAuthor).top),
            replyTop: Math.round(rect(replyButton).top),
            deleteTop: Math.round(rect(deleteButton).top),
            titleCenterY: centerY(roomTitle),
            authorCenterY: centerY(roomAuthor),
            replySeparatorCenterY: centerY(replySeparator),
            replyCenterY: centerY(replyButton),
            deleteSeparatorCenterY: centerY(deleteSeparator),
            deleteCenterY: centerY(deleteButton),
            authorBefore: window.getComputedStyle(roomAuthor, "::before").content,
            replySeparatorText: replySeparator.textContent?.trim(),
            deleteSeparatorText: deleteSeparator.textContent?.trim(),
            separatorsInsideButtons: [replySeparator, deleteSeparator].some((separator) => Boolean(separator.closest("button"))),
            replyBefore: window.getComputedStyle(replyButton, "::before").content,
            deleteBefore: window.getComputedStyle(deleteButton, "::before").content,
            timeDisplay: window.getComputedStyle(roomTime).display
          }
        };
      }, shellClass);
    };

    for (const item of cases) {
      await page.setViewportSize({ width: 1180, height: 760 });
      await page.goto(`/docs?theme=${item.theme}`);
      await expect(page.locator("html")).toHaveAttribute("data-theme-shell", item.shell);

      const docsTextMetrics = await page.evaluate((shellClass) => {
        const root = document.querySelector(`.${shellClass} .theme-shell-page .main`) as HTMLElement;
        const textElements = [
          root.querySelector("h1"),
          root.querySelector("p"),
          root.querySelector(".table th"),
          root.querySelector(".table td"),
          root.querySelector("code"),
          root.querySelector(".tag")
        ].filter(Boolean) as HTMLElement[];
        const card = root.querySelector(".card") as HTMLElement;
        const panel = root.querySelector(".panel") as HTMLElement;
        const tableHead = root.querySelector(".table thead") as HTMLElement;
        const tableHeaderCell = root.querySelector(".table th") as HTMLElement;
        const tableCell = root.querySelector(".table td") as HTMLElement;
        const tag = root.querySelector(".tag") as HTMLElement;
        const link = root.querySelector("a") as HTMLElement;
        const styles = textElements.map((element) => window.getComputedStyle(element));
        const cardStyle = window.getComputedStyle(card);
        const panelStyle = window.getComputedStyle(panel);
        const tableHeaderCellStyle = window.getComputedStyle(tableHeaderCell);
        const tableCellStyle = window.getComputedStyle(tableCell);
        const tagStyle = window.getComputedStyle(tag, "::before");
        const linkStyle = window.getComputedStyle(link);

        return {
          fontFamilies: styles.map((style) => style.fontFamily.toLowerCase()),
          fontSizes: styles.map((style) => style.fontSize),
          lineHeights: styles.map((style) => style.lineHeight),
          cardBackground: cardStyle.backgroundColor,
          cardBorderTopWidth: cardStyle.borderTopWidth,
          cardBorderRadius: cardStyle.borderTopLeftRadius,
          cardBoxShadow: cardStyle.boxShadow,
          panelBackground: panelStyle.backgroundColor,
          panelBorderTopWidth: panelStyle.borderTopWidth,
          panelBorderRadius: panelStyle.borderTopLeftRadius,
          panelBoxShadow: panelStyle.boxShadow,
          tableHeaderBorderTopWidth: tableHeaderCellStyle.borderTopWidth,
          tableCellBorderTopWidth: tableCellStyle.borderTopWidth,
          tableSeparator: window.getComputedStyle(tableHead, "::after").content,
          tableCellPrefix: window.getComputedStyle(tableCell, "::before").content,
          tagPrefix: tagStyle.content,
          linkDecoration: linkStyle.textDecorationLine
        };
      }, item.shellClass);

      expect(new Set(docsTextMetrics.fontFamilies).size).toBe(1);
      expect(docsTextMetrics.fontFamilies[0]).toContain("monospace");
      expect(new Set(docsTextMetrics.fontSizes).size).toBe(1);
      expect(new Set(docsTextMetrics.lineHeights).size).toBe(1);
      expect(docsTextMetrics.cardBackground).toBe("rgba(0, 0, 0, 0)");
      expect(docsTextMetrics.cardBorderTopWidth).toBe("0px");
      expect(docsTextMetrics.cardBorderRadius).toBe("0px");
      expect(docsTextMetrics.cardBoxShadow).toBe("none");
      expect(docsTextMetrics.panelBackground).toBe("rgba(0, 0, 0, 0)");
      expect(docsTextMetrics.panelBorderTopWidth).toBe("0px");
      expect(docsTextMetrics.panelBorderRadius).toBe("0px");
      expect(docsTextMetrics.panelBoxShadow).toBe("none");
      expect(docsTextMetrics.tableHeaderBorderTopWidth).toBe("0px");
      expect(docsTextMetrics.tableCellBorderTopWidth).toBe("0px");
      expect(docsTextMetrics.tableSeparator).toContain("---");
      expect(docsTextMetrics.tableCellPrefix).toContain("|");
      expect(docsTextMetrics.tagPrefix).toContain("[");
      expect(docsTextMetrics.linkDecoration).toContain("underline");

      await page.goto(`/community?theme=${item.theme}`);
      await expect(page.locator("html")).toHaveAttribute("data-theme-shell", item.shell);
      const desktopBoardLayout = await readBoardEditorLayout(item.shellClass);
      expect(desktopBoardLayout.display).toBe("flex");
      expect(desktopBoardLayout.flexWrap).toBe("nowrap");
      expect(desktopBoardLayout.cardCount).toBe(3);
      expect(desktopBoardLayout.separatorCount).toBe(2);
      expect(desktopBoardLayout.topSpread).toBeLessThanOrEqual(1);
      expect(desktopBoardLayout.widthSpread).toBeLessThanOrEqual(1);
      expect(Math.abs(desktopBoardLayout.height - desktopBoardLayout.maxCardHeight)).toBeLessThanOrEqual(1);
      expect(desktopBoardLayout.height).toBeLessThanOrEqual(desktopBoardLayout.lineHeight * 1.25);
      expect(desktopBoardLayout.cardDisplays.every((display) => display === "flex")).toBe(true);
      expect(desktopBoardLayout.separatorTexts.every((text) => text === "|")).toBe(true);
      expect(desktopBoardLayout.separatorDisplays.every((display) => display !== "none")).toBe(true);
      expect(desktopBoardLayout.separatorInsideLinks.every((insideLink) => insideLink === false)).toBe(true);
      expect(desktopBoardLayout.firstSeparatorBetweenLinks).toBe(true);
      expect(desktopBoardLayout.secondSeparatorBetweenLinks).toBe(true);
      expect(desktopBoardLayout.headingWhiteSpaces.every((whiteSpace) => whiteSpace === "nowrap")).toBe(true);
      expect(desktopBoardLayout.headingOverflows.every((overflow) => overflow === "hidden")).toBe(true);
      expect(desktopBoardLayout.headingTextOverflows.every((overflow) => overflow === "ellipsis")).toBe(true);
      expect(desktopBoardLayout.scrollWidth).toBeLessThanOrEqual(desktopBoardLayout.clientWidth + 1);

        const separatorLayout = await readPostAndRoomSeparatorLayout(item.shellClass);
        expect(separatorLayout.post.rowDisplay).toBe("flex");
        expect(separatorLayout.post.rowFlexWrap).toBe("nowrap");
        expect(separatorLayout.post.rowTagName).not.toBe("A");
        expect(separatorLayout.post.titleLinkTagName).toBe("A");
        expect(separatorLayout.post.titleLeft).toBeLessThan(separatorLayout.post.boardSeparatorLeft);
        expect(separatorLayout.post.boardSeparatorLeft).toBeLessThan(separatorLayout.post.boardLeft);
        expect(separatorLayout.post.boardLeft).toBeLessThan(separatorLayout.post.authorSeparatorLeft);
        expect(separatorLayout.post.authorSeparatorLeft).toBeLessThan(separatorLayout.post.authorLeft);
        expect(separatorLayout.post.authorLeft).toBeLessThan(separatorLayout.post.timeSeparatorLeft);
        expect(separatorLayout.post.timeSeparatorLeft).toBeLessThan(separatorLayout.post.timeLeft);
        expect(
          Math.max(
            separatorLayout.post.titleCenterY,
            separatorLayout.post.boardSeparatorCenterY,
            separatorLayout.post.boardCenterY,
            separatorLayout.post.authorSeparatorCenterY,
            separatorLayout.post.authorCenterY,
            separatorLayout.post.timeSeparatorCenterY,
            separatorLayout.post.timeCenterY
          ) -
            Math.min(
              separatorLayout.post.titleCenterY,
              separatorLayout.post.boardSeparatorCenterY,
              separatorLayout.post.boardCenterY,
              separatorLayout.post.authorSeparatorCenterY,
              separatorLayout.post.authorCenterY,
              separatorLayout.post.timeSeparatorCenterY,
              separatorLayout.post.timeCenterY
            )
        ).toBeLessThanOrEqual(4);
        expect(separatorLayout.post.separatorTexts.every((text) => text === "|")).toBe(true);
        expect(separatorLayout.post.separatorsInsideLinks).toBe(false);
        expect(separatorLayout.post.mobileBoardDisplay).toBe("none");
      expect(separatorLayout.room.rowDisplay).toBe("flex");
      expect(separatorLayout.room.rowFlexWrap).toBe("nowrap");
      expect(separatorLayout.room.titleLeft).toBeLessThan(separatorLayout.room.authorLeft);
      expect(separatorLayout.room.authorLeft).toBeLessThan(separatorLayout.room.replySeparatorLeft);
      expect(separatorLayout.room.replySeparatorLeft).toBeLessThan(separatorLayout.room.replyLeft);
      expect(separatorLayout.room.replyLeft).toBeLessThan(separatorLayout.room.deleteSeparatorLeft);
      expect(separatorLayout.room.deleteSeparatorLeft).toBeLessThan(separatorLayout.room.deleteLeft);
      expect(
        Math.max(
          separatorLayout.room.titleCenterY,
          separatorLayout.room.authorCenterY,
          separatorLayout.room.replySeparatorCenterY,
          separatorLayout.room.replyCenterY,
          separatorLayout.room.deleteSeparatorCenterY,
          separatorLayout.room.deleteCenterY
        ) -
          Math.min(
            separatorLayout.room.titleCenterY,
            separatorLayout.room.authorCenterY,
            separatorLayout.room.replySeparatorCenterY,
            separatorLayout.room.replyCenterY,
            separatorLayout.room.deleteSeparatorCenterY,
            separatorLayout.room.deleteCenterY
          )
      ).toBeLessThanOrEqual(4);
      expect(separatorLayout.room.authorBefore).toContain("|");
      expect(separatorLayout.room.replySeparatorText).toBe("|");
      expect(separatorLayout.room.deleteSeparatorText).toBe("|");
      expect(separatorLayout.room.separatorsInsideButtons).toBe(false);
      expect(separatorLayout.room.replyBefore).not.toContain("|");
      expect(separatorLayout.room.deleteBefore).not.toContain("|");
      expect(separatorLayout.room.timeDisplay).toBe("none");
    }
  });

  test("concept content surfaces adapt to the program family", async ({ page }) => {
    await prepareThemePage(page);
    await page.goto("/auth/login?theme=vscode-dark");
    await expect.poll(async () => page.locator(".vscode-gutter span").count()).toBeGreaterThan(1);
    const vscodeSurface = await page.getByTestId("theme-content-document").evaluate((element) => {
      const documentStyle = window.getComputedStyle(element);
      const frame = document.querySelector(".vscode-content-frame") as Element;
      const frameStyle = window.getComputedStyle(frame);
      const gutter = document.querySelector(".vscode-gutter") as HTMLElement;
      const lineNumbers = [...gutter.querySelectorAll("span")] as HTMLElement[];
      const firstLine = lineNumbers[0];
      const secondLine = lineNumbers[1];
      const gutterStyle = window.getComputedStyle(gutter);
      const footer = element.querySelector(".site-footer") as HTMLElement;
      const footerSourceText = footer.textContent ?? "";
      const documentRect = element.getBoundingClientRect();
      const frameRect = frame.getBoundingClientRect();
      const footerRect = footer.getBoundingClientRect();
      const firstLineRect = firstLine.getBoundingClientRect();
      const secondLineRect = secondLine.getBoundingClientRect();
      const documentLineHeight = parseFloat(documentStyle.lineHeight);
      const documentPaddingTop = parseFloat(documentStyle.paddingTop);

      return {
        fontFamily: documentStyle.fontFamily.toLowerCase(),
        frameBackground: frameStyle.backgroundImage,
        footerGap: documentRect.bottom - footerRect.bottom,
        footerSourceText,
        frameFooterGap: frameRect.bottom - footerRect.bottom,
        frameScrollHeight: frame.scrollHeight,
        frameClientHeight: frame.clientHeight,
        lineCount: lineNumbers.length,
        firstLine: firstLine.textContent,
        secondLine: secondLine.textContent,
        lineNumberBoxSizing: gutterStyle.boxSizing,
        lineNumberPaddingRight: parseFloat(gutterStyle.paddingRight),
        gutterLineHeight: parseFloat(gutterStyle.lineHeight),
        documentLineHeight,
        firstLineOffset: firstLineRect.top - (documentRect.top + documentPaddingTop),
        lineStep: secondLineRect.top - firstLineRect.top
      };
    });
    expect(vscodeSurface.fontFamily).toContain("monospace");
    expect(vscodeSurface.frameBackground).toContain("linear-gradient");
    expect(vscodeSurface.footerSourceText).toContain("한국투자증권(종목정보)");
    expect(vscodeSurface.footerGap).toBeLessThanOrEqual(32);
    expect(vscodeSurface.frameFooterGap).toBeLessThanOrEqual(32);
    expect(vscodeSurface.frameScrollHeight).toBeLessThanOrEqual(vscodeSurface.frameClientHeight + 2);
    expect(vscodeSurface.lineCount).toBeGreaterThan(0);
    expect(vscodeSurface.lineNumberBoxSizing).toBe("border-box");
    expect(vscodeSurface.lineNumberPaddingRight).toBeGreaterThan(8);
    expect(vscodeSurface.firstLine).toBe("1");
    expect(vscodeSurface.secondLine).toBe("2");
    expect(Math.abs(vscodeSurface.gutterLineHeight - vscodeSurface.documentLineHeight)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(vscodeSurface.firstLineOffset)).toBeLessThanOrEqual(1);
    expect(Math.abs(vscodeSurface.lineStep - vscodeSurface.documentLineHeight)).toBeLessThanOrEqual(1);

    await page.goto("/docs?theme=vscode-dark");
    await expect(page.locator(".vscode-content-frame")).toBeVisible();
    await expect.poll(async () => page.locator(".vscode-gutter span").count()).toBeGreaterThan(40);
    const vscodeScroll = await page.evaluate(() => {
      const frame = document.querySelector(".vscode-content-frame") as HTMLElement;
      const documentElement = document.querySelector(".theme-shell-vscode .theme-shell-content-document") as HTMLElement;
      const gutter = document.querySelector(".vscode-gutter") as HTMLElement;
      frame.scrollTop = frame.scrollHeight;
      const lastLine = gutter.querySelector("span:last-child") as HTMLElement;
      const lastLineRect = lastLine.getBoundingClientRect();
      const documentRect = documentElement.getBoundingClientRect();
      const lineHeight = parseFloat(window.getComputedStyle(documentElement).lineHeight);
      return {
        clientHeight: frame.clientHeight,
        scrollHeight: frame.scrollHeight,
        scrollTop: frame.scrollTop,
        lineCount: gutter.querySelectorAll("span").length,
        lastLine: lastLine.textContent,
        lastLineBottom: lastLineRect.bottom,
        documentBottom: documentRect.bottom,
        lineHeight
      };
    });
    expect(vscodeScroll.scrollHeight).toBeGreaterThan(vscodeScroll.clientHeight);
    expect(vscodeScroll.scrollTop).toBeGreaterThan(100);
    expect(Number(vscodeScroll.lastLine)).toBe(vscodeScroll.lineCount);
    expect(vscodeScroll.lastLineBottom).toBeGreaterThanOrEqual(vscodeScroll.documentBottom - vscodeScroll.lineHeight);

    await page.goto("/auth/login?theme=excel-light");
    const excelPanelChrome = await page.locator(".theme-shell-excel .panel").first().evaluate((element) => {
      const style = window.getComputedStyle(element);
      return {
        borderRadius: style.borderRadius,
        backgroundColor: style.backgroundColor,
        boxShadow: style.boxShadow
      };
    });
    expect(excelPanelChrome.borderRadius).toBe("0px");
    expect(excelPanelChrome.backgroundColor).toBe("rgba(0, 0, 0, 0)");
    expect(excelPanelChrome.boxShadow).toBe("none");

    await page.goto("/docs?theme=excel-light");
    const excelTableChrome = await page.locator(".theme-shell-excel .table th, .theme-shell-excel .table td").first().evaluate((element) => {
      const style = window.getComputedStyle(element);
      const rowHeader = document.querySelector(".excel-row-headers span") as HTMLElement;

      return {
        cellHeight: element.getBoundingClientRect().height,
        rowHeight: rowHeader.getBoundingClientRect().height,
        borderRadius: style.borderRadius
      };
    });
    expect(Math.abs(excelTableChrome.cellHeight - excelTableChrome.rowHeight)).toBeLessThanOrEqual(1);
    expect(excelTableChrome.borderRadius).toBe("0px");

    await page.goto("/docs?theme=docs-light");
    await expect(page.getByTestId("docs-titlebar")).toBeVisible();
    await expect(page.getByTestId("docs-menu-bar").getByRole("button", { name: "File" })).toBeVisible();
    await expect(page.getByTestId("docs-toolbar").getByRole("button", { name: "Search the menus mock command" })).toBeVisible();
    await expect(page.getByTestId("docs-ruler")).toBeVisible();
    const docsEditorChrome = await page.evaluate(() => {
      const frame = document.querySelector(".docs-content-frame") as HTMLElement;
      const page = document.querySelector(".theme-shell-docs .theme-shell-content-document") as HTMLElement;
      const heading = document.querySelector(".theme-shell-docs .docs-shell h1") as HTMLElement;
      const stage = document.querySelector(".docs-document-stage") as HTMLElement;

      return {
        frameBackground: window.getComputedStyle(frame).backgroundColor,
        pageBackground: window.getComputedStyle(page).backgroundColor,
        pageShadow: window.getComputedStyle(page).boxShadow,
        headingMarker: window.getComputedStyle(heading, "::before").content,
        stageColumns: window.getComputedStyle(stage).gridTemplateColumns,
        verticalRulerCount: document.querySelectorAll(".docs-vertical-ruler").length
      };
    });
    expect(docsEditorChrome.frameBackground).toBe("rgb(241, 243, 244)");
    expect(docsEditorChrome.pageBackground).toBe("rgb(255, 255, 255)");
    expect(docsEditorChrome.pageShadow).not.toBe("none");
    expect(docsEditorChrome.headingMarker).toBe("none");
    expect(docsEditorChrome.stageColumns.split(" ")).toHaveLength(1);
    expect(docsEditorChrome.verticalRulerCount).toBe(0);
  });

  test("concept system themes resolve to the current device tone", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await prepareThemePage(page);
    await page.goto("/auth/login?theme=vscode-system");

    await expect(page.locator("html")).toHaveAttribute("data-theme-id", "vscode-system");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "vscode-dark");
    await expect(page.locator("html")).toHaveAttribute("data-theme-tone", "system");
    await expect(page.locator("html")).toHaveAttribute("data-theme-effective-tone", "dark");
    await expectConceptHeaderReplacesSiteHeader(page, "vscode");
  });

  test("theme favicon follows the concept family across tones", async ({ page }) => {
    const cases = [
      { theme: "excel-light", iconPath: "/theme-icons/excel.svg" },
      { theme: "excel-dark", iconPath: "/theme-icons/excel.svg" },
      { theme: "excel-system", iconPath: "/theme-icons/excel.svg" },
      { theme: "docs-dark", iconPath: "/theme-icons/docs.svg" },
      { theme: "light", iconPath: "/favicon.ico" }
    ];

    await prepareThemePage(page);

    // The metaverse room has no theme, so it keeps the site icon whatever the URL asks for.
    for (const item of [...cases.map((item) => ({ ...item, url: `/auth/login?theme=${item.theme}` })), { url: "/?theme=excel-light", iconPath: "/favicon.ico" }]) {
      await page.goto(item.url);
      await expect
        .poll(async () =>
          page.evaluate(() => {
            const link = document.querySelector('link[data-theme-favicon="true"]') as HTMLLinkElement | null;
            return link ? new URL(link.href, window.location.href).pathname : null;
          })
        )
        .toBe(item.iconPath);
    }
  });

  test("blog and unknown theme values always fall back to the default theme", async ({ page }) => {
    await prepareThemePage(page, "blog-dark");
    await page.goto("/auth/login?theme=unknown");

    await expect(page.locator("html")).toHaveAttribute("data-theme-id", "light");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(page.locator("html")).toHaveAttribute("data-theme-shell", "default");
    await expect(page.getByTestId("program-shell")).toHaveCount(0);
    await expect(page.locator(".header")).toBeVisible();

    await page.goto("/auth/login?theme=vs-dark");
    await expect(page.locator("html")).toHaveAttribute("data-theme-id", "light");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(page.locator("html")).toHaveAttribute("data-theme-shell", "default");
    await expect(page.getByTestId("program-shell")).toHaveCount(0);
    await expect(page.locator(".header")).toBeVisible();

    await page.evaluate((key) => {
      window.localStorage.setItem(key, "vs-dark");
    }, THEME_STORAGE_KEY);
    await page.goto("/auth/login");
    await expect(page.locator("html")).toHaveAttribute("data-theme-id", "light");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(page.locator("html")).toHaveAttribute("data-theme-shell", "default");
    await expect(page.getByTestId("program-shell")).toHaveCount(0);
    await expect(page.locator(".header")).toBeVisible();
  });

  test("removed theme values fall back to the default theme", async ({ page }) => {
    await prepareThemePage(page, "powerpoint-dark");
    await page.goto("/auth/login?theme=jetbrains-system");

    await expect(page.locator("html")).toHaveAttribute("data-theme-id", "light");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(page.locator("html")).toHaveAttribute("data-theme-shell", "default");
    await expect(page.getByTestId("program-shell")).toHaveCount(0);

    await page.context().clearCookies({ name: THEME_COOKIE });
    await page.evaluate(
      ([themeKey, removedTheme]) => {
        window.localStorage.setItem(themeKey, removedTheme);
      },
      [THEME_STORAGE_KEY, "jetbrains-dark"]
    );
    await page.goto("/auth/login");

    await expect(page.locator("html")).toHaveAttribute("data-theme-id", "light");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(page.locator("html")).toHaveAttribute("data-theme-shell", "default");
    await expect(page.locator(".header")).toBeVisible();
  });
});
