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
  const header = page.getByTestId("program-header");
  await expect(page.locator(".header")).toHaveCount(0);
  await expect(page.getByTestId("program-shell")).toHaveAttribute("data-program-shell", shell);
  await expect(header).toBeVisible();
  await expect(page.getByTestId("concept-header-actions")).toBeVisible();
  await expect(header.locator(".theme-shell-logo")).toHaveCount(0);
  await expect(header.locator('img[src*="goksorry_logo"]')).toHaveCount(0);
  await expect(header.getByRole("link", { name: "곡소리닷컴 홈" })).toHaveText("곡소리닷컴");
  await expect(header.getByRole("link", { name: "피드" })).toBeVisible();
  await expect(header.getByRole("link", { name: "게시판" })).toBeVisible();
  await expect(header.getByRole("link", { name: "곡소리방" })).toBeVisible();
  await expect(page.getByTestId("concept-header-actions").getByRole("button", { name: /테마 선택/ })).toHaveText("🎨");
  await expect(page.getByTestId("program-content-area")).toBeVisible();
  await expect(page.getByTestId("program-status-bar")).toBeVisible();
  await expect(page.getByTestId("theme-content-document")).toBeVisible();
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
    await expect(page.locator(".header").getByRole("button", { name: /테마 선택/ })).toHaveText("🎨");
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
    await expect(page.getByTestId("program-header").getByRole("button", { name: "Save mock command" })).toHaveCount(0);
    await expect(page.getByTestId("program-header").getByRole("button", { name: "Undo mock command" })).toHaveCount(0);
    await expect(page.getByTestId("program-header").getByRole("button", { name: "Analyze mock command" })).toHaveCount(0);

    await expect.poll(async () => page.getByTestId("excel-column-headers").locator("span").count()).toBeGreaterThan(8);

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
    expect(expectedColumnCount).toBeGreaterThan(8);
    expect(sheetMetrics.columnCount).toBe(expectedColumnCount);
    expect(sheetMetrics.lastColumn).not.toBe("H");
    expect(Math.abs(sheetMetrics.firstHeaderWidth - sheetMetrics.contentWidth / expectedColumnCount)).toBeLessThanOrEqual(1);

    const excelContentChrome = await page.evaluate(() => {
      const documentElement = document.querySelector("[data-testid='theme-content-document']") as HTMLElement;
      const frame = document.querySelector(".excel-content-frame") as HTMLElement;
      const tableCell = document.querySelector(".theme-shell-excel .table th, .theme-shell-excel .table td") as HTMLElement | null;
      const sheetTab = document.querySelector(".excel-sheet-tabs a") as HTMLElement;
      const headerButton = document.querySelector(".theme-shell-excel .theme-menu-trigger") as HTMLElement;
      const rowHeaderCell = document.querySelector(".excel-row-headers span") as HTMLElement;
      const documentStyle = window.getComputedStyle(documentElement);
      const frameStyle = window.getComputedStyle(frame);
      const tableCellStyle = tableCell ? window.getComputedStyle(tableCell) : null;
      const sheetTabStyle = window.getComputedStyle(sheetTab);
      const headerButtonStyle = window.getComputedStyle(headerButton);

      return {
        columnWidth: Number.parseFloat(documentStyle.getPropertyValue("--excel-column-width")),
        rowHeight: rowHeaderCell.getBoundingClientRect().height,
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
        headerButtonRadius: headerButtonStyle.borderRadius
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
    expect(excelContentChrome.sheetTabRadius).toBe("0px");
    expect(excelContentChrome.headerButtonRadius).toBe("0px");

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

  test("excel theme keeps overview art subtle and stacks indicators on mobile", async ({ page }, testInfo) => {
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
        communityStack: getStackMetrics(communityCards)
      };
    });

    expect(mobileOverview.artDisplay).toBe("block");
    expect(mobileOverview.artOpacity).toBeGreaterThanOrEqual(0.12);
    expect(mobileOverview.artOpacity).toBeLessThanOrEqual(0.18);
    expect(mobileOverview.artBackground).toContain("overview-regime");
    expect(Math.abs(mobileOverview.marketBlockHeight - mobileOverview.rowHeight * 9)).toBeLessThanOrEqual(1);
    expect(Math.abs(mobileOverview.overviewPanelHeight - mobileOverview.rowHeight * 14)).toBeLessThanOrEqual(1);
    expect(mobileOverview.marketRowScrollWidth).toBeLessThanOrEqual(mobileOverview.marketRowClientWidth + 1);
    expect(mobileOverview.bottomRowScrollWidth).toBeLessThanOrEqual(mobileOverview.bottomRowClientWidth + 1);
    expect(mobileOverview.marketStack.count).toBe(4);
    expect(mobileOverview.marketStack.leftSpread).toBeLessThanOrEqual(1);
    expect(mobileOverview.marketStack.topIncreases).toBe(true);
    expect(mobileOverview.marketStack.heights.every((height) => Math.abs(height - mobileOverview.rowHeight * 2) <= 1)).toBe(true);
    expect(mobileOverview.communityStack.count).toBe(4);
    expect(mobileOverview.communityStack.leftSpread).toBeLessThanOrEqual(1);
    expect(mobileOverview.communityStack.topIncreases).toBe(true);
    expect(mobileOverview.communityStack.heights.every((height) => Math.abs(height - mobileOverview.rowHeight * 2) <= 1)).toBe(true);

    await page.screenshot({ path: testInfo.outputPath("excel-mobile.png"), fullPage: false });
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

  test("concept content surfaces adapt to the program family", async ({ page }) => {
    await prepareThemePage(page);
    await page.goto("/?theme=vscode-dark");
    const vscodeSurface = await page.getByTestId("theme-content-document").evaluate((element) => {
      const documentStyle = window.getComputedStyle(element);
      const frameStyle = window.getComputedStyle(document.querySelector(".vscode-content-frame") as Element);

      return {
        fontFamily: documentStyle.fontFamily.toLowerCase(),
        frameBackground: frameStyle.backgroundImage
      };
    });
    expect(vscodeSurface.fontFamily).toContain("monospace");
    expect(vscodeSurface.frameBackground).toContain("linear-gradient");

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
    const docsHeadingMarker = await page.locator(".theme-shell-docs .docs-shell h1").first().evaluate((element) => {
      return window.getComputedStyle(element, "::before").content;
    });
    expect(docsHeadingMarker).toContain("#");
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
