"use client";

import Link from "next/link";
import {
  RouteLinks,
  SHELL_ROUTES,
  ShellBrand,
  ShellCommandButton,
  ShellHeaderActions,
  ShellIcon,
  ShellNavLinks,
  ShellStatusBar,
  isRouteActive,
  useShellRoute,
  type ThemeShellProps
} from "@/components/theme-shells/common";

const TOOL_WINDOWS = [
  ["Project", "file"],
  ["Commit", "database"],
  ["Run", "play"],
  ["Services", "grid"]
] as const;

export function JetBrainsShell({ children, option, chatSidebar }: ThemeShellProps) {
  const { pathname, currentRoute } = useShellRoute();

  return (
    <div className="theme-shell theme-shell-jetbrains" data-testid="program-shell" data-program-shell="jetbrains">
      <div className="jetbrains-toolbar" data-testid="program-header">
        <ShellBrand productName="JetBrains" />
        <ShellNavLinks />
        <div className="jetbrains-run-widget">
          <ShellCommandButton label="Run" icon="play" active />
          <ShellCommandButton label="Debug" icon="debug" />
        </div>
        <ShellHeaderActions />
      </div>

      <section className="theme-shell-workspace jetbrains-window">
        <aside className="jetbrains-tool-window-bar" aria-label="JetBrains tool windows">
          {TOOL_WINDOWS.map(([label, icon], index) => (
            <button key={label} type="button" className={index === 0 ? "theme-shell-active" : ""} aria-label={`${label} tool window`}>
              <ShellIcon name={icon} />
              <span>{label}</span>
            </button>
          ))}
        </aside>
        <aside className="jetbrains-project-pane" data-testid="jetbrains-sidebar">
          <div className="jetbrains-pane-title">Project</div>
          <RouteLinks pathname={pathname} className="jetbrains-project-tree" fileNames />
        </aside>
        <main className="theme-shell-content-area jetbrains-editor" data-testid="program-content-area">
          <div className="jetbrains-breadcrumbs">goksorry-web / app / {currentRoute.fileName}</div>
          <div className="jetbrains-tabs" data-testid="jetbrains-editor-tabs">
            {SHELL_ROUTES.slice(0, 4).map((route) => (
              <Link key={route.href} href={route.href} className={isRouteActive(pathname, route.href) ? "theme-shell-active" : ""}>
                {route.fileName}
              </Link>
            ))}
          </div>
          <div className="jetbrains-editor-body">
            <div className="jetbrains-gutter" aria-hidden="true">
              {Array.from({ length: 18 }, (_, index) => (
                <span key={index}>{index + 1}</span>
              ))}
            </div>
            <div className="theme-shell-content-frame jetbrains-content-frame">{children}</div>
          </div>
        </main>
        {chatSidebar}
      </section>

      <ShellStatusBar option={option} shellType="jetbrains" currentRoute={currentRoute} />
    </div>
  );
}
