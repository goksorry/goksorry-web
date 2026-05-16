import { expect, test, type Page } from "@playwright/test";

const CLEAN_FILTER_COOKIE = "goksorry-clean-filter";
const COOKIE_CONSENT_COOKIE = "goksorry-cookie-consent";
const THEME_STORAGE_KEY = "goksorry-theme";
const CHAT_LAYOUT_ENABLED = Boolean(process.env.CHAT_WS_BASE_URL);
const THEME_ICON_PATH_BY_SHELL: Record<string, string> = {
  excel: "/theme-icons/excel.svg",
  powerpoint: "/theme-icons/powerpoint.svg",
  docs: "/theme-icons/docs.svg",
  vscode: "/theme-icons/vscode.svg",
  jetbrains: "/theme-icons/jetbrains.svg",
  "visual-studio": "/theme-icons/visual-studio.svg"
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

    const excelRibbonMetrics = await page.evaluate(() => {
      const commandButtons = Array.from(document.querySelectorAll(".excel-ribbon-command")) as HTMLElement[];
      const selectButtons = Array.from(document.querySelectorAll(".excel-ribbon-command-select")) as HTMLElement[];
      const commandRects = commandButtons.map((button) => button.getBoundingClientRect());
      const ribbonRect = (document.querySelector("[data-testid='excel-single-line-ribbon']") as HTMLElement).getBoundingClientRect();
      const commandTops = commandRects.map((rect) => Math.round(rect.top));

      return {
        commandCount: commandButtons.length,
        iconCount: document.querySelectorAll(".excel-ribbon-command .excel-command-icon").length,
        groupLabelCount: document.querySelectorAll(".excel-ribbon-group p").length,
        legacyLargeCount: document.querySelectorAll(".excel-ribbon-command-large").length,
        separatorCount: document.querySelectorAll(".excel-ribbon-separator").length,
        selectCount: selectButtons.length,
        commandHeights: commandRects.map((rect) => Math.round(rect.height)),
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
    expect(excelRibbonMetrics.topSpread).toBeLessThanOrEqual(1);
    expect(excelRibbonMetrics.ribbonHeight).toBeLessThanOrEqual(52);

    const excelFormulaMetrics = await page.evaluate(() => {
      const controls = Array.from(
        document.querySelectorAll(".excel-name-box, .excel-formula-action, .excel-fx, .excel-formula-bar input")
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
      const rowHeaderCell = document.querySelector(".excel-row-headers span") as HTMLElement;
      const columnHeaders = document.querySelector("[data-testid='excel-column-headers']") as HTMLElement;
      const documentStyle = window.getComputedStyle(documentElement);
      const frameStyle = window.getComputedStyle(frame);
      const columnHeadersStyle = window.getComputedStyle(columnHeaders);
      const tableCellStyle = tableCell ? window.getComputedStyle(tableCell) : null;
      const sheetTabStyle = window.getComputedStyle(sheetTab);
      const headerButtonStyle = window.getComputedStyle(headerButton);
      const selectedColumn = document.querySelector(".excel-column-headers .excel-header-active") as HTMLElement;
      const selectedRow = document.querySelector(".excel-row-headers .excel-header-active") as HTMLElement;
      const selection = document.querySelector("[data-testid='excel-selection-box']") as HTMLElement;
      const contentLink = frame.querySelector("a") as HTMLElement | null;
      const selectionStyle = window.getComputedStyle(selection);

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
        selectedColumnBackground: window.getComputedStyle(selectedColumn).backgroundColor,
        selectedColumnColor: window.getComputedStyle(selectedColumn).color,
        selectedRowBackground: window.getComputedStyle(selectedRow).backgroundColor,
        selectionBorderColor: selectionStyle.borderTopColor,
        contentCursor: frameStyle.cursor,
        contentLinkCursor: contentLink ? window.getComputedStyle(contentLink).cursor : null
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
    if (excelContentChrome.tableCellHeight !== null) {
      expect(Math.abs(excelContentChrome.tableCellHeight - excelContentChrome.rowHeight)).toBeLessThanOrEqual(1);
    }
    expect(Number.parseFloat(excelContentChrome.sheetTabRadius)).toBeGreaterThan(0);
    expect(Number.parseFloat(excelContentChrome.headerButtonRadius)).toBeGreaterThan(0);
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

  test("excel theme keeps overview art subtle and uses one-cell mobile indicators", async ({ page }, testInfo) => {
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
    expect(mobileOverview.artOpacity).toBeGreaterThanOrEqual(0.12);
    expect(mobileOverview.artOpacity).toBeLessThanOrEqual(0.18);
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
      { url: "/?theme=docs-light", shell: "docs" },
      { url: "/?theme=vscode-dark", shell: "vscode" },
      { url: "/?theme=jetbrains-light", shell: "jetbrains" },
      { url: "/?theme=vs-dark", shell: "visual-studio" }
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
      { theme: "jetbrains-light", shell: "jetbrains", locator: "jetbrains-sidebar" },
      { theme: "vs-dark", shell: "visual-studio", locator: "visual-studio-sidebar" }
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

    const cases = [
      { theme: "light", shell: "default" },
      { theme: "excel-light", shell: "excel" },
      { theme: "powerpoint-dark", shell: "powerpoint" },
      { theme: "docs-light", shell: "docs" },
      { theme: "vscode-dark", shell: "vscode" },
      { theme: "jetbrains-light", shell: "jetbrains" },
      { theme: "vs-dark", shell: "visual-studio" }
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

    await page.setViewportSize({ width: 900, height: 760 });
    await prepareThemePage(page);
    await page.goto("/?theme=docs-light");

    await expect(page.getByTestId("desktop-chat-sidebar")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "실시간 채팅" })).toBeVisible();

    await page.getByRole("button", { name: "실시간 채팅" }).click();
    await expect(page.locator("#global-chat-dock")).toBeVisible();
    await expect(page.locator("#global-chat-dock").getByText("전체 채팅")).toBeVisible();

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
      .toBe("rgb(247, 242, 238)");

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

    await page.goto("/?theme=vs-dark");
    expect(
      await readRootThemeVars(page, [
        "--brand",
        "--visual-studio-titlebar-bg",
        "--visual-studio-toolbar-bg",
        "--visual-studio-editor-bg"
      ])
    ).toMatchObject({
      "--brand": "#007acc",
      "--visual-studio-titlebar-bg": "#2d2d30",
      "--visual-studio-toolbar-bg": "#3f3f46",
      "--visual-studio-editor-bg": "#1e1e1e"
    });
    const visualStudioChrome = await page.evaluate(() => ({
      titlebar: getComputedStyle(document.querySelector(".visual-studio-titlebar") as HTMLElement).backgroundColor,
      toolbar: getComputedStyle(document.querySelector(".visual-studio-toolbar") as HTMLElement).backgroundColor,
      solution: getComputedStyle(document.querySelector(".visual-studio-solution") as HTMLElement).backgroundColor,
      status: getComputedStyle(document.querySelector("[data-testid='program-status-bar']") as HTMLElement).backgroundColor
    }));
    expect(visualStudioChrome).toMatchObject({
      titlebar: "rgb(45, 45, 48)",
      toolbar: "rgb(63, 63, 70)",
      solution: "rgb(45, 45, 48)",
      status: "rgb(0, 122, 204)"
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
      { theme: "jetbrains-light", shell: "jetbrains" },
      { theme: "vs-dark", shell: "visual-studio" }
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

  test("concept content surfaces adapt to the program family", async ({ page }) => {
    await prepareThemePage(page);
    await page.goto("/?theme=vscode-dark");
    const vscodeSurface = await page.getByTestId("theme-content-document").evaluate((element) => {
      const documentStyle = window.getComputedStyle(element);
      const frame = document.querySelector(".vscode-content-frame") as Element;
      const frameStyle = window.getComputedStyle(frame);
      const lineNumberStyle = window.getComputedStyle(frame, "::before");

      return {
        fontFamily: documentStyle.fontFamily.toLowerCase(),
        frameBackground: frameStyle.backgroundImage,
        lineNumbers: lineNumberStyle.content,
        lineNumberBoxSizing: lineNumberStyle.boxSizing,
        lineNumberPaddingRight: parseFloat(lineNumberStyle.paddingRight)
      };
    });
    expect(vscodeSurface.fontFamily).toContain("monospace");
    expect(vscodeSurface.frameBackground).toContain("linear-gradient");
    expect(vscodeSurface.lineNumberBoxSizing).toBe("border-box");
    expect(vscodeSurface.lineNumberPaddingRight).toBeGreaterThan(8);
    expect(vscodeSurface.lineNumbers).toContain("2");
    expect(vscodeSurface.lineNumbers).toContain("3");
    expect(vscodeSurface.lineNumbers).not.toContain("¢");
    expect(vscodeSurface.lineNumbers).not.toContain("£");

    await page.goto("/?theme=vs-dark");
    const visualStudioLineNumberStyle = await page.locator(".visual-studio-content-frame").evaluate((element) => {
      const lineNumberStyle = window.getComputedStyle(element, "::before");

      return {
        lineNumbers: lineNumberStyle.content,
        boxSizing: lineNumberStyle.boxSizing,
        paddingRight: parseFloat(lineNumberStyle.paddingRight)
      };
    });
    expect(visualStudioLineNumberStyle.boxSizing).toBe("border-box");
    expect(visualStudioLineNumberStyle.paddingRight).toBeGreaterThan(8);
    expect(visualStudioLineNumberStyle.lineNumbers).toContain("2");
    expect(visualStudioLineNumberStyle.lineNumbers).toContain("3");
    expect(visualStudioLineNumberStyle.lineNumbers).not.toContain("¢");
    expect(visualStudioLineNumberStyle.lineNumbers).not.toContain("£");

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
      { theme: "vs-dark", iconPath: "/theme-icons/visual-studio.svg" },
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
  });
});
