"use client";

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

export function ExcelShell({ children, option }: ThemeShellProps) {
  const { pathname, currentRoute } = useShellRoute();

  return (
    <div className="theme-shell theme-shell-excel" data-testid="program-shell" data-program-shell="excel">
      <div className="excel-titlebar" data-testid="program-header">
        <WindowDots />
        <ShellBrand productName="Excel" />
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
          <div className="excel-column-headers" aria-hidden="true">
            {["A", "B", "C", "D", "E", "F", "G", "H"].map((column) => (
              <span key={column}>{column}</span>
            ))}
          </div>
          <div className="theme-shell-content-frame excel-content-frame">{children}</div>
        </div>
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
