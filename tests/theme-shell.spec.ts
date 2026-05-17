import { expect, test, type Page } from "@playwright/test";

const CLEAN_FILTER_COOKIE = "goksorry-clean-filter";
const COOKIE_CONSENT_COOKIE = "goksorry-cookie-consent";
const THEME_STORAGE_KEY = "goksorry-theme";
const CHAT_LAYOUT_ENABLED = Boolean(process.env.CHAT_WS_BASE_URL);
const EXCEL_CONTROL_RADIUS = 3;
const THEME_ICON_PATH_BY_SHELL: Record<string, string> = {
  excel: "/theme-icons/excel.svg",
  powerpoint: "/theme-icons/powerpoint.svg",
  docs: "/theme-icons/docs.svg",
  vscode: "/theme-icons/vscode.svg",
  jetbrains: "/theme-icons/jetbrains.svg"
};

const prepareThemePage = async (page: Page, storedTheme = "light") => {
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
    }
  ]);
  await page.addInitScript(
    ([key, value]) => {
      window.localStorage.setItem(key, value);
    },
    [THEME_STORAGE_KEY, storedTheme]
  );
};

const prepareThemeFirstVisitPage = async (page: Page) => {
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
    }
  ]);
  await page.addInitScript((key) => {
    window.localStorage.removeItem(key);
  }, THEME_STORAGE_KEY);
};

const mockGuestChatSession = async (page: Page) => {
  await page.route("**/api/chat/session", async (route) => {
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
    await expect(page.getByTestId("docs-sidebar").getByRole("link", { name: "feed.goksorry" })).toBeVisible();
  } else if (shell === "excel") {
    await expect(header.getByRole("link", { name: "피드" })).toHaveCount(0);
    await expect(header.getByRole("link", { name: "게시판" })).toHaveCount(0);
    await expect(header.getByRole("link", { name: "곡소리방" })).toHaveCount(0);
    await expect(page.getByTestId("excel-ribbon").getByRole("button", { name: "Home" })).toBeVisible();
    await expect(page.getByTestId("excel-sheet-tabs").getByRole("link", { name: "피드" })).toBeVisible();
  } else if (shell === "powerpoint") {
    await expect(header.getByRole("link", { name: "피드" })).toHaveCount(0);
    await expect(header.getByRole("link", { name: "게시판" })).toHaveCount(0);
    await expect(header.getByRole("link", { name: "곡소리방" })).toHaveCount(0);
    await expect(page.getByTestId("powerpoint-ribbon").getByRole("button", { name: "Home" })).toBeVisible();
    await expect(page.getByTestId("powerpoint-slide-rail").getByRole("link", { name: "1 피드 slide" })).toBeVisible();
  } else {
    await expect(header.getByRole("link", { name: "곡소리닷컴 홈" })).toHaveText("곡소리닷컴");
    await expect(header.getByRole("link", { name: "피드" })).toBeVisible();
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

test.describe("program theme shells", () => {
  test("default light theme keeps the original site shell", async ({ page }) => {
    await prepareThemePage(page);
    await page.goto("/");

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

  test("excel theme renders a single-line ribbon shell and replaces the site header", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1180, height: 760 });
    await prepareThemePage(page);
    await page.goto("/?theme=excel-light");

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

    const excelContentChrome = await page.evaluate(() => {
      const documentElement = document.querySelector("[data-testid='theme-content-document']") as HTMLElement;
      const frame = document.querySelector(".excel-content-frame") as HTMLElement;
      const tableCell = document.querySelector(".theme-shell-excel .table th, .theme-shell-excel .table td") as HTMLElement | null;
      const sheetTab = document.querySelector(".excel-sheet-tabs a") as HTMLElement;
      const headerButton = document.querySelector(".theme-shell-excel .theme-menu-trigger") as HTMLElement;
      const commentsButton = document.querySelector(".excel-header-button") as HTMLElement;
      const editingModeButton = document.querySelector(".excel-editing-mode") as HTMLElement;
      const shareButton = document.querySelector(".excel-share-button") as HTMLElement;
      const searchBox = document.querySelector(".excel-search") as HTMLElement;
      const ribbonSelect = document.querySelector(".excel-ribbon-command-select") as HTMLElement;
      const nameBox = document.querySelector(".excel-name-box") as HTMLElement;
      const formulaControlGroup = document.querySelector(".excel-formula-control-group") as HTMLElement;
      const formulaControls = Array.from(document.querySelectorAll(".excel-formula-control-group > *")) as HTMLElement[];
      const formulaInput = document.querySelector(".excel-formula-bar input") as HTMLElement;
      const rowHeaderCell = document.querySelector(".excel-row-headers span") as HTMLElement;
      const columnHeaders = document.querySelector("[data-testid='excel-column-headers']") as HTMLElement;
      const overviewArt = document.querySelector(".theme-shell-excel .overview-panel-art") as HTMLElement;
      const overviewHeadingCopy = document.querySelector(".theme-shell-excel .overview-heading-copy") as HTMLElement;
      const overviewScore = document.querySelector(".theme-shell-excel .overview-overall-score") as HTMLElement;
      const documentStyle = window.getComputedStyle(documentElement);
      const frameStyle = window.getComputedStyle(frame);
      const columnHeadersStyle = window.getComputedStyle(columnHeaders);
      const tableCellStyle = tableCell ? window.getComputedStyle(tableCell) : null;
      const sheetTabStyle = window.getComputedStyle(sheetTab);
      const headerButtonStyle = window.getComputedStyle(headerButton);
      const commentsButtonStyle = window.getComputedStyle(commentsButton);
      const editingModeButtonStyle = window.getComputedStyle(editingModeButton);
      const shareButtonStyle = window.getComputedStyle(shareButton);
      const searchBoxStyle = window.getComputedStyle(searchBox);
      const ribbonSelectStyle = window.getComputedStyle(ribbonSelect);
      const nameBoxStyle = window.getComputedStyle(nameBox);
      const formulaControlGroupStyle = window.getComputedStyle(formulaControlGroup);
      const formulaControlStyles = formulaControls.map((control) => window.getComputedStyle(control));
      const formulaInputStyle = window.getComputedStyle(formulaInput);
      const selectedColumn = document.querySelector(".excel-column-headers .excel-header-active") as HTMLElement;
      const selectedRow = document.querySelector(".excel-row-headers .excel-header-active") as HTMLElement;
      const selection = document.querySelector("[data-testid='excel-selection-box']") as HTMLElement;
      const contentLink = frame.querySelector("a") as HTMLElement | null;
      const selectionStyle = window.getComputedStyle(selection);
      const overviewArtRect = overviewArt.getBoundingClientRect();
      const overviewHeadingCopyRect = overviewHeadingCopy.getBoundingClientRect();
      const overviewScoreRect = overviewScore.getBoundingClientRect();

      return {
        columnWidth: Number.parseFloat(documentStyle.getPropertyValue("--excel-column-width")),
        rowHeight: rowHeaderCell.getBoundingClientRect().height,
        columnHeaderBorderLeft: Number.parseFloat(columnHeadersStyle.borderLeftWidth),
        marketBlockRows: Number.parseFloat(documentStyle.getPropertyValue("--excel-market-block-rows")),
        overviewPanelRows: Number.parseFloat(documentStyle.getPropertyValue("--excel-overview-panel-rows")),
        feedFilterRows: Number.parseFloat(documentStyle.getPropertyValue("--excel-feed-filter-rows")),
        paddingTop: Number.parseFloat(documentStyle.paddingTop),
        paddingRight: Number.parseFloat(documentStyle.paddingRight),
        paddingBottom: Number.parseFloat(documentStyle.paddingBottom),
        paddingLeft: Number.parseFloat(documentStyle.paddingLeft),
        documentBackground: documentStyle.backgroundImage,
        frameBackground: frameStyle.backgroundImage,
        tableCellHeight: tableCellStyle ? Number.parseFloat(tableCellStyle.height) : null,
        sheetTabRadius: sheetTabStyle.borderRadius,
        headerButtonRadius: headerButtonStyle.borderRadius,
        headerButtonBorderWidth: Number.parseFloat(headerButtonStyle.borderTopWidth),
        commentsButtonBorderWidth: Number.parseFloat(commentsButtonStyle.borderTopWidth),
        commentsButtonRadius: Number.parseFloat(commentsButtonStyle.borderTopLeftRadius),
        editingModeButtonBorderWidth: Number.parseFloat(editingModeButtonStyle.borderTopWidth),
        editingModeButtonRadius: Number.parseFloat(editingModeButtonStyle.borderTopLeftRadius),
        shareButtonBorderWidth: Number.parseFloat(shareButtonStyle.borderTopWidth),
        shareButtonRadius: Number.parseFloat(shareButtonStyle.borderTopLeftRadius),
        searchBoxBorderWidth: Number.parseFloat(searchBoxStyle.borderTopWidth),
        searchBoxRadius: Number.parseFloat(searchBoxStyle.borderTopLeftRadius),
        ribbonSelectBorderWidth: Number.parseFloat(ribbonSelectStyle.borderTopWidth),
        ribbonSelectRadius: Number.parseFloat(ribbonSelectStyle.borderTopLeftRadius),
        nameBoxBorderWidth: Number.parseFloat(nameBoxStyle.borderTopWidth),
        nameBoxRadius: Number.parseFloat(nameBoxStyle.borderTopLeftRadius),
        formulaControlCount: formulaControls.length,
        formulaControlGroupBorderWidth: Number.parseFloat(formulaControlGroupStyle.borderTopWidth),
        formulaControlGroupRadius: Number.parseFloat(formulaControlGroupStyle.borderTopLeftRadius),
        formulaControlTopBorderWidths: formulaControlStyles.map((style) => Number.parseFloat(style.borderTopWidth)),
        formulaControlRightBorderWidths: formulaControlStyles.map((style) => Number.parseFloat(style.borderRightWidth)),
        formulaControlBottomBorderWidths: formulaControlStyles.map((style) => Number.parseFloat(style.borderBottomWidth)),
        formulaInputBorderWidth: Number.parseFloat(formulaInputStyle.borderTopWidth),
        formulaInputRadius: Number.parseFloat(formulaInputStyle.borderTopLeftRadius),
        selectedColumnBackground: window.getComputedStyle(selectedColumn).backgroundColor,
        selectedColumnColor: window.getComputedStyle(selectedColumn).color,
        selectedRowBackground: window.getComputedStyle(selectedRow).backgroundColor,
        selectionBorderColor: selectionStyle.borderTopColor,
        contentCursor: frameStyle.cursor,
        contentLinkCursor: contentLink ? window.getComputedStyle(contentLink).cursor : null,
        overviewArtLeft: overviewArtRect.left,
        overviewArtRight: overviewArtRect.right,
        overviewHeadingCopyLeft: overviewHeadingCopyRect.left,
        overviewHeadingCopyRight: overviewHeadingCopyRect.right,
        overviewScoreLeft: overviewScoreRect.left,
        overviewScoreRight: overviewScoreRect.right
      };
    });
    expect(excelContentChrome.paddingTop).toBe(0);
    expect(excelContentChrome.paddingBottom).toBe(0);
    expect(excelContentChrome.paddingLeft).toBe(0);
    expect(excelContentChrome.paddingRight).toBe(0);
    expect(excelContentChrome.documentBackground).toContain("linear-gradient");
    expect(excelContentChrome.frameBackground).toBe("none");
    expect(excelContentChrome.marketBlockRows).toBe(3);
    expect(excelContentChrome.overviewPanelRows).toBe(7);
    expect(excelContentChrome.feedFilterRows).toBe(6);
    expect(Math.abs(excelContentChrome.overviewArtRight - excelContentChrome.overviewHeadingCopyRight)).toBeLessThanOrEqual(1);
    expect(Math.abs(excelContentChrome.overviewArtRight - excelContentChrome.overviewScoreLeft)).toBeLessThanOrEqual(1);
    expect(excelContentChrome.overviewArtLeft).toBeGreaterThan(excelContentChrome.overviewHeadingCopyLeft);
    expect(excelContentChrome.overviewArtRight).toBeLessThanOrEqual(excelContentChrome.overviewScoreRight);
    if (excelContentChrome.tableCellHeight !== null) {
      expect(Math.abs(excelContentChrome.tableCellHeight - excelContentChrome.rowHeight)).toBeLessThanOrEqual(1);
    }
    expect(Number.parseFloat(excelContentChrome.sheetTabRadius)).toBeGreaterThan(0);
    expect(Number.parseFloat(excelContentChrome.headerButtonRadius)).toBe(EXCEL_CONTROL_RADIUS);
    expect(excelContentChrome.headerButtonBorderWidth).toBe(0);
    expect(excelContentChrome.commentsButtonBorderWidth).toBe(0);
    expect(excelContentChrome.commentsButtonRadius).toBe(EXCEL_CONTROL_RADIUS);
    expect(excelContentChrome.editingModeButtonBorderWidth).toBe(0);
    expect(excelContentChrome.editingModeButtonRadius).toBe(EXCEL_CONTROL_RADIUS);
    expect(excelContentChrome.shareButtonBorderWidth).toBe(0);
    expect(excelContentChrome.shareButtonRadius).toBe(EXCEL_CONTROL_RADIUS);
    expect(excelContentChrome.searchBoxBorderWidth).toBeGreaterThan(0);
    expect(excelContentChrome.searchBoxRadius).toBe(EXCEL_CONTROL_RADIUS);
    expect(excelContentChrome.ribbonSelectBorderWidth).toBeGreaterThan(0);
    expect(excelContentChrome.ribbonSelectRadius).toBe(EXCEL_CONTROL_RADIUS);
    expect(excelContentChrome.nameBoxBorderWidth).toBeGreaterThan(0);
    expect(excelContentChrome.nameBoxRadius).toBe(EXCEL_CONTROL_RADIUS);
    expect(excelContentChrome.formulaControlCount).toBe(3);
    expect(excelContentChrome.formulaControlGroupBorderWidth).toBeGreaterThan(0);
    expect(excelContentChrome.formulaControlGroupRadius).toBe(EXCEL_CONTROL_RADIUS);
    expect(excelContentChrome.formulaControlTopBorderWidths).toEqual([0, 0, 0]);
    expect(excelContentChrome.formulaControlRightBorderWidths).toEqual([0, 0, 0]);
    expect(excelContentChrome.formulaControlBottomBorderWidths).toEqual([0, 0, 0]);
    expect(excelContentChrome.formulaInputBorderWidth).toBeGreaterThan(0);
    expect(excelContentChrome.formulaInputRadius).toBe(EXCEL_CONTROL_RADIUS);
    expect(excelContentChrome.columnHeaderBorderLeft).toBeGreaterThan(0);
    expect(excelContentChrome.contentCursor).toBe("cell");
    if (excelContentChrome.contentLinkCursor !== null) {
      expect(excelContentChrome.contentLinkCursor).toBe("pointer");
    }
    expect(excelContentChrome.selectedColumnBackground).not.toBe("rgba(0, 0, 0, 0)");
    expect(excelContentChrome.selectedRowBackground).not.toBe("rgba(0, 0, 0, 0)");
    expect(excelContentChrome.selectedColumnColor).toBe(excelContentChrome.selectionBorderColor);

    const selectedCellTarget = await page.evaluate(() => {
      const frame = document.querySelector(".excel-content-frame") as HTMLElement;
      const documentElement = document.querySelector("[data-testid='theme-content-document']") as HTMLElement;
      const rowHeader = document.querySelector(".excel-row-headers span") as HTMLElement;
      const columnWidth = Number.parseFloat(window.getComputedStyle(documentElement).getPropertyValue("--excel-column-width"));
      const rowHeight = rowHeader.getBoundingClientRect().height;
      const columnIndex = 2;
      const rowIndex = 3;
      const frameRect = frame.getBoundingClientRect();

      frame.dispatchEvent(
        new MouseEvent("click", {
          bubbles: true,
          clientX: frameRect.left + columnWidth * columnIndex + 8,
          clientY: frameRect.top + rowHeight * rowIndex + 8
        })
      );

      return {
        name: "C4",
        column: "C",
        row: "4",
        left: columnWidth * columnIndex,
        top: rowHeight * rowIndex
      };
    });
    await expect(page.locator(".excel-name-box")).toHaveText(selectedCellTarget.name);
    await expect(page.locator(`[data-excel-column="${selectedCellTarget.column}"]`)).toHaveClass(/excel-header-active/);
    await expect(page.locator(`[data-excel-row="${selectedCellTarget.row}"]`)).toHaveClass(/excel-header-active/);
    const selectedCellBox = await page.getByTestId("excel-selection-box").evaluate((element) => {
      const style = window.getComputedStyle(element);

      return {
        left: Number.parseFloat(style.left),
        top: Number.parseFloat(style.top)
      };
    });
    expect(Math.abs(selectedCellBox.left - selectedCellTarget.left)).toBeLessThanOrEqual(1);
    expect(Math.abs(selectedCellBox.top - selectedCellTarget.top)).toBeLessThanOrEqual(1);

    const excelOverviewGrid = await page.evaluate(() => {
      const documentElement = document.querySelector("[data-testid='theme-content-document']") as HTMLElement;
      const heading = document.querySelector(".theme-shell-excel .overview-section-head h3") as HTMLElement;
      const marketCards = Array.from(document.querySelectorAll(".theme-shell-excel .overview-market-stat")) as HTMLElement[];
      const rowHeader = document.querySelector(".excel-row-headers span") as HTMLElement;
      const documentStyle = window.getComputedStyle(documentElement);
      const documentRect = documentElement.getBoundingClientRect();
      const headingRect = heading.getBoundingClientRect();
      const firstCardRect = marketCards[0].getBoundingClientRect();

      return {
        columnWidth: Number.parseFloat(documentStyle.getPropertyValue("--excel-column-width")),
        rowHeight: rowHeader.getBoundingClientRect().height,
        headingLeftOffset: headingRect.left - documentRect.left,
        headingTopOffset: headingRect.top - documentRect.top,
        headingAlignItems: window.getComputedStyle(heading).alignItems,
        headingPaddingLeft: Number.parseFloat(window.getComputedStyle(heading).paddingLeft),
        cardLeftOffset: firstCardRect.left - documentRect.left,
        cardTopOffset: firstCardRect.top - documentRect.top,
        cardWidth: firstCardRect.width,
        cardHeight: firstCardRect.height,
        cardRadius: window.getComputedStyle(marketCards[0]).borderRadius
      };
    });
    const closeToGridLine = (value: number, cellSize: number) => {
      const remainder = Math.abs(value % cellSize);
      return Math.min(remainder, Math.abs(cellSize - remainder));
    };
    expect(closeToGridLine(excelOverviewGrid.headingLeftOffset, excelOverviewGrid.columnWidth)).toBeLessThanOrEqual(1);
    expect(closeToGridLine(excelOverviewGrid.headingTopOffset, excelOverviewGrid.rowHeight)).toBeLessThanOrEqual(1);
    expect(excelOverviewGrid.headingAlignItems).toBe("center");
    expect(excelOverviewGrid.headingPaddingLeft).toBeGreaterThan(0);
    expect(closeToGridLine(excelOverviewGrid.cardLeftOffset, excelOverviewGrid.columnWidth)).toBeLessThanOrEqual(1);
    expect(closeToGridLine(excelOverviewGrid.cardTopOffset, excelOverviewGrid.rowHeight)).toBeLessThanOrEqual(1);
    expect(Math.abs(excelOverviewGrid.cardWidth - excelOverviewGrid.columnWidth * 2)).toBeLessThanOrEqual(1);
    expect(Math.abs(excelOverviewGrid.cardHeight - excelOverviewGrid.rowHeight * 2)).toBeLessThanOrEqual(1);
    expect(excelOverviewGrid.cardRadius).toBe("0px");

    const excelFixedHomeBlocks = await page.evaluate(() => {
      const rowHeader = document.querySelector(".excel-row-headers span") as HTMLElement;
      const rowHeight = rowHeader.getBoundingClientRect().height;
      const marketBlock = document.querySelector(".theme-shell-excel .overview-market-block") as HTMLElement;
      const overviewPanel = document.querySelector(".theme-shell-excel .overview-panel") as HTMLElement;
      const feedFilterPanel = document.querySelector(".theme-shell-excel .feed-filter-panel") as HTMLElement;
      const feedLanesPanel = document.querySelector(".theme-shell-excel .feed-lanes-panel") as HTMLElement;

      return {
        rowHeight,
        marketBlockHeight: marketBlock.getBoundingClientRect().height,
        overviewPanelHeight: overviewPanel.getBoundingClientRect().height,
        feedFilterPanelHeight: feedFilterPanel.getBoundingClientRect().height,
        feedLanesPanelHeight: feedLanesPanel.getBoundingClientRect().height,
        feedLanesScrollHeight: feedLanesPanel.scrollHeight
      };
    });
    expect(Math.abs(excelFixedHomeBlocks.marketBlockHeight - excelFixedHomeBlocks.rowHeight * 3)).toBeLessThanOrEqual(1);
    expect(Math.abs(excelFixedHomeBlocks.overviewPanelHeight - excelFixedHomeBlocks.rowHeight * 7)).toBeLessThanOrEqual(1);
    expect(Math.abs(excelFixedHomeBlocks.feedFilterPanelHeight - excelFixedHomeBlocks.rowHeight * 6)).toBeLessThanOrEqual(1);
    expect(Math.abs(excelFixedHomeBlocks.feedLanesPanelHeight - excelFixedHomeBlocks.feedLanesScrollHeight)).toBeLessThanOrEqual(2);

    const excelFeedGrid = await page.evaluate(() => {
      const lanePanel = document.querySelector(".theme-shell-excel .feed-lanes-panel") as HTMLElement;
      const lane = document.querySelector(".theme-shell-excel .sentiment-lane") as HTMLElement;
      const laneHead = document.querySelector(".theme-shell-excel .sentiment-lane-head") as HTMLElement;
      const firstCard = document.querySelector(".theme-shell-excel .sentiment-card") as HTMLElement | null;
      const rowHeader = document.querySelector(".excel-row-headers span") as HTMLElement;
      const documentStyle = window.getComputedStyle(document.querySelector("[data-testid='theme-content-document']") as HTMLElement);
      const laneStyle = window.getComputedStyle(lane);
      const lanePanelStyle = window.getComputedStyle(lanePanel);
      const laneHeadRect = laneHead.getBoundingClientRect();
      const firstCardRect = firstCard?.getBoundingClientRect();

      return {
        columnWidth: Number.parseFloat(documentStyle.getPropertyValue("--excel-column-width")),
        rowHeight: rowHeader.getBoundingClientRect().height,
        panelBackground: lanePanelStyle.backgroundColor,
        laneRadius: laneStyle.borderRadius,
        laneWidth: lane.getBoundingClientRect().width,
        laneHeadHeight: laneHeadRect.height,
        firstCardHeight: firstCardRect?.height ?? null,
        firstCardRadius: firstCard ? window.getComputedStyle(firstCard).borderRadius : null
      };
    });
    expect(excelFeedGrid.panelBackground).toBe("rgba(0, 0, 0, 0)");
    expect(excelFeedGrid.laneRadius).toBe("0px");
    expect(Math.abs(excelFeedGrid.laneWidth - excelFeedGrid.columnWidth * 4)).toBeLessThanOrEqual(1);
    expect(excelFeedGrid.laneHeadHeight).toBeGreaterThanOrEqual(excelFeedGrid.rowHeight - 1);
    expect(closeToGridLine(excelFeedGrid.laneHeadHeight, excelFeedGrid.rowHeight)).toBeLessThanOrEqual(1);
    if (excelFeedGrid.firstCardHeight !== null) {
      expect(excelFeedGrid.firstCardHeight).toBeGreaterThanOrEqual(excelFeedGrid.rowHeight * 2 - 1);
      expect(excelFeedGrid.firstCardRadius).toBe("0px");
    }

    await page.locator(".excel-content-frame").evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    const bottomChrome = await page.evaluate(() => {
      const tabs = document.querySelector("[data-testid='excel-sheet-tabs']")?.getBoundingClientRect();
      const status = document.querySelector("[data-testid='program-status-bar']")?.getBoundingClientRect();

      return {
        tabsTop: tabs?.top ?? 0,
        statusBottom: status?.bottom ?? 0,
        viewportHeight: window.innerHeight
      };
    });
    expect(bottomChrome.tabsTop).toBeLessThan(bottomChrome.viewportHeight);
    expect(bottomChrome.statusBottom).toBeLessThanOrEqual(bottomChrome.viewportHeight + 2);

    const currentUrl = page.url();
    await page.getByRole("button", { name: "Paste mock command" }).click();
    await expect(page).toHaveURL(currentUrl);
    await page.screenshot({ path: testInfo.outputPath("excel-light.png"), fullPage: false });
  });

  test("powerpoint theme renders an Office web slide editor shell", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1180, height: 760 });
    await prepareThemePage(page);
    await page.goto("/?theme=powerpoint-light");

    await expect(page.locator("html")).toHaveAttribute("data-theme-id", "powerpoint-light");
    await expect(page.locator("html")).toHaveAttribute("data-theme-shell", "powerpoint");
    await expectConceptHeaderReplacesSiteHeader(page, "powerpoint");
    await expectConceptHeaderFixed(page);
    await expect(page.getByTestId("powerpoint-ribbon")).toBeVisible();
    await expect(page.getByTestId("powerpoint-single-line-ribbon")).toBeVisible();
    await expect(page.getByTestId("powerpoint-slide-rail")).toBeVisible();
    await expect(page.getByTestId("powerpoint-slide-canvas")).toBeVisible();
    await expect(page.getByTestId("powerpoint-notes")).toBeVisible();
    await expect(page.getByTestId("program-header").getByRole("button", { name: "Microsoft 365 app launcher mock command" })).toBeVisible();
    await expect(page.getByTestId("program-header").getByText("Saved to Goksorry")).toBeVisible();
    await expect(page.getByTestId("program-header").getByText("Saved to OneDrive")).toHaveCount(0);
    await expect(page.getByTestId("program-header").getByRole("search", { name: "PowerPoint 검색" })).toBeVisible();
    await expect(page.getByTestId("program-header").getByRole("button", { name: "Comments mock command" })).toBeVisible();
    await expect(page.getByTestId("program-header").getByRole("button", { name: "Present mock command" })).toBeVisible();
    await expect(page.getByTestId("program-header").getByRole("button", { name: "Editing mode mock command" })).toBeVisible();
    await expect(page.getByTestId("program-header").getByRole("button", { name: "Share presentation mock command" })).toBeVisible();

    const powerpointRibbonMetrics = await page.evaluate(() => {
      const commandButtons = Array.from(document.querySelectorAll(".powerpoint-ribbon-command")) as HTMLElement[];
      const plainCommandButtons = Array.from(
        document.querySelectorAll(".powerpoint-ribbon-command:not(.powerpoint-ribbon-command-select)")
      ) as HTMLElement[];
      const selectButtons = Array.from(document.querySelectorAll(".powerpoint-ribbon-command-select")) as HTMLElement[];
      const commandRects = commandButtons.map((button) => button.getBoundingClientRect());
      const ribbonRect = (document.querySelector("[data-testid='powerpoint-single-line-ribbon']") as HTMLElement).getBoundingClientRect();
      const commandTops = commandRects.map((rect) => Math.round(rect.top));
      const plainCommandStyles = plainCommandButtons.map((button) => window.getComputedStyle(button));
      const selectButtonStyles = selectButtons.map((button) => window.getComputedStyle(button));

      return {
        tabCount: document.querySelectorAll(".powerpoint-tabs button").length,
        commandCount: commandButtons.length,
        iconCount: document.querySelectorAll(".powerpoint-ribbon-command .powerpoint-command-icon").length,
        groupLabelCount: document.querySelectorAll(".powerpoint-command-group p").length,
        separatorCount: document.querySelectorAll(".powerpoint-ribbon-separator").length,
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
    expect(powerpointRibbonMetrics.tabCount).toBe(11);
    expect(powerpointRibbonMetrics.commandCount).toBeGreaterThanOrEqual(14);
    expect(powerpointRibbonMetrics.iconCount).toBeGreaterThanOrEqual(powerpointRibbonMetrics.commandCount - 2);
    expect(powerpointRibbonMetrics.groupLabelCount).toBe(0);
    expect(powerpointRibbonMetrics.separatorCount).toBeGreaterThanOrEqual(3);
    expect(powerpointRibbonMetrics.selectCount).toBeGreaterThanOrEqual(2);
    expect(new Set(powerpointRibbonMetrics.commandHeights).size).toBe(1);
    expect(new Set(powerpointRibbonMetrics.plainCommandBorderWidths)).toEqual(new Set([0]));
    expect(new Set(powerpointRibbonMetrics.plainCommandRadii)).toEqual(new Set([EXCEL_CONTROL_RADIUS]));
    expect(new Set(powerpointRibbonMetrics.selectCommandBorderWidths)).toEqual(new Set([1]));
    expect(new Set(powerpointRibbonMetrics.selectCommandRadii)).toEqual(new Set([EXCEL_CONTROL_RADIUS]));
    expect(powerpointRibbonMetrics.topSpread).toBeLessThanOrEqual(1);
    expect(powerpointRibbonMetrics.ribbonHeight).toBeLessThanOrEqual(52);

    const powerpointSlideMetrics = await page.evaluate(() => {
      const rail = document.querySelector("[data-testid='powerpoint-slide-rail']") as HTMLElement;
      const slideLinks = Array.from(rail.querySelectorAll("a")) as HTMLElement[];
      const thumbnails = Array.from(rail.querySelectorAll(".powerpoint-slide-thumbnail")) as HTMLElement[];
      const activeSlide = rail.querySelector("a.theme-shell-active") as HTMLElement;
      const canvas = document.querySelector(".powerpoint-canvas") as HTMLElement;
      const slide = document.querySelector("[data-testid='powerpoint-slide-canvas']") as HTMLElement;
      const frame = document.querySelector(".powerpoint-content-frame") as HTMLElement;
      const notes = document.querySelector("[data-testid='powerpoint-notes']") as HTMLElement;
      const canvasStyle = window.getComputedStyle(canvas);
      const slideRect = slide.getBoundingClientRect();
      const frameRect = frame.getBoundingClientRect();
      const thumbnailRects = thumbnails.map((thumbnail) => thumbnail.getBoundingClientRect());
      const activeStyle = window.getComputedStyle(activeSlide);
      const canvasInnerWidth =
        canvas.clientWidth - parseFloat(canvasStyle.paddingLeft) - parseFloat(canvasStyle.paddingRight);
      const canvasInnerHeight =
        canvas.clientHeight - parseFloat(canvasStyle.paddingTop) - parseFloat(canvasStyle.paddingBottom);

      return {
        slideCount: slideLinks.length,
        thumbnailAspectRatios: thumbnailRects.map((rect) => rect.width / rect.height),
        activeBorderColor: activeStyle.borderTopColor,
        inactiveBorderColor: window.getComputedStyle(slideLinks[1]).borderTopColor,
        canvasInnerWidth,
        canvasInnerHeight,
        frameWidth: frameRect.width,
        frameHeight: frameRect.height,
        slideWidth: slideRect.width,
        slideHeight: slideRect.height,
        canvasBackground: window.getComputedStyle(canvas).backgroundColor,
        slideBackground: window.getComputedStyle(slide).backgroundColor,
        frameBackground: window.getComputedStyle(frame).backgroundColor,
        notesDisplay: window.getComputedStyle(notes).display,
        notesText: notes.textContent ?? ""
      };
    });
    expect(powerpointSlideMetrics.slideCount).toBeGreaterThanOrEqual(6);
    expect(powerpointSlideMetrics.thumbnailAspectRatios.every((ratio) => Math.abs(ratio - 16 / 9) < 0.04)).toBe(true);
    expect(powerpointSlideMetrics.activeBorderColor).not.toBe(powerpointSlideMetrics.inactiveBorderColor);
    expect(Math.abs(powerpointSlideMetrics.slideWidth - powerpointSlideMetrics.canvasInnerWidth)).toBeLessThanOrEqual(2);
    expect(Math.abs(powerpointSlideMetrics.slideHeight - powerpointSlideMetrics.canvasInnerHeight)).toBeLessThanOrEqual(2);
    expect(Math.abs(powerpointSlideMetrics.frameWidth - powerpointSlideMetrics.slideWidth)).toBeLessThanOrEqual(1);
    expect(Math.abs(powerpointSlideMetrics.frameHeight - powerpointSlideMetrics.slideHeight)).toBeLessThanOrEqual(1);
    expect(powerpointSlideMetrics.canvasBackground).not.toBe(powerpointSlideMetrics.slideBackground);
    expect(powerpointSlideMetrics.frameBackground).toBe(powerpointSlideMetrics.slideBackground);
    expect(powerpointSlideMetrics.notesDisplay).toBe("grid");
    expect(powerpointSlideMetrics.notesText).toContain("Click to add notes");

    await page.screenshot({ path: testInfo.outputPath("powerpoint-desktop.png"), fullPage: false });
  });

  test("excel theme aligns feed, community, and room content blocks to worksheet cells", async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 760 });
    await prepareThemePage(page);
    await page.goto("/?theme=excel-light");

    await expect(page.locator("html")).toHaveAttribute("data-theme-shell", "excel");
    await expect.poll(async () => page.getByTestId("excel-column-headers").locator("span").count()).toBeGreaterThanOrEqual(8);
    const feedMetrics = await readExcelGridMetrics(page, [
      ".theme-shell-excel .feed-filter-panel",
      ".theme-shell-excel .feed-filter-panel h1",
      ".theme-shell-excel .feed-filter-panel > .muted",
      ".theme-shell-excel .feed-filter-toolbar",
      ".theme-shell-excel .feed-selection-actions",
      ".theme-shell-excel .feed-channel-buttons",
      ".theme-shell-excel .sentiment-lane",
      ".theme-shell-excel .sentiment-lane-head",
      ".theme-shell-excel .sentiment-lane > .error, .theme-shell-excel .sentiment-lane > .muted, .theme-shell-excel .sentiment-list > .error, .theme-shell-excel .sentiment-list > .muted"
    ]);
    expectExcelGridAligned(feedMetrics);

    const optionalSentimentCardMetrics = await readExcelGridMetrics(page, [".theme-shell-excel .sentiment-card"]);
    if (optionalSentimentCardMetrics[0].present) {
      expectExcelGridAligned(optionalSentimentCardMetrics);
    }

    await page.locator(".theme-shell-excel .sentiment-lane-fear").evaluate((laneElement) => {
      const lane = laneElement as HTMLElement;
      const laneHead = lane.querySelector(".sentiment-lane-head") as HTMLElement;
      const existingBadges = lane.querySelector(".feed-symbol-badges");
      const badges = existingBadges ?? document.createElement("div");
      badges.className = "feed-symbol-badges feed-symbol-badges-overflow";
      badges.setAttribute("aria-label", "공포 등장 종목");
      badges.innerHTML = Array.from({ length: 20 }, (_, index) => {
        return `<span class="feed-symbol-badge">긴종목명테스트${index + 1}<span class="feed-symbol-badge-count">x${index + 2}</span></span>`;
      }).join("");
      if (!existingBadges) {
        laneHead.insertAdjacentElement("afterend", badges);
      }

      const list = lane.querySelector(".sentiment-list") as HTMLElement;
      list.innerHTML = `<article class="sentiment-card sentiment-card-fear">
        <div class="sentiment-card-head">
          <div class="sentiment-card-head-tags">
            <span class="tag sentiment-card-tag">토스증권 종목토론</span>
            <span class="tag tag-symbol sentiment-card-tag">매우긴종목명테스트</span>
          </div>
          <div class="sentiment-card-head-meta">
            <time class="sentiment-time" datetime="2026-05-17T00:00:00.000Z">2026.05.17 09:30:00</time>
          </div>
        </div>
        <div class="sentiment-card-body">
          <span class="sentiment-title-stack">
            <span class="sentiment-title sentiment-title-layer sentiment-title-layer-visible">
              엑셀 테마에서 한 셀보다 훨씬 긴 피드 제목이 카드의 두 번째 셀을 넘어가지 않고 말줄임으로 처리되는지 확인하기 위한 아주 긴 제목입니다
            </span>
          </span>
        </div>
      </article>`;
    });

    const excelFeedOverflow = await page.evaluate(() => {
      const rowHeader = document.querySelector(".excel-row-headers span") as HTMLElement;
      const rowHeight = rowHeader.getBoundingClientRect().height;
      const badges = document.querySelector(".theme-shell-excel .sentiment-lane-fear .feed-symbol-badges") as HTMLElement;
      const firstBadge = badges.querySelector(".feed-symbol-badge") as HTMLElement;
      const card = document.querySelector(".theme-shell-excel .sentiment-lane-fear .sentiment-card") as HTMLElement;
      const title = card.querySelector(".sentiment-title") as HTMLElement;
      const sourceTag = card.querySelector(".sentiment-card-tag") as HTMLElement;
      const symbolTag = card.querySelector(".tag-symbol") as HTMLElement;
      const titleStyle = window.getComputedStyle(title);
      const sourceTagStyle = window.getComputedStyle(sourceTag);
      const symbolTagStyle = window.getComputedStyle(symbolTag);
      const cardRect = card.getBoundingClientRect();
      const titleRect = title.getBoundingClientRect();

      return {
        rowHeight,
        badgesHeight: badges.getBoundingClientRect().height,
        badgesClientHeight: badges.clientHeight,
        badgesScrollHeight: badges.scrollHeight,
        badgesAfter: window.getComputedStyle(badges, "::after").content,
        firstBadgeBorderTop: window.getComputedStyle(firstBadge).borderTopWidth,
        firstBadgeTextOverflow: window.getComputedStyle(firstBadge).textOverflow,
        cardHeight: cardRect.height,
        titleRightOffset: titleRect.right - cardRect.right,
        titleBottomOffset: titleRect.bottom - cardRect.bottom,
        titleOverflowX: titleStyle.overflowX,
        titleTextOverflow: titleStyle.textOverflow,
        titleWhiteSpace: titleStyle.whiteSpace,
        sourceTagBorderTop: sourceTagStyle.borderTopWidth,
        sourceTagFontSize: Number.parseFloat(sourceTagStyle.fontSize),
        sourceTagPaddingLeft: Number.parseFloat(sourceTagStyle.paddingLeft),
        sourceTagTextOverflow: sourceTagStyle.textOverflow,
        symbolTagBorderTop: symbolTagStyle.borderTopWidth,
        symbolTagFontSize: Number.parseFloat(symbolTagStyle.fontSize)
      };
    });
    expect(Math.abs(excelFeedOverflow.badgesHeight - excelFeedOverflow.rowHeight * 2)).toBeLessThanOrEqual(1);
    expect(excelFeedOverflow.badgesScrollHeight).toBeGreaterThan(excelFeedOverflow.badgesClientHeight);
    expect(excelFeedOverflow.badgesAfter).toContain("...");
    expect(excelFeedOverflow.firstBadgeBorderTop).toBe("0px");
    expect(excelFeedOverflow.firstBadgeTextOverflow).toBe("ellipsis");
    expect(Math.abs(excelFeedOverflow.cardHeight - excelFeedOverflow.rowHeight * 2)).toBeLessThanOrEqual(1);
    expect(excelFeedOverflow.titleRightOffset).toBeLessThanOrEqual(1);
    expect(excelFeedOverflow.titleBottomOffset).toBeLessThanOrEqual(1);
    expect(excelFeedOverflow.titleOverflowX).toBe("hidden");
    expect(excelFeedOverflow.titleTextOverflow).toBe("ellipsis");
    expect(excelFeedOverflow.titleWhiteSpace).toBe("nowrap");
    expect(excelFeedOverflow.sourceTagBorderTop).toBe("0px");
    expect(excelFeedOverflow.sourceTagFontSize).toBeLessThanOrEqual(11);
    expect(excelFeedOverflow.sourceTagPaddingLeft).toBeLessThanOrEqual(4);
    expect(excelFeedOverflow.sourceTagTextOverflow).toBe("ellipsis");
    expect(excelFeedOverflow.symbolTagBorderTop).toBe("0px");
    expect(excelFeedOverflow.symbolTagFontSize).toBeLessThanOrEqual(11);

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
            <a href="/community/free/post-1" class="community-post-row community-post-row-board">
              <span class="community-post-board">자유</span>
              <strong class="community-post-title">
                <span>엑셀 셀 정렬 검증용 게시글입니다</span>
                <span class="community-post-comment-count">[3]</span>
              </strong>
              <span class="community-post-meta community-post-meta-board">
                <span class="community-post-board-mobile">자유</span>
                <span class="community-post-author">테스터</span>
                <time class="community-post-time" datetime="2026-05-16T00:00:00.000Z">2026.05.16</time>
              </span>
            </a>
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
    await expect(page.locator(".theme-shell-excel .goksorry-room-entry-form textarea")).toHaveCount(0);
    await expect(page.locator(".theme-shell-excel .goksorry-room-reply-form textarea")).toHaveCount(0);
    await expect(page.locator(".theme-shell-excel .goksorry-room-entry-form input")).toHaveAttribute("maxlength", "160");
    await expect(page.locator(".theme-shell-excel .goksorry-room-reply-form input")).toHaveAttribute("maxlength", "160");

    const roomMetrics = await readExcelGridMetrics(page, [
      ".theme-shell-excel .goksorry-room-panel",
      ".theme-shell-excel .goksorry-room-panel > h1",
      ".theme-shell-excel .goksorry-room-entry-form",
      ".theme-shell-excel .goksorry-room-entry-form .goksorry-room-input-label",
      ".theme-shell-excel .goksorry-room-entry-form input",
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
      ".theme-shell-excel .goksorry-room-reply-form .goksorry-room-count"
    ]);
    expectExcelGridAligned(roomMetrics);
  });

  test("excel theme keeps overview art visible and uses one-cell mobile indicators", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await prepareThemePage(page);
    await page.goto("/?theme=excel-light");

    await expect(page.locator("html")).toHaveAttribute("data-theme-shell", "excel");
    await expect(page.getByTestId("program-shell")).toBeVisible();
    await expect(page.locator(".theme-shell-excel .overview-panel-art")).toBeVisible();

    const mobileOverview = await page.evaluate(() => {
      const rowHeader = document.querySelector(".excel-row-headers span") as HTMLElement;
      const art = document.querySelector(".theme-shell-excel .overview-panel-art") as HTMLElement;
      const marketBlock = document.querySelector(".theme-shell-excel .overview-market-block") as HTMLElement;
      const marketRow = document.querySelector(".theme-shell-excel .overview-market-row") as HTMLElement;
      const marketCards = Array.from(document.querySelectorAll(".theme-shell-excel .overview-market-stat")) as HTMLElement[];
      const overviewPanel = document.querySelector(".theme-shell-excel .overview-panel") as HTMLElement;
      const bottomRow = document.querySelector(".theme-shell-excel .overview-bottom-row") as HTMLElement;
      const communityCards = Array.from(document.querySelectorAll(".theme-shell-excel .overview-card-community")) as HTMLElement[];
      const artStyle = window.getComputedStyle(art);
      const getRect = (element: Element) => {
        const rect = element.getBoundingClientRect();
        return {
          left: rect.left,
          right: rect.right,
          centerY: rect.top + rect.height / 2,
          width: rect.width
        };
      };

      const getStackMetrics = (cards: HTMLElement[]) => {
        const rects = cards.map((card) => card.getBoundingClientRect());
        const lefts = rects.map((rect) => rect.left);

        return {
          count: rects.length,
          leftSpread: Math.max(...lefts) - Math.min(...lefts),
          topIncreases: rects.slice(1).every((rect, index) => rect.top > rects[index].top),
          heights: rects.map((rect) => rect.height),
          widths: rects.map((rect) => rect.width)
        };
      };
      const getMarketAlignment = (card: HTMLElement) => {
        const cardRect = getRect(card);
        const label = card.querySelector(".overview-label") as HTMLElement;
        const delta = card.querySelector(".overview-delta") as HTMLElement;
        const value = card.querySelector(".overview-value") as HTMLElement;

        return {
          cardRight: cardRect.right,
          cardCenterY: card.getBoundingClientRect().top + card.getBoundingClientRect().height / 2,
          label: getRect(label),
          delta: getRect(delta),
          value: getRect(value),
          deltaDisplay: window.getComputedStyle(delta).display
        };
      };
      const getCommunityAlignment = (card: HTMLElement) => {
        const cardRect = getRect(card);
        const label = card.querySelector(".overview-label") as HTMLElement;
        const badge = card.querySelector(".overview-score-badge") as HTMLElement;

        return {
          cardRight: cardRect.right,
          cardCenterY: card.getBoundingClientRect().top + card.getBoundingClientRect().height / 2,
          label: getRect(label),
          badge: getRect(badge),
          bandCount: card.querySelectorAll(".overview-community-band").length,
          countsCount: card.querySelectorAll(".overview-community-counts").length,
          deltaCount: card.querySelectorAll(".overview-delta").length
        };
      };

      return {
        rowHeight: rowHeader.getBoundingClientRect().height,
        artDisplay: artStyle.display,
        artOpacity: Number.parseFloat(artStyle.opacity),
        artBackground: artStyle.backgroundImage,
        marketBlockHeight: marketBlock.getBoundingClientRect().height,
        marketRowClientWidth: marketRow.clientWidth,
        marketRowScrollWidth: marketRow.scrollWidth,
        marketStack: getStackMetrics(marketCards),
        overviewPanelHeight: overviewPanel.getBoundingClientRect().height,
        bottomRowClientWidth: bottomRow.clientWidth,
        bottomRowScrollWidth: bottomRow.scrollWidth,
        communityStack: getStackMetrics(communityCards),
        marketAlignment: marketCards.map(getMarketAlignment),
        communityAlignment: communityCards.map(getCommunityAlignment)
      };
    });

    expect(mobileOverview.artDisplay).toBe("block");
    expect(mobileOverview.artOpacity).toBe(1);
    expect(mobileOverview.artBackground).toContain("overview-regime");
    expect(Math.abs(mobileOverview.marketBlockHeight - mobileOverview.rowHeight * 5)).toBeLessThanOrEqual(1);
    expect(Math.abs(mobileOverview.overviewPanelHeight - mobileOverview.rowHeight * 10)).toBeLessThanOrEqual(1);
    expect(mobileOverview.marketRowScrollWidth).toBeLessThanOrEqual(mobileOverview.marketRowClientWidth + 1);
    expect(mobileOverview.bottomRowScrollWidth).toBeLessThanOrEqual(mobileOverview.bottomRowClientWidth + 1);
    expect(mobileOverview.marketStack.count).toBe(4);
    expect(mobileOverview.marketStack.leftSpread).toBeLessThanOrEqual(1);
    expect(mobileOverview.marketStack.topIncreases).toBe(true);
    expect(mobileOverview.marketStack.heights.every((height) => Math.abs(height - mobileOverview.rowHeight) <= 1)).toBe(true);
    for (const item of mobileOverview.marketAlignment) {
      expect(item.deltaDisplay).not.toBe("none");
      expect(item.label.left).toBeLessThan(item.delta.left);
      expect(item.delta.left).toBeLessThan(item.value.left);
      expect(item.value.left - item.delta.right).toBeGreaterThanOrEqual(4);
      expect(item.value.right).toBeGreaterThanOrEqual(item.cardRight - 16);
      expect(Math.abs(item.label.centerY - item.cardCenterY)).toBeLessThanOrEqual(2);
      expect(Math.abs(item.delta.centerY - item.cardCenterY)).toBeLessThanOrEqual(2);
      expect(Math.abs(item.value.centerY - item.cardCenterY)).toBeLessThanOrEqual(2);
    }
    expect(mobileOverview.communityStack.count).toBe(4);
    expect(mobileOverview.communityStack.leftSpread).toBeLessThanOrEqual(1);
    expect(mobileOverview.communityStack.topIncreases).toBe(true);
    expect(mobileOverview.communityStack.heights.every((height) => Math.abs(height - mobileOverview.rowHeight) <= 1)).toBe(true);
    for (const item of mobileOverview.communityAlignment) {
      expect(item.bandCount).toBe(0);
      expect(item.countsCount).toBe(0);
      expect(item.deltaCount).toBe(0);
      expect(item.label.left).toBeLessThan(item.badge.left);
      expect(item.badge.right).toBeGreaterThanOrEqual(item.cardRight - 16);
      expect(Math.abs(item.label.centerY - item.cardCenterY)).toBeLessThanOrEqual(2);
      expect(Math.abs(item.badge.centerY - item.cardCenterY)).toBeLessThanOrEqual(2);
    }

    await page.screenshot({ path: testInfo.outputPath("excel-mobile.png"), fullPage: false });
  });

  test("mobile overview indicators are full-width single-line rows across themes", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    const cases = [
      { url: "/", shell: "default" },
      { url: "/?theme=powerpoint-light", shell: "powerpoint" },
      { url: "/?theme=docs-light", shell: "docs" }
    ];

    for (const item of cases) {
      await prepareThemePage(page);
      await page.goto(item.url);

      if (item.shell === "default") {
        await expect(page.locator("html")).toHaveAttribute("data-theme-shell", "default");
      } else {
        await expect(page.getByTestId("program-shell")).toHaveAttribute("data-program-shell", item.shell);
      }

      const metrics = await page.evaluate(() => {
        const marketRow = document.querySelector(".overview-market-row") as HTMLElement;
        const bottomRow = document.querySelector(".overview-bottom-row") as HTMLElement;
        const marketCards = Array.from(document.querySelectorAll(".overview-market-stat")) as HTMLElement[];
        const communityCards = Array.from(document.querySelectorAll(".overview-card-community")) as HTMLElement[];
        const getRect = (element: Element) => {
          const rect = element.getBoundingClientRect();
          return {
            left: rect.left,
            right: rect.right,
            centerY: rect.top + rect.height / 2,
            width: rect.width
          };
        };

        const getStackMetrics = (cards: HTMLElement[]) => {
          const rects = cards.map((card) => card.getBoundingClientRect());
          const lefts = rects.map((rect) => rect.left);
          const widths = rects.map((rect) => rect.width);

          return {
            count: rects.length,
            leftSpread: Math.max(...lefts) - Math.min(...lefts),
            topIncreases: rects.slice(1).every((rect, index) => rect.top > rects[index].top),
            maxHeight: Math.max(...rects.map((rect) => rect.height)),
            minWidth: Math.min(...widths),
            parentWidth: cards[0]?.parentElement?.getBoundingClientRect().width ?? 0
          };
        };
        const getMarketAlignment = (card: HTMLElement) => {
          const cardRect = getRect(card);
          const label = card.querySelector(".overview-label") as HTMLElement;
          const delta = card.querySelector(".overview-delta") as HTMLElement;
          const value = card.querySelector(".overview-value") as HTMLElement;

          return {
            cardRight: cardRect.right,
            cardCenterY: card.getBoundingClientRect().top + card.getBoundingClientRect().height / 2,
            label: getRect(label),
            delta: getRect(delta),
            value: getRect(value),
            deltaDisplay: window.getComputedStyle(delta).display
          };
        };
        const getCommunityAlignment = (card: HTMLElement) => {
          const cardRect = getRect(card);
          const label = card.querySelector(".overview-label") as HTMLElement;
          const badge = card.querySelector(".overview-score-badge") as HTMLElement;

          return {
            cardRight: cardRect.right,
            cardCenterY: card.getBoundingClientRect().top + card.getBoundingClientRect().height / 2,
            label: getRect(label),
            badge: getRect(badge),
            bandCount: card.querySelectorAll(".overview-community-band").length,
            countsCount: card.querySelectorAll(".overview-community-counts").length,
            deltaCount: card.querySelectorAll(".overview-delta").length
          };
        };

        return {
          marketOverflow: marketRow.scrollWidth - marketRow.clientWidth,
          communityOverflow: bottomRow.scrollWidth - bottomRow.clientWidth,
          market: getStackMetrics(marketCards),
          community: getStackMetrics(communityCards),
          marketAlignment: marketCards.map(getMarketAlignment),
          communityAlignment: communityCards.map(getCommunityAlignment)
        };
      });

      expect(metrics.marketOverflow).toBeLessThanOrEqual(1);
      expect(metrics.communityOverflow).toBeLessThanOrEqual(1);
      expect(metrics.market.count).toBe(4);
      expect(metrics.market.leftSpread).toBeLessThanOrEqual(1);
      expect(metrics.market.topIncreases).toBe(true);
      expect(metrics.market.maxHeight).toBeLessThanOrEqual(42);
      expect(metrics.market.minWidth).toBeGreaterThanOrEqual(metrics.market.parentWidth - 1);
      for (const metric of metrics.marketAlignment) {
        expect(metric.deltaDisplay).not.toBe("none");
        expect(metric.label.left).toBeLessThan(metric.delta.left);
        expect(metric.delta.left).toBeLessThan(metric.value.left);
        expect(metric.value.left - metric.delta.right).toBeGreaterThanOrEqual(4);
        expect(metric.value.right).toBeGreaterThanOrEqual(metric.cardRight - 16);
        expect(Math.abs(metric.label.centerY - metric.cardCenterY)).toBeLessThanOrEqual(2);
        expect(Math.abs(metric.delta.centerY - metric.cardCenterY)).toBeLessThanOrEqual(2);
        expect(Math.abs(metric.value.centerY - metric.cardCenterY)).toBeLessThanOrEqual(2);
      }
      expect(metrics.community.count).toBe(4);
      expect(metrics.community.leftSpread).toBeLessThanOrEqual(1);
      expect(metrics.community.topIncreases).toBe(true);
      expect(metrics.community.maxHeight).toBeLessThanOrEqual(42);
      expect(metrics.community.minWidth).toBeGreaterThanOrEqual(metrics.community.parentWidth - 1);
      for (const metric of metrics.communityAlignment) {
        expect(metric.bandCount).toBe(0);
        expect(metric.countsCount).toBe(0);
        expect(metric.deltaCount).toBe(0);
        expect(metric.label.left).toBeLessThan(metric.badge.left);
        expect(metric.badge.right).toBeGreaterThanOrEqual(metric.cardRight - 16);
        expect(Math.abs(metric.label.centerY - metric.cardCenterY)).toBeLessThanOrEqual(2);
        expect(Math.abs(metric.badge.centerY - metric.cardCenterY)).toBeLessThanOrEqual(2);
      }
    }
  });

  test("each concept theme has distinct chrome and no legacy header", async ({ page }, testInfo) => {
    const cases = [
      { theme: "powerpoint-dark", shell: "powerpoint", locator: "powerpoint-slide-rail" },
      { theme: "docs-light", shell: "docs", locator: "docs-sidebar" },
      { theme: "vscode-dark", shell: "vscode", locator: "vscode-sidebar" },
      { theme: "jetbrains-light", shell: "jetbrains", locator: "jetbrains-sidebar" }
    ];

    for (const item of cases) {
      await prepareThemePage(page);
      await page.goto(`/?theme=${item.theme}`);

      await expect(page.locator("html")).toHaveAttribute("data-theme-id", item.theme);
      await expect(page.locator("html")).toHaveAttribute("data-theme-shell", item.shell);
      await expectConceptHeaderReplacesSiteHeader(page, item.shell);
      await expectConceptHeaderFixed(page);
      await expect(page.getByTestId(item.locator)).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath(`${item.theme}.png`), fullPage: false });
    }
  });

  test("chat moves to a collapsible desktop right sidebar when chat env is enabled", async ({ page }) => {
    test.skip(!CHAT_LAYOUT_ENABLED, "desktop chat sidebar requires CHAT_WS_BASE_URL in the test server env");
    await mockGuestChatSession(page);

    const cases = [
      { theme: "light", shell: "default" },
      { theme: "excel-light", shell: "excel" },
      { theme: "powerpoint-dark", shell: "powerpoint" },
      { theme: "docs-light", shell: "docs" },
      { theme: "vscode-dark", shell: "vscode" },
      { theme: "jetbrains-light", shell: "jetbrains" }
    ];

    for (const item of cases) {
      await page.setViewportSize({ width: 1180, height: 760 });
      await prepareThemePage(page);
      await page.goto(`/?theme=${item.theme}`);

      await expect(page.locator("html")).toHaveAttribute("data-theme-shell", item.shell);
      await expect(page.getByRole("link", { name: "채팅" })).toHaveCount(0);
      await expect(page.getByTestId("desktop-chat-sidebar")).toBeVisible();
      await expect(page.getByTestId("desktop-chat-sidebar")).toHaveAttribute("data-state", "open");
      await expect(page.getByTestId("desktop-chat-sidebar").getByText("전체 채팅")).toBeVisible();
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

  test("chat keeps the bottom tab overlay at 900px and below", async ({ page }) => {
    test.skip(!CHAT_LAYOUT_ENABLED, "mobile chat dock requires CHAT_WS_BASE_URL in the test server env");
    await mockGuestChatSession(page);

    await page.setViewportSize({ width: 900, height: 760 });
    await prepareThemePage(page);
    await page.goto("/?theme=docs-light");

    await expect(page.getByTestId("desktop-chat-sidebar")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "실시간 채팅" })).toBeVisible();

    await page.getByRole("button", { name: "실시간 채팅" }).click();
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

      return {
        panelOverflowY: window.getComputedStyle(panel).overflowY,
        liveOverflowY: window.getComputedStyle(live).overflowY,
        logOverflowY: window.getComputedStyle(log).overflowY,
        panelHeight: panel.getBoundingClientRect().height,
        logHeight: log.getBoundingClientRect().height
      };
    });
    expect(mobileChatScroll.panelOverflowY).toBe("hidden");
    expect(mobileChatScroll.liveOverflowY).toBe("hidden");
    expect(mobileChatScroll.logOverflowY).toBe("auto");
    expect(mobileChatScroll.logHeight).toBeGreaterThan(0);
    expect(mobileChatScroll.logHeight).toBeLessThan(mobileChatScroll.panelHeight);
  });

  test("jetbrains header uses site navigation as the main menu and keeps run controls", async ({ page }) => {
    await prepareThemePage(page);
    await page.goto("/?theme=jetbrains-light");

    const header = page.getByTestId("program-header");
    await expectConceptHeaderReplacesSiteHeader(page, "jetbrains");
    for (const menu of ["File", "Edit", "View", "Navigate", "Code", "Tools", "Git"]) {
      await expect(header.getByRole("button", { name: menu })).toHaveCount(0);
    }
    await expect(header.getByRole("button", { name: "Run mock command" })).toBeVisible();
    await expect(header.getByRole("button", { name: "Debug mock command" })).toBeVisible();
  });

  test("ide left rail buttons use brighter restrained chrome", async ({ page }) => {
    await prepareThemePage(page);
    await page.goto("/?theme=vscode-dark");

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

    await page.goto("/?theme=jetbrains-dark");
    const jetbrainsRailChrome = await page.locator(".jetbrains-tool-window-bar").evaluate((bar) => {
      const active = bar.querySelector(".theme-shell-active") as HTMLElement;
      const inactive = Array.from(bar.querySelectorAll("button")).find((button) => button !== active) as HTMLElement;
      const activeStyle = window.getComputedStyle(active);
      const inactiveStyle = window.getComputedStyle(inactive);
      const barStyle = window.getComputedStyle(bar);
      const shellStyle = window.getComputedStyle(document.querySelector(".theme-shell-jetbrains") as Element);
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
    expect(jetbrainsRailChrome.barBackgroundImage).toBe("none");
    expect(jetbrainsRailChrome.barBrightness).toBeGreaterThan(jetbrainsRailChrome.shellBrightness);
    expect(jetbrainsRailChrome.activeBackground).not.toBe(jetbrainsRailChrome.inactiveBackground);
    expect(jetbrainsRailChrome.activeColor).not.toBe(jetbrainsRailChrome.inactiveColor);
    expect(jetbrainsRailChrome.activeShadow).not.toBe("none");
  });

  test("concept theme section colors follow product chrome references", async ({ page }) => {
    await prepareThemePage(page);

    await page.goto("/?theme=excel-light");
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

    await page.goto("/?theme=powerpoint-light");
    expect(await readRootThemeVars(page, ["--brand", "--bg", "--panel-soft"])).toMatchObject({
      "--brand": "#b7472a",
      "--bg": "#f4f3f2",
      "--panel-soft": "#f7f2ee"
    });
    await expect
      .poll(async () => page.locator(".powerpoint-titlebar").evaluate((element) => getComputedStyle(element).backgroundColor))
      .toBe("rgb(248, 248, 248)");
    const powerpointChrome = await page.evaluate(() => ({
      ribbon: getComputedStyle(document.querySelector(".powerpoint-ribbon") as HTMLElement).backgroundColor,
      canvas: getComputedStyle(document.querySelector(".powerpoint-canvas") as HTMLElement).backgroundColor,
      slide: getComputedStyle(document.querySelector("[data-testid='powerpoint-slide-canvas']") as HTMLElement).backgroundColor,
      frame: getComputedStyle(document.querySelector(".powerpoint-content-frame") as HTMLElement).backgroundColor
    }));
    expect(powerpointChrome).toMatchObject({
      ribbon: "rgb(255, 255, 255)",
      canvas: "rgb(243, 242, 241)",
      slide: "rgb(255, 255, 255)",
      frame: "rgb(255, 255, 255)"
    });

    await page.goto("/?theme=docs-light");
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

    await page.goto("/?theme=vscode-light");
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

    await page.goto("/?theme=jetbrains-dark");
    expect(await readRootThemeVars(page, ["--brand", "--jetbrains-toolbar-bg", "--jetbrains-tool-window-bar-bg", "--jetbrains-editor-bg"])).toMatchObject({
      "--brand": "#3574f0",
      "--jetbrains-toolbar-bg": "#2b2d30",
      "--jetbrains-tool-window-bar-bg": "#303236",
      "--jetbrains-editor-bg": "#1e1f22"
    });
    const jetbrainsChrome = await page.evaluate(() => ({
      toolbarImage: getComputedStyle(document.querySelector(".jetbrains-toolbar") as HTMLElement).backgroundImage,
      toolbar: getComputedStyle(document.querySelector(".jetbrains-toolbar") as HTMLElement).backgroundColor,
      toolWindow: getComputedStyle(document.querySelector(".jetbrains-tool-window-bar") as HTMLElement).backgroundColor,
      editor: getComputedStyle(document.querySelector(".jetbrains-content-frame") as HTMLElement).backgroundColor
    }));
    expect(jetbrainsChrome).toMatchObject({
      toolbarImage: "none",
      toolbar: "rgb(43, 45, 48)",
      toolWindow: "rgb(48, 50, 54)",
      editor: "rgb(30, 31, 34)"
    });

  });

  test("concept header action buttons use theme-specific chrome", async ({ page }) => {
    await prepareThemePage(page);
    await page.goto("/?theme=excel-light");
    const excelThemeButton = page.getByTestId("concept-header-actions").getByRole("button", { name: /테마 선택/ });
    const excelChrome = await excelThemeButton.evaluate((element) => {
      const style = window.getComputedStyle(element);
      return {
        backgroundColor: style.backgroundColor,
        borderRadius: style.borderRadius
      };
    });

    await page.goto("/?theme=vscode-dark");
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

  test("mobile concept theme menu opens outside header overflow", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await prepareThemePage(page);

    const cases = [
      { theme: "excel-light", shell: "excel" },
      { theme: "powerpoint-light", shell: "powerpoint" },
      { theme: "docs-light", shell: "docs" },
      { theme: "vscode-dark", shell: "vscode" },
      { theme: "jetbrains-light", shell: "jetbrains" }
    ];

    for (const item of cases) {
      await page.goto(`/?theme=${item.theme}`);
      await expect(page.getByTestId("program-shell")).toHaveAttribute("data-program-shell", item.shell);

      await page.getByTestId("concept-header-actions").getByRole("button", { name: /테마 선택/ }).click();
      const menu = page.getByRole("menu", { name: "테마 선택" });
      await expect(menu).toBeVisible();
      await expect(menu.getByText("테마", { exact: true })).toBeVisible();
      await expect(menu.getByText("색상", { exact: true })).toBeVisible();
      await expect(menu.getByRole("button", { name: "테마 Excel" })).toHaveText("Excel");
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

    await page.goto("/?theme=excel-dark");
    await page.getByTestId("concept-header-actions").getByRole("button", { name: /테마 선택/ }).click();
    await page.getByRole("menu", { name: "테마 선택" }).getByRole("button", { name: "테마 PowerPoint" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme-id", "excel-dark");
    await expect(page.getByRole("menu", { name: "테마 선택" })).toBeVisible();
    await page.getByRole("menu", { name: "테마 선택" }).getByRole("button", { name: "적용" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme-id", "powerpoint-dark");
    await expect(page.getByRole("menu", { name: "테마 선택" })).toHaveCount(0);

    await page.getByTestId("concept-header-actions").getByRole("button", { name: /테마 선택/ }).click();
    await page.getByRole("menu", { name: "테마 선택" }).getByRole("button", { name: "색상 시스템" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme-id", "powerpoint-dark");
    await expect(page.getByRole("menu", { name: "테마 선택" })).toBeVisible();
    await page.getByRole("menu", { name: "테마 선택" }).getByRole("button", { name: "적용" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme-id", "powerpoint-system");
    await expect(page.getByRole("menu", { name: "테마 선택" })).toHaveCount(0);
  });

  test("first visit theme dialog uses family and tone sections", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await prepareThemeFirstVisitPage(page);
    await page.goto("/");

    const dialog = page.getByRole("dialog", { name: "사이트 분위기를 고르세요." });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("테마", { exact: true })).toBeVisible();
    await expect(dialog.getByText("색상", { exact: true })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "테마 Excel" })).toHaveText("Excel");
    await expect(dialog.getByRole("button", { name: "테마 Docs" })).toHaveText("Docs");
    await expect(dialog.getByRole("button", { name: "색상 다크" })).toHaveText("다크");
    await expect(dialog.getByText("excel-light")).toHaveCount(0);
    await expect(dialog.getByText("엑셀 라이트")).toHaveCount(0);
    await expect(dialog.getByText("기술문서")).toHaveCount(0);

    await dialog.getByRole("button", { name: "테마 Excel" }).click();
    await dialog.getByRole("button", { name: "색상 다크" }).click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "선택 완료" }).click();

    await expect(page.locator("html")).toHaveAttribute("data-theme-id", "excel-dark");
    await expect(dialog).toHaveCount(0);
  });

  test("ide concept themes render page content as plain editor text", async ({ page }) => {
    await prepareThemePage(page);

    const cases = [
      { theme: "vscode-dark", shell: "vscode", shellClass: "theme-shell-vscode" },
      { theme: "jetbrains-dark", shell: "jetbrains", shellClass: "theme-shell-jetbrains" }
    ];
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
            secondSeparator: cards[1] ? window.getComputedStyle(cards[1], "::before").content : ""
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

      await page.goto(`/?theme=${item.theme}`);
      await expect(page.locator("html")).toHaveAttribute("data-theme-shell", item.shell);
      const overviewTextMetrics = await page.evaluate((shellClass) => {
        const root = document.querySelector(`.${shellClass} .theme-shell-page .main`) as HTMLElement;
        const overviewPanel = root.querySelector(".overview-panel") as HTMLElement;
        const overviewCard = root.querySelector(".overview-card") as HTMLElement;
        const overviewArt = root.querySelector(".overview-panel-art") as HTMLElement | null;
        const overviewGauge = root.querySelector(".overview-goksorry-gauge") as HTMLElement | null;
        const overviewPanelStyle = window.getComputedStyle(overviewPanel);
        const overviewCardStyle = window.getComputedStyle(overviewCard);

        return {
          overviewPanelBackground: overviewPanelStyle.backgroundColor,
          overviewPanelBorderTopWidth: overviewPanelStyle.borderTopWidth,
          overviewPanelBoxShadow: overviewPanelStyle.boxShadow,
          overviewCardBackground: overviewCardStyle.backgroundColor,
          overviewCardBorderTopWidth: overviewCardStyle.borderTopWidth,
          overviewCardBoxShadow: overviewCardStyle.boxShadow,
          artDisplay: overviewArt ? window.getComputedStyle(overviewArt).display : null,
          gaugeDisplay: overviewGauge ? window.getComputedStyle(overviewGauge).display : null
        };
      }, item.shellClass);

      expect(overviewTextMetrics.overviewPanelBackground).toBe("rgba(0, 0, 0, 0)");
      expect(overviewTextMetrics.overviewPanelBorderTopWidth).toBe("0px");
      expect(overviewTextMetrics.overviewPanelBoxShadow).toBe("none");
      expect(overviewTextMetrics.overviewCardBackground).toBe("rgba(0, 0, 0, 0)");
      expect(overviewTextMetrics.overviewCardBorderTopWidth).toBe("0px");
      expect(overviewTextMetrics.overviewCardBoxShadow).toBe("none");
      expect(overviewTextMetrics.artDisplay).toBe("none");
      expect([null, "none"]).toContain(overviewTextMetrics.gaugeDisplay);

      const desktopOverviewLayout = await readOverviewEditorLayout(item.shellClass);
      expect(desktopOverviewLayout.marketBefore).toContain("--- market ---");
      expect(desktopOverviewLayout.marketAfter).toContain("--- /market ---");
      expect(desktopOverviewLayout.communityBefore).toContain("--- community ---");
      expect(desktopOverviewLayout.communityAfter).toContain("--- /community ---");
      expect(desktopOverviewLayout.market.count).toBe(4);
      expect(desktopOverviewLayout.market.rowDisplay).toBe("grid");
      expect(desktopOverviewLayout.market.gridColumnCount).toBe(4);
      expect(desktopOverviewLayout.market.topSpread).toBeLessThanOrEqual(1);
      expect(desktopOverviewLayout.market.rowHeight).toBeGreaterThanOrEqual(desktopOverviewLayout.lineHeight * 1.8);
      expect(desktopOverviewLayout.market.rowHeight).toBeLessThanOrEqual(desktopOverviewLayout.lineHeight * 2.25);
      expect(desktopOverviewLayout.market.scrollWidth).toBeLessThanOrEqual(desktopOverviewLayout.market.clientWidth + 1);
      expect(desktopOverviewLayout.market.cardDisplays.every((display) => display === "grid")).toBe(true);
      expect(desktopOverviewLayout.market.secondSeparator).toContain("|");
      for (const card of desktopOverviewLayout.marketCards) {
        expect(Math.abs(card.height - desktopOverviewLayout.lineHeight * 2)).toBeLessThanOrEqual(1);
        expect(card.labelTopOffset).toBeLessThanOrEqual(2);
        expect(card.labelLeftOffset).toBeGreaterThanOrEqual(-1);
        expect(card.labelLeftOffset).toBeLessThanOrEqual(24);
        expect(card.valueTopOffset).toBeGreaterThanOrEqual(desktopOverviewLayout.lineHeight - 2);
        expect(card.valueRightOffset).toBeLessThanOrEqual(1);
        expect(card.valueBottomOffset).toBeLessThanOrEqual(1);
        expect(card.noteDisplay).toBe("none");
        expect(card.mainDisplay).toBe("flex");
        expect(card.mainJustifyContent).toBe("flex-end");
        expect(Number(card.valueOrder)).toBeGreaterThan(Number(card.deltaOrder));
      }
      expect(desktopOverviewLayout.community.count).toBe(4);
      expect(desktopOverviewLayout.community.rowDisplay).toBe("grid");
      expect(desktopOverviewLayout.community.gridColumnCount).toBe(4);
      expect(desktopOverviewLayout.community.topSpread).toBeLessThanOrEqual(1);
      expect(desktopOverviewLayout.community.rowHeight).toBeGreaterThanOrEqual(desktopOverviewLayout.lineHeight * 1.8);
      expect(desktopOverviewLayout.community.rowHeight).toBeLessThanOrEqual(desktopOverviewLayout.lineHeight * 2.25);
      expect(desktopOverviewLayout.community.scrollWidth).toBeLessThanOrEqual(desktopOverviewLayout.community.clientWidth + 1);
      expect(desktopOverviewLayout.community.cardDisplays.every((display) => display === "grid")).toBe(true);
      expect(desktopOverviewLayout.community.secondSeparator).toContain("|");
      for (const card of desktopOverviewLayout.communityCards) {
        expect(Math.abs(card.height - desktopOverviewLayout.lineHeight * 2)).toBeLessThanOrEqual(1);
        expect(card.labelTopOffset).toBeLessThanOrEqual(2);
        expect(card.labelLeftOffset).toBeGreaterThanOrEqual(-1);
        expect(card.labelLeftOffset).toBeLessThanOrEqual(24);
        expect(card.scoreTopOffset).toBeGreaterThanOrEqual(desktopOverviewLayout.lineHeight - 2);
        expect(card.scoreRightOffset).toBeLessThanOrEqual(1);
        expect(card.scoreBottomOffset).toBeLessThanOrEqual(1);
        expect(card.headDisplay).toBe("contents");
        expect(card.scoreDisplay).toBe("flex");
        expect(card.scoreJustifyContent).toBe("flex-end");
      }

      const desktopFeedLayout = await readFeedEditorLayout(item.shellClass);
      expect(desktopFeedLayout.columnsDisplay).toBe("grid");
      expect(desktopFeedLayout.gridColumnCount).toBe(2);
      expect(desktopFeedLayout.laneCount).toBe(2);
      expect(desktopFeedLayout.laneDisplays.every((display) => display === "grid")).toBe(true);
      expect(desktopFeedLayout.laneTopSpread).toBeLessThanOrEqual(1);
      expect(desktopFeedLayout.secondLaneStartsAfterFirst).toBe(true);
      expect(desktopFeedLayout.scrollWidth).toBeLessThanOrEqual(desktopFeedLayout.clientWidth + 1);

      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(`/?theme=${item.theme}`);
      await expect(page.locator("html")).toHaveAttribute("data-theme-shell", item.shell);
      const mobileOverviewLayout = await readOverviewEditorLayout(item.shellClass);
      expect(mobileOverviewLayout.market.count).toBe(4);
      expect(mobileOverviewLayout.market.gridColumnCount).toBe(1);
      expect(mobileOverviewLayout.market.leftSpread).toBeLessThanOrEqual(1);
      expect(mobileOverviewLayout.market.topIncreases).toBe(true);
      expect(mobileOverviewLayout.market.scrollWidth).toBeLessThanOrEqual(mobileOverviewLayout.market.clientWidth + 1);
      expect(mobileOverviewLayout.market.secondSeparator).not.toContain("|");
      for (const card of mobileOverviewLayout.marketCards) {
        expect(Math.abs(card.height - mobileOverviewLayout.lineHeight * 2)).toBeLessThanOrEqual(1);
        expect(card.valueRightOffset).toBeLessThanOrEqual(1);
        expect(card.noteDisplay).toBe("none");
      }
      expect(mobileOverviewLayout.community.count).toBe(4);
      expect(mobileOverviewLayout.community.gridColumnCount).toBe(1);
      expect(mobileOverviewLayout.community.leftSpread).toBeLessThanOrEqual(1);
      expect(mobileOverviewLayout.community.topIncreases).toBe(true);
      expect(mobileOverviewLayout.community.scrollWidth).toBeLessThanOrEqual(mobileOverviewLayout.community.clientWidth + 1);
      expect(mobileOverviewLayout.community.secondSeparator).not.toContain("|");
      for (const card of mobileOverviewLayout.communityCards) {
        expect(Math.abs(card.height - mobileOverviewLayout.lineHeight * 2)).toBeLessThanOrEqual(1);
        expect(card.scoreRightOffset).toBeLessThanOrEqual(1);
      }
    }
  });

  test("concept content surfaces adapt to the program family", async ({ page }) => {
    await prepareThemePage(page);
    await page.goto("/auth/login?theme=vscode-dark");
    const vscodeSurface = await page.getByTestId("theme-content-document").evaluate((element) => {
      const documentStyle = window.getComputedStyle(element);
      const frame = document.querySelector(".vscode-content-frame") as Element;
      const frameStyle = window.getComputedStyle(frame);
      const lineNumberStyle = window.getComputedStyle(element, "::before");
      const footer = element.querySelector(".site-footer") as HTMLElement;
      const documentRect = element.getBoundingClientRect();
      const frameRect = frame.getBoundingClientRect();
      const footerRect = footer.getBoundingClientRect();

      return {
        fontFamily: documentStyle.fontFamily.toLowerCase(),
        frameBackground: frameStyle.backgroundImage,
        footerGap: documentRect.bottom - footerRect.bottom,
        frameFooterGap: frameRect.bottom - footerRect.bottom,
        frameScrollHeight: frame.scrollHeight,
        frameClientHeight: frame.clientHeight,
        lineNumbers: lineNumberStyle.content,
        lineNumberBoxSizing: lineNumberStyle.boxSizing,
        lineNumberPaddingRight: parseFloat(lineNumberStyle.paddingRight)
      };
    });
    expect(vscodeSurface.fontFamily).toContain("monospace");
    expect(vscodeSurface.frameBackground).toContain("linear-gradient");
    expect(vscodeSurface.footerGap).toBeLessThanOrEqual(32);
    expect(vscodeSurface.frameFooterGap).toBeLessThanOrEqual(32);
    expect(vscodeSurface.frameScrollHeight).toBeLessThanOrEqual(vscodeSurface.frameClientHeight + 2);
    expect(vscodeSurface.lineNumberBoxSizing).toBe("border-box");
    expect(vscodeSurface.lineNumberPaddingRight).toBeGreaterThan(8);
    expect(vscodeSurface.lineNumbers).toContain("2");
    expect(vscodeSurface.lineNumbers).toContain("3");
    expect(vscodeSurface.lineNumbers).not.toContain("¢");
    expect(vscodeSurface.lineNumbers).not.toContain("£");

    await page.goto("/docs?theme=vscode-dark");
    await expect(page.locator(".vscode-content-frame")).toBeVisible();
    const vscodeScroll = await page.evaluate(() => {
      const frame = document.querySelector(".vscode-content-frame") as HTMLElement;
      frame.scrollTop = frame.scrollHeight;
      return {
        clientHeight: frame.clientHeight,
        scrollHeight: frame.scrollHeight,
        scrollTop: frame.scrollTop
      };
    });
    expect(vscodeScroll.scrollHeight).toBeGreaterThan(vscodeScroll.clientHeight);
    expect(vscodeScroll.scrollTop).toBeGreaterThan(100);

    await page.goto("/auth/login?theme=jetbrains-light");
    const jetbrainsSurface = await page.evaluate(() => {
      const gutter = document.querySelector(".jetbrains-gutter") as HTMLElement;
      const lineNumbers = [...gutter.querySelectorAll("span")] as HTMLElement[];
      const firstLine = lineNumbers[0];
      const secondLine = lineNumbers[1];
      const documentElement = document.querySelector(".theme-shell-jetbrains .theme-shell-content-document") as HTMLElement;
      const gutterStyle = window.getComputedStyle(gutter);
      const documentStyle = window.getComputedStyle(documentElement);
      const body = document.querySelector(".jetbrains-editor-body") as HTMLElement;
      const frame = document.querySelector(".jetbrains-content-frame") as HTMLElement;
      const bodyStyle = window.getComputedStyle(body);
      const frameStyle = window.getComputedStyle(frame);
      const firstLineRect = firstLine.getBoundingClientRect();
      const secondLineRect = secondLine.getBoundingClientRect();
      const documentRect = documentElement.getBoundingClientRect();
      const documentLineHeight = parseFloat(documentStyle.lineHeight);
      const documentPaddingTop = parseFloat(documentStyle.paddingTop);

      return {
        lineCount: lineNumbers.length,
        bodyOverflowY: bodyStyle.overflowY,
        bodyScrollHeight: body.scrollHeight,
        bodyClientHeight: body.clientHeight,
        frameOverflowY: frameStyle.overflowY,
        gutterGap: gutterStyle.gap,
        gutterLineHeight: parseFloat(gutterStyle.lineHeight),
        documentLineHeight,
        firstLineOffset: firstLineRect.top - (documentRect.top + documentPaddingTop),
        lineStep: secondLineRect.top - firstLineRect.top
      };
    });
    expect(jetbrainsSurface.lineCount).toBeGreaterThanOrEqual(60);
    expect(jetbrainsSurface.bodyOverflowY).toBe("auto");
    expect(jetbrainsSurface.bodyScrollHeight).toBeLessThanOrEqual(jetbrainsSurface.bodyClientHeight + 2);
    expect(jetbrainsSurface.frameOverflowY).toBe("visible");
    expect(jetbrainsSurface.gutterGap).toBe("0px");
    expect(Math.abs(jetbrainsSurface.gutterLineHeight - jetbrainsSurface.documentLineHeight)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(jetbrainsSurface.firstLineOffset)).toBeLessThanOrEqual(1);
    expect(Math.abs(jetbrainsSurface.lineStep - jetbrainsSurface.documentLineHeight)).toBeLessThanOrEqual(1);

    await page.goto("/docs?theme=jetbrains-light");
    await expect(page.locator(".jetbrains-editor-body")).toBeVisible();
    const jetbrainsScroll = await page.evaluate(() => {
      const body = document.querySelector(".jetbrains-editor-body") as HTMLElement;
      const frame = document.querySelector(".jetbrains-content-frame") as HTMLElement;
      body.scrollTop = body.scrollHeight;
      return {
        bodyClientHeight: body.clientHeight,
        bodyScrollHeight: body.scrollHeight,
        bodyScrollTop: body.scrollTop,
        frameScrollTop: frame.scrollTop
      };
    });
    expect(jetbrainsScroll.bodyScrollHeight).toBeGreaterThan(jetbrainsScroll.bodyClientHeight);
    expect(jetbrainsScroll.bodyScrollTop).toBeGreaterThan(100);
    expect(jetbrainsScroll.frameScrollTop).toBe(0);

    await page.goto("/?theme=excel-light");
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

      return {
        frameBackground: window.getComputedStyle(frame).backgroundColor,
        pageBackground: window.getComputedStyle(page).backgroundColor,
        pageShadow: window.getComputedStyle(page).boxShadow,
        headingMarker: window.getComputedStyle(heading, "::before").content
      };
    });
    expect(docsEditorChrome.frameBackground).toBe("rgb(241, 243, 244)");
    expect(docsEditorChrome.pageBackground).toBe("rgb(255, 255, 255)");
    expect(docsEditorChrome.pageShadow).not.toBe("none");
    expect(docsEditorChrome.headingMarker).toBe("none");
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

  test("theme favicon follows the concept family across tones", async ({ page }) => {
    const cases = [
      { theme: "excel-light", iconPath: "/theme-icons/excel.svg" },
      { theme: "excel-dark", iconPath: "/theme-icons/excel.svg" },
      { theme: "excel-system", iconPath: "/theme-icons/excel.svg" },
      { theme: "powerpoint-dark", iconPath: "/theme-icons/powerpoint.svg" },
      { theme: "light", iconPath: "/favicon.ico" }
    ];

    await prepareThemePage(page);

    for (const item of cases) {
      await page.goto(`/?theme=${item.theme}`);
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
    await page.goto("/?theme=unknown");

    await expect(page.locator("html")).toHaveAttribute("data-theme-id", "light");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(page.locator("html")).toHaveAttribute("data-theme-shell", "default");
    await expect(page.getByTestId("program-shell")).toHaveCount(0);
    await expect(page.locator(".header")).toBeVisible();

    await page.goto("/?theme=vs-dark");
    await expect(page.locator("html")).toHaveAttribute("data-theme-id", "light");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(page.locator("html")).toHaveAttribute("data-theme-shell", "default");
    await expect(page.getByTestId("program-shell")).toHaveCount(0);
    await expect(page.locator(".header")).toBeVisible();

    await page.evaluate((key) => {
      window.localStorage.setItem(key, "vs-dark");
    }, THEME_STORAGE_KEY);
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-theme-id", "light");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(page.locator("html")).toHaveAttribute("data-theme-shell", "default");
    await expect(page.getByTestId("program-shell")).toHaveCount(0);
    await expect(page.locator(".header")).toBeVisible();
  });
});
