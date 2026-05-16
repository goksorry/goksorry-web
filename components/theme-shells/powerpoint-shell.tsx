"use client";

import Link from "next/link";
import {
  SHELL_ROUTES,
  ShellHeaderActions,
  ShellStatusBar,
  isRouteActive,
  useShellRoute,
  type ThemeShellProps
} from "@/components/theme-shells/common";
import { getThemeFamilyIcon } from "@/lib/theme";

const POWERPOINT_TABS = [
  "File",
  "Home",
  "Insert",
  "Draw",
  "Design",
  "Transitions",
  "Animations",
  "Slide Show",
  "Review",
  "View",
  "Help"
] as const;

type PowerPointRibbonIconName =
  | "align"
  | "arrange"
  | "bold"
  | "bullets"
  | "color"
  | "designer"
  | "italic"
  | "layout"
  | "new-slide"
  | "present"
  | "reset"
  | "ribbon"
  | "search"
  | "underline";

type PowerPointRibbonCommand =
  | {
      type: "button" | "select";
      label: string;
      value?: string;
      icon?: PowerPointRibbonIconName;
      active?: boolean;
      iconOnly?: boolean;
      wide?: boolean;
    }
  | { type: "separator" };

const POWERPOINT_SINGLE_LINE_COMMANDS: PowerPointRibbonCommand[] = [
  { type: "button", label: "New Slide", value: "New Slide", icon: "new-slide", active: true, wide: true },
  { type: "button", label: "Layout", value: "Layout", icon: "layout" },
  { type: "button", label: "Reset", value: "Reset", icon: "reset" },
  { type: "separator" },
  { type: "select", label: "Font", value: "Aptos", icon: "search", wide: true },
  { type: "select", label: "Font Size", value: "18", wide: false },
  { type: "button", label: "Bold", icon: "bold", iconOnly: true },
  { type: "button", label: "Italic", icon: "italic", iconOnly: true },
  { type: "button", label: "Underline", icon: "underline", iconOnly: true },
  { type: "button", label: "Text Color", icon: "color", iconOnly: true },
  { type: "separator" },
  { type: "button", label: "Bullets", icon: "bullets", iconOnly: true },
  { type: "button", label: "Align", icon: "align", iconOnly: true },
  { type: "button", label: "Arrange", value: "Arrange", icon: "arrange" },
  { type: "separator" },
  { type: "button", label: "Designer", value: "Designer", icon: "designer", wide: true },
  { type: "button", label: "Present", value: "Present", icon: "present" }
];

function PowerPointRibbonIcon({ name }: { name: PowerPointRibbonIconName }) {
  const commonProps = {
    className: "powerpoint-command-svg",
    viewBox: "0 0 20 20",
    "aria-hidden": true
  };

  if (name === "new-slide") {
    return (
      <svg {...commonProps}>
        <rect x="3" y="5" width="11" height="9" rx="1" />
        <path d="M15 8v5M12.5 10.5h5" />
      </svg>
    );
  }

  if (name === "layout") {
    return (
      <svg {...commonProps}>
        <rect x="3" y="4" width="14" height="12" rx="1" />
        <path d="M3 8h14M8 8v8" />
      </svg>
    );
  }

  if (name === "reset") {
    return (
      <svg {...commonProps}>
        <path d="M6 7.5a5 5 0 1 1-.7 5.8" />
        <path d="M6 4v4H2" />
      </svg>
    );
  }

  if (name === "bold" || name === "italic" || name === "underline") {
    return (
      <svg {...commonProps}>
        <text x="6" y="14" className={`powerpoint-command-text powerpoint-command-text-${name}`}>
          {name === "bold" ? "B" : name === "italic" ? "I" : "U"}
        </text>
        {name === "underline" ? <path d="M5 16h10" /> : null}
      </svg>
    );
  }

  if (name === "color") {
    return (
      <svg {...commonProps}>
        <path d="M10 4 5.5 15M10 4l4.5 11M7 11h6" />
        <path d="M5 17h10" />
      </svg>
    );
  }

  if (name === "bullets") {
    return (
      <svg {...commonProps}>
        <circle cx="5" cy="6" r="1" />
        <circle cx="5" cy="10" r="1" />
        <circle cx="5" cy="14" r="1" />
        <path d="M8 6h7M8 10h7M8 14h7" />
      </svg>
    );
  }

  if (name === "align") {
    return (
      <svg {...commonProps}>
        <path d="M4 5h12M4 8.5h9M4 12h12M4 15.5h7" />
      </svg>
    );
  }

  if (name === "arrange") {
    return (
      <svg {...commonProps}>
        <rect x="4" y="7" width="8" height="8" rx="1" />
        <rect x="8" y="4" width="8" height="8" rx="1" />
      </svg>
    );
  }

  if (name === "designer") {
    return (
      <svg {...commonProps}>
        <path d="M10 3 8.5 8.5 3 10l5.5 1.5L10 17l1.5-5.5L17 10l-5.5-1.5z" />
      </svg>
    );
  }

  if (name === "present") {
    return (
      <svg {...commonProps}>
        <rect x="3" y="4" width="14" height="9" rx="1" />
        <path d="m8 7 4 2-4 2zM10 13v3M7 17h6" />
      </svg>
    );
  }

  if (name === "ribbon") {
    return (
      <svg {...commonProps}>
        <path d="M4 5h12M4 9h12M4 13h8" />
        <path d="m14 12 2 2 2-2" />
      </svg>
    );
  }

  return (
    <svg {...commonProps}>
      <circle cx="8.5" cy="8.5" r="4.5" />
      <path d="m12 12 4 4" />
    </svg>
  );
}

function PowerPointRibbonCommand({ command }: { command: Exclude<PowerPointRibbonCommand, { type: "separator" }> }) {
  return (
    <button
      type="button"
      className={`powerpoint-ribbon-command powerpoint-ribbon-command-${command.type}${
        command.active ? " powerpoint-ribbon-command-active" : ""
      }${command.iconOnly ? " powerpoint-ribbon-command-icon-only" : ""}${command.wide ? " powerpoint-ribbon-command-wide" : ""}`}
      aria-label={`${command.label} mock command`}
    >
      {command.icon ? (
        <span className="powerpoint-command-icon" aria-hidden="true">
          <PowerPointRibbonIcon name={command.icon} />
        </span>
      ) : null}
      {command.value && !command.iconOnly ? <span className="powerpoint-command-label">{command.value}</span> : null}
      {command.type === "select" ? <span className="powerpoint-command-caret" aria-hidden="true" /> : null}
    </button>
  );
}

export function PowerPointShell({ children, option, chatSidebar }: ThemeShellProps) {
  const { pathname, currentRoute } = useShellRoute();
  const icon = getThemeFamilyIcon(option.family);

  return (
    <div className="theme-shell theme-shell-powerpoint" data-testid="program-shell" data-program-shell="powerpoint">
      <div className="powerpoint-titlebar" data-testid="program-header">
        <div className="powerpoint-file-identity">
          <button type="button" className="powerpoint-app-launcher" aria-label="Microsoft 365 app launcher mock command">
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
          <Link className="powerpoint-home-link" href="/" aria-label="곡소리닷컴 홈">
            <img
              className="theme-shell-brand-icon powerpoint-product-icon"
              src={icon.href}
              alt={`${icon.label} 컨셉 아이콘`}
              width={24}
              height={24}
              data-testid="theme-shell-brand-icon"
            />
          </Link>
          <div className="powerpoint-file-title-stack">
            <Link className="powerpoint-file-title" href={currentRoute.href} aria-label="현재 프레젠테이션 열기">
              {currentRoute.fileName}
            </Link>
            <span>Saved to Goksorry</span>
          </div>
        </div>

        <div className="powerpoint-search" role="search" aria-label="PowerPoint 검색">
          <span aria-hidden="true">Search</span>
          <input readOnly aria-label="Search presentation mock" value="Search in presentation" />
        </div>

        <div className="powerpoint-top-actions">
          <div className="powerpoint-collaborators" aria-label="현재 공동작업자">
            <span>J</span>
            <span>K</span>
          </div>
          <button type="button" className="powerpoint-header-button" aria-label="Comments mock command">
            Comments
          </button>
          <button type="button" className="powerpoint-present-button" aria-label="Present mock command">
            Present
          </button>
          <button type="button" className="powerpoint-editing-mode" aria-label="Editing mode mock command">
            Editing
          </button>
          <button type="button" className="powerpoint-share-button" aria-label="Share presentation mock command">
            Share
          </button>
          <ShellHeaderActions />
        </div>
      </div>

      <div className="powerpoint-ribbon" data-testid="powerpoint-ribbon">
        <div className="powerpoint-tabs">
          {POWERPOINT_TABS.map((tab) => (
            <button key={tab} type="button" className={tab === "Home" ? "theme-shell-active" : ""}>
              {tab}
            </button>
          ))}
        </div>
        <div className="powerpoint-single-line-ribbon" data-testid="powerpoint-single-line-ribbon">
          <div className="powerpoint-single-line-commands">
            {POWERPOINT_SINGLE_LINE_COMMANDS.map((command, index) =>
              command.type === "separator" ? (
                <span key={`separator-${index}`} className="powerpoint-ribbon-separator" aria-hidden="true" />
              ) : (
                <PowerPointRibbonCommand key={command.label} command={command} />
              )
            )}
          </div>
          <button type="button" className="powerpoint-ribbon-display-button" aria-label="Ribbon display options mock command">
            <PowerPointRibbonIcon name="ribbon" />
          </button>
        </div>
      </div>

      <section className="theme-shell-workspace powerpoint-workspace">
        <aside className="powerpoint-slide-rail" data-testid="powerpoint-slide-rail">
          {SHELL_ROUTES.map((route, index) => (
            <Link
              key={route.href}
              href={route.href}
              className={isRouteActive(pathname, route.href) ? "theme-shell-active" : ""}
              aria-label={`${index + 1} ${route.label} slide`}
            >
              <span className="powerpoint-slide-number">{index + 1}</span>
              <span className="powerpoint-slide-thumbnail" aria-hidden="true">
                <span className="powerpoint-slide-preview-title" />
                <span className="powerpoint-slide-preview-line" />
                <span className="powerpoint-slide-preview-line" />
              </span>
              <strong>{route.label}</strong>
            </Link>
          ))}
        </aside>
        <div className="theme-shell-content-area powerpoint-stage" data-testid="program-content-area">
          <div className="powerpoint-canvas">
            <div className="powerpoint-slide-shell" data-testid="powerpoint-slide-canvas">
              <div className="theme-shell-content-frame powerpoint-content-frame">{children}</div>
            </div>
          </div>
          <div className="powerpoint-notes" data-testid="powerpoint-notes">
            <span>Notes</span>
            <p>Click to add notes for {currentRoute.fileName}</p>
          </div>
        </div>
        {chatSidebar}
      </section>

      <ShellStatusBar option={option} shellType="powerpoint" currentRoute={currentRoute} />
    </div>
  );
}
