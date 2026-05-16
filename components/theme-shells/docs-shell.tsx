"use client";

import {
  RouteLinks,
  ShellBrand,
  ShellCommandButton,
  ShellHeaderActions,
  ShellIcon,
  ShellNavLinks,
  ShellStatusBar,
  useShellRoute,
  type ThemeShellProps
} from "@/components/theme-shells/common";

const DOCS_ACTIONS = [
  ["Search", "search"],
  ["Examples", "code"],
  ["Version", "document"],
  ["Export", "archive"]
] as const;

export function DocsShell({ children, option }: ThemeShellProps) {
  const { pathname, currentRoute } = useShellRoute();

  return (
    <div className="theme-shell theme-shell-docs" data-testid="program-shell" data-program-shell="docs">
      <div className="docs-app-header" data-testid="program-header">
        <ShellBrand productName="Docs" />
        <ShellNavLinks />
        <div className="docs-search" role="search">
          <ShellIcon name="search" />
          <span>Search docs, routes, policies</span>
        </div>
        <ShellHeaderActions />
      </div>

      <section className="theme-shell-workspace docs-workspace">
        <aside className="docs-outline" data-testid="docs-sidebar">
          <p>Contents</p>
          <RouteLinks pathname={pathname} className="docs-outline-links" fileNames />
        </aside>
        <main className="theme-shell-content-area docs-reader" data-testid="program-content-area">
          <div className="docs-reader-toolbar" data-testid="docs-toolbar">
            <div>
              <span>현재 문서</span>
              <strong>{currentRoute.fileName}</strong>
            </div>
            <div className="docs-actions">
              {DOCS_ACTIONS.map(([label, icon]) => (
                <ShellCommandButton key={label} label={label} icon={icon} />
              ))}
            </div>
          </div>
          <article className="theme-shell-content-frame docs-content-frame">{children}</article>
        </main>
        <aside className="docs-meta-pane">
          <p>On this page</p>
          <a href="#page-top">Top</a>
          <a href="/docs">API</a>
          <a href="/terms">Terms</a>
        </aside>
      </section>

      <ShellStatusBar option={option} shellType="docs" currentRoute={currentRoute} />
    </div>
  );
}
