"use client";

import {
  SHELL_ROUTES,
  ShellBrand,
  ShellCommandButton,
  ShellHeaderActions,
  ShellNavLinks,
  ShellStatusBar,
  WindowDots,
  useShellRoute,
  type ThemeShellProps
} from "@/components/theme-shells/common";

const POWERPOINT_TABS = ["File", "Home", "Insert", "Draw", "Design", "Transitions", "Animations", "Slide Show", "Review", "View"] as const;
const POWERPOINT_GROUPS = [
  { label: "Slides", commands: [["New Slide", "document"], ["Layout", "layout"], ["Reset", "settings"]] },
  { label: "Insert", commands: [["Picture", "file"], ["Chart", "chart"], ["Table", "table"]] },
  { label: "Design", commands: [["Designer", "spark"], ["Variants", "grid"], ["Size", "layout"]] },
  { label: "Present", commands: [["From Start", "play"], ["Notes", "document"], ["Record", "archive"]] }
] as const;

export function PowerPointShell({ children, option, chatSidebar }: ThemeShellProps) {
  const { currentRoute } = useShellRoute();

  return (
    <div className="theme-shell theme-shell-powerpoint" data-testid="program-shell" data-program-shell="powerpoint">
      <div className="powerpoint-titlebar" data-testid="program-header">
        <WindowDots />
        <ShellBrand productName="PowerPoint" />
        <ShellNavLinks />
        <div className="powerpoint-title">{currentRoute.label} Deck</div>
        <ShellHeaderActions />
      </div>

      <div className="powerpoint-ribbon" data-testid="powerpoint-ribbon">
        <div className="powerpoint-tabs">
          {POWERPOINT_TABS.map((tab) => (
            <button key={tab} type="button" className={tab === "Home" ? "theme-shell-active" : ""}>
              {tab}
            </button>
          ))}
        </div>
        <div className="powerpoint-command-strip">
          {POWERPOINT_GROUPS.map((group) => (
            <section key={group.label} className="powerpoint-command-group">
              <p>{group.label}</p>
              <div>
                {group.commands.map(([label, icon]) => (
                  <ShellCommandButton key={label} label={label} icon={icon} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>

      <section className="theme-shell-workspace powerpoint-workspace">
        <aside className="powerpoint-slide-rail" data-testid="powerpoint-slide-rail">
          {SHELL_ROUTES.map((route, index) => (
            <a key={route.href} href={route.href} className={route.href === currentRoute.href ? "theme-shell-active" : ""}>
              <span>{index + 1}</span>
              <strong>{route.label}</strong>
            </a>
          ))}
        </aside>
        <div className="theme-shell-content-area powerpoint-stage" data-testid="program-content-area">
          <div className="powerpoint-canvas">
            <div className="theme-shell-content-frame powerpoint-content-frame">{children}</div>
          </div>
          <div className="powerpoint-notes">Notes: {currentRoute.fileName}</div>
        </div>
        {chatSidebar}
      </section>

      <ShellStatusBar option={option} shellType="powerpoint" currentRoute={currentRoute} />
    </div>
  );
}
