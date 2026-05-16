"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import {
  SHELL_ROUTES,
  ShellBrand,
  ShellCommandButton,
  ShellHeaderActions,
  ShellNavLinks,
  ShellStatusBar,
  WindowDots,
  normalizePath,
  useShellRoute,
  type ThemeShellProps
} from "@/components/theme-shells/common";

const EXCEL_TABS = ["File", "Home", "Insert", "Page Layout", "Formulas", "Data", "Review", "View", "Help"] as const;

const EXCEL_GROUPS = [
  { label: "Clipboard", commands: [["Paste", "clipboard"], ["Cut", "file"], ["Copy", "copy"]] },
  { label: "Font", commands: [["Bold", "bold"], ["Fill", "spark"], ["Border", "grid"]] },
  { label: "Alignment", commands: [["Wrap", "layout"], ["Merge", "table"], ["Center", "settings"]] },
  { label: "Number", commands: [["Format", "document"], ["Percent", "chart"], ["Comma", "file"]] },
  { label: "Styles", commands: [["Conditional", "spark"], ["Table", "table"]] },
  { label: "Cells", commands: [["Insert", "grid"], ["Delete", "archive"]] },
  { label: "Editing", commands: [["Sort", "chart"], ["Find", "find"]] }
] as const;

const EXCEL_TARGET_COLUMN_WIDTH = 100;
const EXCEL_DEFAULT_COLUMN_COUNT = 8;
const EXCEL_MIN_ROW_COUNT = 40;
const EXCEL_ROW_HEIGHT = 35.2;

const getExcelColumnLabel = (index: number): string => {
  let label = "";
  let cursor = index;

  do {
    label = String.fromCharCode(65 + (cursor % 26)) + label;
    cursor = Math.floor(cursor / 26) - 1;
  } while (cursor >= 0);

  return label;
};

export function ExcelShell({ children, option, chatSidebar }: ThemeShellProps) {
  const { pathname, currentRoute } = useShellRoute();
  const contentFrameRef = useRef<HTMLDivElement>(null);
  const rowHeadersRef = useRef<HTMLDivElement>(null);
  const [columnMetrics, setColumnMetrics] = useState({
    count: EXCEL_DEFAULT_COLUMN_COUNT,
    width: EXCEL_TARGET_COLUMN_WIDTH
  });
  const [rowCount, setRowCount] = useState(EXCEL_MIN_ROW_COUNT);

  const columns = useMemo(
    () => Array.from({ length: columnMetrics.count }, (_, index) => getExcelColumnLabel(index)),
    [columnMetrics.count]
  );
  const rows = useMemo(() => Array.from({ length: rowCount }, (_, index) => index + 1), [rowCount]);
  const gridStyle = {
    "--excel-column-count": String(columnMetrics.count),
    "--excel-column-width": `${columnMetrics.width}px`
  } as CSSProperties;

  const syncRowHeaders = useCallback(() => {
    const frame = contentFrameRef.current;
    const rowHeaders = rowHeadersRef.current;

    if (!frame || !rowHeaders) {
      return;
    }

    rowHeaders.style.transform = `translateY(-${frame.scrollTop}px)`;
  }, []);

  useEffect(() => {
    const frame = contentFrameRef.current;

    if (!frame) {
      return undefined;
    }

    const updateColumns = () => {
      const availableWidth = frame.clientWidth;

      if (availableWidth <= 0) {
        return;
      }

      const count = Math.max(1, Math.floor(availableWidth / EXCEL_TARGET_COLUMN_WIDTH));
      const width = availableWidth / count;

      setColumnMetrics((current) => {
        if (current.count === count && Math.abs(current.width - width) < 0.1) {
          return current;
        }

        return { count, width };
      });
    };

    updateColumns();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateColumns);

      return () => {
        window.removeEventListener("resize", updateColumns);
      };
    }

    const resizeObserver = new ResizeObserver(updateColumns);
    resizeObserver.observe(frame);
    window.addEventListener("resize", updateColumns);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateColumns);
    };
  }, []);

  useEffect(() => {
    const frame = contentFrameRef.current;

    if (!frame) {
      return undefined;
    }

    const updateRows = () => {
      const nextRowCount = Math.max(EXCEL_MIN_ROW_COUNT, Math.ceil(frame.scrollHeight / EXCEL_ROW_HEIGHT));
      setRowCount((current) => (current === nextRowCount ? current : nextRowCount));
      syncRowHeaders();
    };

    updateRows();

    const resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(updateRows);
    const mutationObserver = typeof MutationObserver === "undefined" ? null : new MutationObserver(updateRows);

    resizeObserver?.observe(frame);
    mutationObserver?.observe(frame, {
      attributes: true,
      childList: true,
      characterData: true,
      subtree: true
    });
    window.addEventListener("resize", updateRows);

    return () => {
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
      window.removeEventListener("resize", updateRows);
    };
  }, [pathname, syncRowHeaders]);

  return (
    <div className="theme-shell theme-shell-excel" data-testid="program-shell" data-program-shell="excel">
      <div className="excel-titlebar" data-testid="program-header">
        <WindowDots />
        <ShellBrand family={option.family} productName="Excel" />
        <ShellNavLinks />
        <div className="excel-title">{currentRoute.fileName}</div>
        <ShellHeaderActions />
      </div>

      <div className="excel-ribbon" data-testid="excel-ribbon">
        <div className="excel-ribbon-tabs">
          {EXCEL_TABS.map((tab) => (
            <button key={tab} type="button" className={tab === "Home" ? "theme-shell-active" : ""}>
              {tab}
            </button>
          ))}
        </div>
        <div className="excel-ribbon-groups">
          {EXCEL_GROUPS.map((group) => (
            <section key={group.label} className="excel-ribbon-group">
              <div>
                {group.commands.map(([label, icon]) => (
                  <ShellCommandButton key={label} label={label} icon={icon} />
                ))}
              </div>
              <p>{group.label}</p>
            </section>
          ))}
        </div>
      </div>

      <div className="excel-formula-bar" data-testid="excel-formula-bar">
        <div className="excel-name-box">{currentRoute.cell}</div>
        <div className="excel-fx">fx</div>
        <input readOnly aria-label="수식 입력줄" value={`=${currentRoute.formula} // ${normalizePath(pathname)}`} />
      </div>

      <section className="theme-shell-workspace excel-workspace">
        <div className="theme-shell-content-area" data-testid="program-content-area">
          <div className="excel-grid-shell" style={gridStyle}>
            <div className="excel-grid-corner" aria-hidden="true" />
            <div className="excel-column-headers" data-testid="excel-column-headers" aria-hidden="true">
              {columns.map((column) => (
                <span key={column}>{column}</span>
              ))}
            </div>
            <div className="excel-row-header-viewport" data-testid="excel-row-headers" aria-hidden="true">
              <div ref={rowHeadersRef} className="excel-row-headers">
                {rows.map((row) => (
                  <span key={row}>{row}</span>
                ))}
              </div>
            </div>
            <div ref={contentFrameRef} className="theme-shell-content-frame excel-content-frame" onScroll={syncRowHeaders}>
              {children}
            </div>
          </div>
        </div>
        {chatSidebar}
      </section>

      <div className="excel-sheet-tabs" data-testid="excel-sheet-tabs">
        {SHELL_ROUTES.map((route) => (
          <Link key={route.href} href={route.href} className={route.href === currentRoute.href ? "theme-shell-active" : ""}>
            {route.label}
          </Link>
        ))}
        <button type="button" aria-label="새 시트 mock">
          +
        </button>
      </div>
      <ShellStatusBar option={option} shellType="excel" currentRoute={currentRoute} />
    </div>
  );
}
