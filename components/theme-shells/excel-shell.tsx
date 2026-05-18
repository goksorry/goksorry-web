"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import Link from "next/link";
import {
  SHELL_ROUTES,
  ShellHeaderActions,
  ShellStatusBar,
  normalizePath,
  useShellRoute,
  type ThemeShellProps
} from "@/components/theme-shells/common";
import { getThemeFamilyIcon } from "@/lib/theme";

const EXCEL_TABS = ["File", "Home", "Insert", "Draw", "Page Layout", "Formulas", "Data", "Review", "View", "Automate", "Help"] as const;

type ExcelRibbonIconName =
  | "undo"
  | "redo"
  | "paste"
  | "font"
  | "bold"
  | "italic"
  | "underline"
  | "fill"
  | "fontColor"
  | "borders"
  | "align"
  | "merge"
  | "number"
  | "sum"
  | "filter"
  | "find"
  | "ideas"
  | "ribbon";

const EXCEL_SINGLE_LINE_COMMANDS = [
  { type: "button", label: "Undo", icon: "undo", iconOnly: true },
  { type: "button", label: "Redo", icon: "redo", iconOnly: true },
  { type: "separator" },
  { type: "button", label: "Paste", value: "Paste", icon: "paste" },
  { type: "separator" },
  { type: "select", label: "Font family", value: "Aptos", icon: "font", wide: true },
  { type: "select", label: "Font size", value: "11" },
  { type: "button", label: "Bold", icon: "bold", active: true, iconOnly: true },
  { type: "button", label: "Italic", icon: "italic", iconOnly: true },
  { type: "button", label: "Underline", icon: "underline", iconOnly: true },
  { type: "button", label: "Fill color", icon: "fill", iconOnly: true },
  { type: "button", label: "Font color", icon: "fontColor", iconOnly: true },
  { type: "button", label: "Borders", icon: "borders", iconOnly: true },
  { type: "separator" },
  { type: "select", label: "Align", value: "Align", icon: "align" },
  { type: "select", label: "Merge cells", value: "Merge", icon: "merge" },
  { type: "select", label: "Number format", value: "General", icon: "number", wide: true },
  { type: "separator" },
  { type: "button", label: "AutoSum", value: "AutoSum", icon: "sum" },
  { type: "button", label: "Sort & Filter", value: "Sort", icon: "filter" },
  { type: "button", label: "Find & Select", value: "Find", icon: "find" },
  { type: "button", label: "Ideas", value: "Ideas", icon: "ideas" }
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

function ExcelRibbonIcon({ name }: { name: ExcelRibbonIconName }) {
  switch (name) {
    case "undo":
      return (
        <svg className="excel-command-svg" viewBox="0 0 20 20" aria-hidden="true">
          <path d="M8 5 4 9l4 4" />
          <path d="M5 9h6.5a4 4 0 1 1 0 8H9" />
        </svg>
      );
    case "redo":
      return (
        <svg className="excel-command-svg" viewBox="0 0 20 20" aria-hidden="true">
          <path d="m12 5 4 4-4 4" />
          <path d="M15 9H8.5a4 4 0 1 0 0 8H11" />
        </svg>
      );
    case "paste":
      return (
        <svg className="excel-command-svg" viewBox="0 0 20 20" aria-hidden="true">
          <path d="M7 4h6l1 2H6l1-2Z" />
          <path d="M5 6h10v11H5z" />
          <path d="M7.5 10h5M7.5 13h4" />
        </svg>
      );
    case "font":
      return (
        <svg className="excel-command-svg" viewBox="0 0 20 20" aria-hidden="true">
          <path d="m4 16 5-12h2l5 12" />
          <path d="M6.5 11h7" />
        </svg>
      );
    case "bold":
      return (
        <svg className="excel-command-svg" viewBox="0 0 20 20" aria-hidden="true">
          <text x="5" y="15" fontSize="13" fontWeight="800">
            B
          </text>
        </svg>
      );
    case "italic":
      return (
        <svg className="excel-command-svg" viewBox="0 0 20 20" aria-hidden="true">
          <text x="7" y="15" fontSize="13" fontStyle="italic" fontWeight="700">
            I
          </text>
        </svg>
      );
    case "underline":
      return (
        <svg className="excel-command-svg" viewBox="0 0 20 20" aria-hidden="true">
          <text x="5" y="13" fontSize="12" fontWeight="700">
            U
          </text>
          <path d="M5 16h9" />
        </svg>
      );
    case "fill":
      return (
        <svg className="excel-command-svg" viewBox="0 0 20 20" aria-hidden="true">
          <path d="m7 4 7 7-4 4-7-7 4-4Z" />
          <path d="M12 13h5v3h-5z" />
        </svg>
      );
    case "fontColor":
      return (
        <svg className="excel-command-svg" viewBox="0 0 20 20" aria-hidden="true">
          <path d="m4 15 5-11h2l5 11" />
          <path d="M6.5 10.5h7M4 17h12" />
        </svg>
      );
    case "borders":
      return (
        <svg className="excel-command-svg" viewBox="0 0 20 20" aria-hidden="true">
          <path d="M4 4h12v12H4zM10 4v12M4 10h12" />
        </svg>
      );
    case "align":
      return (
        <svg className="excel-command-svg" viewBox="0 0 20 20" aria-hidden="true">
          <path d="M4 6h12M4 10h9M4 14h12" />
        </svg>
      );
    case "merge":
      return (
        <svg className="excel-command-svg" viewBox="0 0 20 20" aria-hidden="true">
          <path d="M4 5h12v10H4zM8 5v10M12 5v10" />
          <path d="m7 10 2-2m-2 2 2 2m4-4 2 2m-2 2 2-2" />
        </svg>
      );
    case "number":
      return (
        <svg className="excel-command-svg" viewBox="0 0 20 20" aria-hidden="true">
          <text x="3" y="14" fontSize="8" fontWeight="700">
            123
          </text>
        </svg>
      );
    case "sum":
      return (
        <svg className="excel-command-svg" viewBox="0 0 20 20" aria-hidden="true">
          <path d="M14.5 4H5l5.5 6L5 16h10" />
        </svg>
      );
    case "filter":
      return (
        <svg className="excel-command-svg" viewBox="0 0 20 20" aria-hidden="true">
          <path d="M4 5h12l-5 6v4l-2 1v-5L4 5Z" />
        </svg>
      );
    case "find":
      return (
        <svg className="excel-command-svg" viewBox="0 0 20 20" aria-hidden="true">
          <circle cx="8.5" cy="8.5" r="4.5" />
          <path d="m12 12 4 4" />
        </svg>
      );
    case "ideas":
      return (
        <svg className="excel-command-svg" viewBox="0 0 20 20" aria-hidden="true">
          <path d="M10 3a5 5 0 0 0-3 9v2h6v-2a5 5 0 0 0-3-9Z" />
          <path d="M8 17h4M8 14h4" />
        </svg>
      );
    case "ribbon":
      return (
        <svg className="excel-command-svg" viewBox="0 0 20 20" aria-hidden="true">
          <path d="M4 5h12M4 9h12M4 13h8" />
          <path d="m14 12 2 2 2-2" />
        </svg>
      );
  }
}

function ExcelRibbonCommand({
  label,
  value,
  icon,
  active = false,
  iconOnly = false,
  variant = "button",
  wide = false
}: {
  label: string;
  value?: string;
  icon?: ExcelRibbonIconName;
  active?: boolean;
  iconOnly?: boolean;
  variant?: "button" | "select";
  wide?: boolean;
}) {
  return (
    <button
      type="button"
      className={`excel-ribbon-command excel-ribbon-command-${variant}${active ? " excel-ribbon-command-active" : ""}${
        iconOnly ? " excel-ribbon-command-icon-only" : ""
      }${wide ? " excel-ribbon-command-wide" : ""}`}
      aria-label={`${label} mock command`}
    >
      {icon ? (
        <span className="excel-command-icon" aria-hidden="true">
          <ExcelRibbonIcon name={icon} />
        </span>
      ) : null}
      {value && !iconOnly ? <span className="excel-command-label">{value}</span> : null}
      {variant === "select" ? <span className="excel-command-caret" aria-hidden="true" /> : null}
    </button>
  );
}

export function ExcelShell({ children, option, chatSidebar }: ThemeShellProps) {
  const { pathname, currentRoute } = useShellRoute();
  const icon = getThemeFamilyIcon(option.family);
  const contentFrameRef = useRef<HTMLDivElement>(null);
  const rowHeadersRef = useRef<HTMLDivElement>(null);
  const [columnMetrics, setColumnMetrics] = useState({
    count: EXCEL_DEFAULT_COLUMN_COUNT,
    width: EXCEL_TARGET_COLUMN_WIDTH
  });
  const [rowCount, setRowCount] = useState(EXCEL_MIN_ROW_COUNT);
  const [rowHeight, setRowHeight] = useState(EXCEL_ROW_HEIGHT);
  const [selectedCell, setSelectedCell] = useState({ columnIndex: 0, rowIndex: 0 });

  const columns = useMemo(
    () => Array.from({ length: columnMetrics.count }, (_, index) => getExcelColumnLabel(index)),
    [columnMetrics.count]
  );
  const rows = useMemo(() => Array.from({ length: rowCount }, (_, index) => index + 1), [rowCount]);
  const selectedColumnLabel = getExcelColumnLabel(selectedCell.columnIndex);
  const selectedCellLabel = `${selectedColumnLabel}${selectedCell.rowIndex + 1}`;
  const gridStyle = {
    "--excel-column-count": String(columnMetrics.count),
    "--excel-column-width": `${columnMetrics.width}px`,
    "--excel-selected-column": String(selectedCell.columnIndex),
    "--excel-selected-row": String(selectedCell.rowIndex),
    "--excel-selection-left": `${selectedCell.columnIndex * columnMetrics.width}px`,
    "--excel-selection-top": `${selectedCell.rowIndex * rowHeight}px`
  } as CSSProperties;

  const syncRowHeaders = useCallback(() => {
    const frame = contentFrameRef.current;
    const rowHeaders = rowHeadersRef.current;

    if (!frame || !rowHeaders) {
      return;
    }

    rowHeaders.style.transform = `translateY(-${frame.scrollTop}px)`;
  }, []);

  const selectCellFromPointer = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      const frame = contentFrameRef.current;

      if (!frame) {
        return;
      }

      const rect = frame.getBoundingClientRect();
      const rawColumnIndex = Math.floor((event.clientX - rect.left + frame.scrollLeft) / columnMetrics.width);
      const rawRowIndex = Math.floor((event.clientY - rect.top + frame.scrollTop) / rowHeight);
      const columnIndex = Math.max(0, Math.min(columnMetrics.count - 1, rawColumnIndex));
      const rowIndex = Math.max(0, Math.min(rowCount - 1, rawRowIndex));

      setSelectedCell((current) => {
        if (current.columnIndex === columnIndex && current.rowIndex === rowIndex) {
          return current;
        }

        return { columnIndex, rowIndex };
      });
    },
    [columnMetrics.count, columnMetrics.width, rowCount, rowHeight]
  );

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

    let firstFrame: number | null = null;
    let secondFrame: number | null = null;
    updateColumns();
    firstFrame = window.requestAnimationFrame(() => {
      updateColumns();
      secondFrame = window.requestAnimationFrame(updateColumns);
    });

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateColumns);

      return () => {
        if (firstFrame !== null) {
          window.cancelAnimationFrame(firstFrame);
        }
        if (secondFrame !== null) {
          window.cancelAnimationFrame(secondFrame);
        }
        window.removeEventListener("resize", updateColumns);
      };
    }

    const resizeObserver = new ResizeObserver(updateColumns);
    resizeObserver.observe(frame);
    window.addEventListener("resize", updateColumns);

    return () => {
      if (firstFrame !== null) {
        window.cancelAnimationFrame(firstFrame);
      }
      if (secondFrame !== null) {
        window.cancelAnimationFrame(secondFrame);
      }
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateColumns);
    };
  }, []);

  useEffect(() => {
    setSelectedCell((current) => {
      const columnIndex = Math.max(0, Math.min(columnMetrics.count - 1, current.columnIndex));
      const rowIndex = Math.max(0, Math.min(rowCount - 1, current.rowIndex));

      if (current.columnIndex === columnIndex && current.rowIndex === rowIndex) {
        return current;
      }

      return { columnIndex, rowIndex };
    });
  }, [columnMetrics.count, rowCount]);

  useEffect(() => {
    const frame = contentFrameRef.current;

    if (!frame) {
      return undefined;
    }

    const updateRows = () => {
      const measuredRowHeight =
        rowHeadersRef.current?.firstElementChild instanceof HTMLElement
          ? rowHeadersRef.current.firstElementChild.getBoundingClientRect().height
          : EXCEL_ROW_HEIGHT;
      const nextRowHeight = measuredRowHeight > 0 ? measuredRowHeight : EXCEL_ROW_HEIGHT;
      const nextRowCount = Math.max(EXCEL_MIN_ROW_COUNT, Math.ceil(frame.scrollHeight / nextRowHeight));
      setRowHeight((current) => (Math.abs(current - nextRowHeight) < 0.1 ? current : nextRowHeight));
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
        <div className="excel-workbook-identity">
          <button type="button" className="excel-app-launcher" aria-label="Microsoft 365 app launcher mock command">
            <span aria-hidden="true" />
            <span aria-hidden="true" />
            <span aria-hidden="true" />
            <span aria-hidden="true" />
            <span aria-hidden="true" />
            <span aria-hidden="true" />
            <span aria-hidden="true" />
            <span aria-hidden="true" />
            <span aria-hidden="true" />
          </button>
          <Link className="excel-home-link" href="/" aria-label="곡소리닷컴 홈">
            <img
              className="theme-shell-brand-icon excel-product-icon"
              src={icon.href}
              alt={`${icon.label} 컨셉 아이콘`}
              width={24}
              height={24}
              data-testid="theme-shell-brand-icon"
            />
          </Link>
          <div className="excel-workbook-title-stack">
            <Link className="excel-workbook-title" href={currentRoute.href} aria-label="현재 통합 문서 열기">
              {currentRoute.fileName}
            </Link>
            <span>Saved to Goksorry</span>
          </div>
        </div>

        <div className="excel-search" role="search" aria-label="Excel 검색">
          <span aria-hidden="true">Search</span>
          <input readOnly aria-label="Search workbook mock" value="Search in workbook" />
        </div>

        <div className="excel-top-actions">
          <div className="excel-collaborators" aria-label="현재 공동작업자">
            <span>J</span>
            <span>K</span>
          </div>
          <button type="button" className="excel-header-button" aria-label="Comments mock command">
            Comments
          </button>
          <button type="button" className="excel-editing-mode" aria-label="Editing mode mock command">
            Editing
          </button>
          <button type="button" className="excel-share-button" aria-label="Share workbook mock command">
            Share
          </button>
          <ShellHeaderActions />
        </div>
      </div>

      <div className="excel-ribbon" data-testid="excel-ribbon">
        <div className="excel-ribbon-tabs">
          {EXCEL_TABS.map((tab) => (
            <button key={tab} type="button" className={tab === "Home" ? "theme-shell-active" : ""}>
              {tab}
            </button>
          ))}
        </div>
        <div className="excel-single-line-ribbon" data-testid="excel-single-line-ribbon">
          <div className="excel-single-line-commands">
            {EXCEL_SINGLE_LINE_COMMANDS.map((command, index) =>
              command.type === "separator" ? (
                <span key={`separator-${index}`} className="excel-ribbon-separator" aria-hidden="true" />
              ) : (
                <ExcelRibbonCommand
                  key={command.label}
                  label={command.label}
                  value={"value" in command ? command.value : undefined}
                  icon={"icon" in command ? command.icon : undefined}
                  active={"active" in command ? command.active : false}
                  iconOnly={"iconOnly" in command ? command.iconOnly : false}
                  variant={command.type}
                  wide={"wide" in command ? command.wide : false}
                />
              )
            )}
          </div>
          <button type="button" className="excel-ribbon-display-button" aria-label="Ribbon display options mock command">
            <ExcelRibbonIcon name="ribbon" />
          </button>
        </div>
      </div>

      <div className="excel-formula-bar" data-testid="excel-formula-bar">
        <div className="excel-name-box">{selectedCellLabel}</div>
        <div className="excel-formula-control-group" aria-label="수식 입력 제어">
          <button type="button" className="excel-formula-action" aria-label="Cancel formula mock command">
            x
          </button>
          <button type="button" className="excel-formula-action" aria-label="Enter formula mock command">
            ✓
          </button>
          <button type="button" className="excel-fx" aria-label="Insert function mock command">
            fx
          </button>
        </div>
        <input readOnly aria-label="수식 입력줄" value={`=${currentRoute.formula} // ${normalizePath(pathname)}`} />
      </div>

      <section className="theme-shell-workspace excel-workspace">
        <div className="theme-shell-content-area" data-testid="program-content-area">
          <div className="excel-grid-shell" style={gridStyle}>
            <div className="excel-grid-corner" aria-hidden="true" />
            <div className="excel-column-headers" data-testid="excel-column-headers" aria-hidden="true">
              {columns.map((column, index) => (
                <span
                  key={column}
                  className={index === selectedCell.columnIndex ? "excel-header-active" : undefined}
                  data-excel-column={column}
                >
                  {column}
                </span>
              ))}
            </div>
            <div className="excel-row-header-viewport" data-testid="excel-row-headers" aria-hidden="true">
              <div ref={rowHeadersRef} className="excel-row-headers">
                {rows.map((row, index) => (
                  <span
                    key={row}
                    className={index === selectedCell.rowIndex ? "excel-header-active" : undefined}
                    data-excel-row={row}
                  >
                    {row}
                  </span>
                ))}
              </div>
            </div>
            <div
              ref={contentFrameRef}
              className="theme-shell-content-frame excel-content-frame"
              onClick={selectCellFromPointer}
              onScroll={syncRowHeaders}
            >
              <div className="excel-selection-box" data-testid="excel-selection-box" aria-hidden="true" />
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
