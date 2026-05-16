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

const VS_MENUS = ["File", "Edit", "View", "Git", "Project", "Build", "Debug", "Test", "Analyze", "Tools"];
const VS_TOOLBAR = [
  ["Save All", "archive"],
  ["Start", "play"],
  ["Find", "find"],
  ["Options", "settings"]
] as const;

export function VisualStudioShell({ children, option }: ThemeShellProps) {
  const { pathname, currentRoute } = useShellRoute();

  return (
    <div className="theme-shell theme-shell-visual-studio" data-testid="program-shell" data-program-shell="visual-studio">
      <div className="visual-studio-titlebar" data-testid="program-header">
        <ShellBrand productName="Visual Studio" />
        <ShellNavLinks />
        <div className="visual-studio-search">
          <ShellIcon name="search" />
          <span>Search Visual Studio</span>
        </div>
        <ShellHeaderActions />
      </div>
      <div className="visual-studio-menu-bar">
        {VS_MENUS.map((menu) => (
          <button key={menu} type="button">
            {menu}
          </button>
        ))}
      </div>
      <div className="visual-studio-toolbar" data-testid="visual-studio-toolbar">
        {VS_TOOLBAR.map(([label, icon], index) => (
          <ShellCommandButton key={label} label={label} icon={icon} active={index === 1} />
        ))}
      </div>

      <section className="theme-shell-workspace visual-studio-ide">
        <main className="theme-shell-content-area visual-studio-editor" data-testid="program-content-area">
          <div className="visual-studio-document-tabs" data-testid="visual-studio-editor-tabs">
            {SHELL_ROUTES.slice(0, 4).map((route) => (
              <Link key={route.href} href={route.href} className={isRouteActive(pathname, route.href) ? "theme-shell-active" : ""}>
                {route.fileName}
              </Link>
            ))}
          </div>
          <div className="theme-shell-content-frame visual-studio-content-frame">{children}</div>
        </main>
        <aside className="visual-studio-solution" data-testid="visual-studio-sidebar">
          <div className="visual-studio-pane-title">Solution Explorer</div>
          <RouteLinks pathname={pathname} className="visual-studio-solution-tree" fileNames />
        </aside>
        <aside className="visual-studio-properties">
          <p>Properties</p>
          <span>Name</span>
          <strong>{currentRoute.fileName}</strong>
        </aside>
      </section>

      <ShellStatusBar option={option} shellType="visual-studio" currentRoute={currentRoute} />
    </div>
  );
}
