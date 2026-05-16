"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useCleanFilter } from "@/components/clean-filter-provider";
import { useSessionSnapshot } from "@/components/use-session-snapshot";
import { getThemeOption, type ThemeOption, type ThemeShellType } from "@/lib/theme";
import { useTheme } from "@/components/theme-provider";

type ProgramRoute = {
  href: string;
  label: string;
  fileName: string;
  cell: string;
  formula: string;
};

const PROGRAM_ROUTES: ProgramRoute[] = [
  { href: "/", label: "피드", fileName: "feed.goksorry", cell: "A1", formula: "GOKSORRY.FEED()" },
  { href: "/community", label: "게시판", fileName: "board.goksorry", cell: "B2", formula: "GOKSORRY.BOARD()" },
  { href: "/goksorry-room", label: "곡소리방", fileName: "room.goksorry", cell: "C3", formula: "GOKSORRY.ROOM()" },
  { href: "/docs", label: "문서", fileName: "api.docs", cell: "D4", formula: "GOKSORRY.DOCS()" },
  { href: "/terms", label: "약관", fileName: "terms.md", cell: "E5", formula: "GOKSORRY.POLICY(\"terms\")" },
  { href: "/privacy", label: "개인정보", fileName: "privacy.md", cell: "F6", formula: "GOKSORRY.POLICY(\"privacy\")" }
];

const EXCEL_RIBBON_TABS = ["File", "Home", "Insert", "Page Layout", "Formulas", "Data", "Review", "View", "Help"] as const;
const EXCEL_GROUPS = [
  { label: "Clipboard", commands: ["Paste", "Cut", "Copy"] },
  { label: "Font", commands: ["Bold", "Fill", "Border"] },
  { label: "Alignment", commands: ["Wrap", "Merge", "Center"] },
  { label: "Number", commands: ["Format", "%", ","] },
  { label: "Styles", commands: ["Conditional", "Table"] },
  { label: "Cells", commands: ["Insert", "Delete"] },
  { label: "Editing", commands: ["Sort", "Find"] }
];

const PRESENTATION_GROUPS = [
  { label: "Slides", commands: ["New", "Layout", "Reset"] },
  { label: "Design", commands: ["Theme", "Variant", "Size"] },
  { label: "Animate", commands: ["Fade", "Morph", "Pane"] },
  { label: "Present", commands: ["From Start", "Notes"] }
];

const BLOG_COMMANDS = ["Draft", "Preview", "Publish", "Tags", "Stats"];
const DOCS_COMMANDS = ["Search", "Version", "Examples", "Export", "API"];
const IDE_ACTIVITIES = ["EX", "SC", "DB", "TR"];

const normalizePath = (pathname: string): string => {
  if (pathname !== "/" && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }

  return pathname;
};

const isRouteActive = (pathname: string, href: string): boolean => {
  const path = normalizePath(pathname);
  if (href === "/") {
    return path === "/";
  }

  return path === href || path.startsWith(`${href}/`);
};

const getCurrentRoute = (pathname: string): ProgramRoute => {
  return PROGRAM_ROUTES.find((route) => isRouteActive(pathname, route.href)) ?? PROGRAM_ROUTES[0];
};

function MockCommandButton({ children }: { children: ReactNode }) {
  return (
    <button type="button" className="program-command" aria-label={`${children} mock command`}>
      {children}
    </button>
  );
}

function ProgramHeader({ option, currentRoute }: { option: ThemeOption; currentRoute: ProgramRoute }) {
  return (
    <div className="program-header" data-testid="program-header">
      <div className="program-window-controls" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div className="program-title">
        <strong>{option.familyLabel}</strong>
        <span>{currentRoute.fileName}</span>
      </div>
      <div className="program-search" aria-label="프로그램 검색">
        Search
      </div>
    </div>
  );
}

function ExcelRibbon() {
  return (
    <div className="program-menu program-ribbon program-ribbon-excel" data-testid="excel-ribbon">
      <div className="program-ribbon-tabs">
        {EXCEL_RIBBON_TABS.map((tab) => (
          <button key={tab} type="button" className={tab === "Home" ? "program-ribbon-tab-active" : ""}>
            {tab}
          </button>
        ))}
      </div>
      <div className="program-ribbon-groups">
        {EXCEL_GROUPS.map((group) => (
          <section key={group.label} className="program-ribbon-group">
            <div className="program-ribbon-commands">
              {group.commands.map((command) => (
                <MockCommandButton key={command}>{command}</MockCommandButton>
              ))}
            </div>
            <p>{group.label}</p>
          </section>
        ))}
      </div>
    </div>
  );
}

function ExcelFormulaBar({ currentRoute, pathname }: { currentRoute: ProgramRoute; pathname: string }) {
  return (
    <div className="program-formula-bar" data-testid="excel-formula-bar">
      <div className="program-name-box">{currentRoute.cell}</div>
      <div className="program-formula-symbol">fx</div>
      <input readOnly aria-label="수식 입력줄" value={`=${currentRoute.formula} // ${normalizePath(pathname)}`} />
    </div>
  );
}

function GenericMenu({ shellType }: { shellType: ThemeShellType }) {
  const groups =
    shellType === "presentation"
      ? PRESENTATION_GROUPS
      : [{ label: shellType === "blog" ? "Publishing" : "Docs", commands: shellType === "blog" ? BLOG_COMMANDS : DOCS_COMMANDS }];

  return (
    <div className={`program-menu program-toolbar program-toolbar-${shellType}`} data-testid={`${shellType}-toolbar`}>
      {groups.map((group) => (
        <section key={group.label} className="program-toolbar-group">
          <p>{group.label}</p>
          <div>
            {group.commands.map((command) => (
              <MockCommandButton key={command}>{command}</MockCommandButton>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function ProgramSidebar({ shellType, pathname }: { shellType: ThemeShellType; pathname: string }) {
  if (shellType === "excel" || shellType === "blog") {
    return null;
  }

  const title = shellType === "presentation" ? "Slides" : shellType === "docs" ? "Outline" : "Explorer";

  return (
    <aside className={`program-sidebar program-sidebar-${shellType}`} data-testid={`${shellType}-sidebar`}>
      {shellType === "ide" ? (
        <div className="program-activity-bar" aria-label="IDE 활동 표시줄">
          {IDE_ACTIVITIES.map((item) => (
            <button key={item} type="button" aria-label={`${item} panel`}>
              {item}
            </button>
          ))}
        </div>
      ) : null}
      <div className="program-sidebar-panel">
        <p className="program-sidebar-title">{title}</p>
        <nav className="program-sidebar-nav" aria-label={`${title} navigation`}>
          {PROGRAM_ROUTES.map((route, index) => (
            <Link key={route.href} href={route.href} className={isRouteActive(pathname, route.href) ? "program-nav-active" : ""}>
              {shellType === "presentation" ? `${index + 1}. ${route.label}` : route.fileName}
            </Link>
          ))}
        </nav>
      </div>
    </aside>
  );
}

function IdeTabs({ pathname }: { pathname: string }) {
  return (
    <div className="program-editor-tabs" data-testid="ide-editor-tabs">
      {PROGRAM_ROUTES.slice(0, 4).map((route) => (
        <Link key={route.href} href={route.href} className={isRouteActive(pathname, route.href) ? "program-tab-active" : ""}>
          {route.fileName}
        </Link>
      ))}
    </div>
  );
}

function ExcelSheetTabs({ pathname }: { pathname: string }) {
  return (
    <div className="program-footer-tabs" data-testid="excel-sheet-tabs">
      {PROGRAM_ROUTES.map((route) => (
        <Link key={route.href} href={route.href} className={isRouteActive(pathname, route.href) ? "program-tab-active" : ""}>
          {route.label}
        </Link>
      ))}
      <button type="button" aria-label="새 시트 mock">
        +
      </button>
    </div>
  );
}

function ProgramStatusBar({
  currentRoute,
  option,
  shellType
}: {
  currentRoute: ProgramRoute;
  option: ThemeOption;
  shellType: ThemeShellType;
}) {
  const { cleanFilterEnabled } = useCleanFilter();
  const { authenticated, user } = useSessionSnapshot();
  const loginLabel = authenticated ? user?.nickname ?? user?.email ?? "member" : "guest";

  return (
    <div className="program-status-bar" data-testid="program-status-bar">
      <span>{shellType.toUpperCase()}</span>
      <span>{currentRoute.label}</span>
      <span>{option.label}</span>
      <span>예쁜말 {cleanFilterEnabled ? "ON" : "OFF"}</span>
      <span>{loginLabel}</span>
    </div>
  );
}

function ProgramContentFrame({
  children,
  shellType,
  pathname
}: {
  children: ReactNode;
  shellType: ThemeShellType;
  pathname: string;
}) {
  return (
    <section className="program-content-area" data-testid="program-content-area">
      {shellType === "ide" ? <IdeTabs pathname={pathname} /> : null}
      {shellType === "blog" ? (
        <aside className="program-blog-aside" data-testid="blog-sidebar">
          <p>Post Settings</p>
          <span>Status: Live</span>
          <span>Audience: Public</span>
          <span>Theme: Concept</span>
        </aside>
      ) : null}
      <div className="program-content-frame">{children}</div>
    </section>
  );
}

function ProgramShell({ children, option }: { children: ReactNode; option: ThemeOption }) {
  const pathname = usePathname();
  const currentRoute = getCurrentRoute(pathname);
  const shellType = option.shellType;

  return (
    <div className={`program-shell program-shell-${shellType}`} data-testid="program-shell" data-program-shell={shellType}>
      <ProgramHeader option={option} currentRoute={currentRoute} />
      {shellType === "excel" ? <ExcelRibbon /> : <GenericMenu shellType={shellType} />}
      {shellType === "excel" ? <ExcelFormulaBar currentRoute={currentRoute} pathname={pathname} /> : null}
      <div className="program-workspace">
        <ProgramSidebar shellType={shellType} pathname={pathname} />
        <ProgramContentFrame shellType={shellType} pathname={pathname}>
          {children}
        </ProgramContentFrame>
      </div>
      {shellType === "excel" ? <ExcelSheetTabs pathname={pathname} /> : null}
      <ProgramStatusBar currentRoute={currentRoute} option={option} shellType={shellType} />
    </div>
  );
}

export function ThemeChrome({ children }: { children: ReactNode }) {
  const { themeId } = useTheme();
  const option = getThemeOption(themeId);

  if (option.shellType === "default") {
    return <>{children}</>;
  }

  return <ProgramShell option={option}>{children}</ProgramShell>;
}
