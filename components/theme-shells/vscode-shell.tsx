"use client";

import Link from "next/link";
import {
  RouteLinks,
  SHELL_ROUTES,
  ShellBrand,
  ShellCommandButton,
  ShellHeaderActions,
  ShellIcon,
  ShellLineNumbers,
  ShellNavLinks,
  ShellStatusBar,
  isRouteActive,
  useShellRoute,
  type ThemeShellProps
} from "@/components/theme-shells/common";

const ACTIVITY_ITEMS = [
  ["Explorer", "file"],
  ["Search", "search"],
  ["Source Control", "database"],
  ["Run", "debug"],
  ["Extensions", "grid"]
] as const;

export function VsCodeShell({ children, option, chatSidebar }: ThemeShellProps) {
  const { pathname, currentRoute } = useShellRoute();

  return (
    <div className="theme-shell theme-shell-vscode" data-testid="program-shell" data-program-shell="vscode">
      <div className="vscode-titlebar" data-testid="program-header">
        <ShellBrand family={option.family} productName="VS Code" />
        <ShellNavLinks />
        <div className="vscode-command-center">
          <ShellIcon name="search" />
          <span>goksorry-web / {currentRoute.fileName}</span>
        </div>
        <ShellHeaderActions />
      </div>

      <section className="theme-shell-workspace vscode-workbench">
        <aside className="vscode-activity-bar" aria-label="VS Code activity bar">
          {ACTIVITY_ITEMS.map(([label, icon], index) => (
            <button key={label} type="button" className={index === 0 ? "theme-shell-active" : ""} aria-label={`${label} panel`}>
              <ShellIcon name={icon} />
            </button>
          ))}
        </aside>
        <aside className="vscode-explorer" data-testid="vscode-sidebar">
          <p>EXPLORER</p>
          <RouteLinks pathname={pathname} className="vscode-file-tree" fileNames />
        </aside>
        <main className="theme-shell-content-area vscode-editor" data-testid="program-content-area">
          <div className="vscode-tabs" data-testid="vscode-editor-tabs">
            {SHELL_ROUTES.slice(0, 5).map((route) => (
              <Link key={route.href} href={route.href} className={isRouteActive(pathname, route.href) ? "theme-shell-active" : ""}>
                {route.fileName}
              </Link>
            ))}
          </div>
          <div className="theme-shell-content-frame vscode-content-frame">
            <ShellLineNumbers
              className="vscode-gutter ide-line-numbers"
              targetSelector=".vscode-content-frame .theme-shell-content-document"
            />
            {children}
          </div>
          <div className="vscode-panel">
            <ShellCommandButton label="Problems" icon="find" active />
            <ShellCommandButton label="Output" icon="document" />
            <ShellCommandButton label="Terminal" icon="code" />
          </div>
        </main>
        {chatSidebar}
      </section>

      <ShellStatusBar option={option} shellType="vscode" currentRoute={currentRoute} />
    </div>
  );
}
