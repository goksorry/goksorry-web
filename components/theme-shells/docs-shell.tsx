"use client";

import Link from "next/link";
import {
  RouteLinks,
  ShellHeaderActions,
  ShellStatusBar,
  useShellRoute,
  type ThemeShellProps
} from "@/components/theme-shells/common";
import { getThemeFamilyIcon } from "@/lib/theme";

const DOCS_MENUS = ["File", "Edit", "View", "Insert", "Format", "Tools", "Extensions", "Help"] as const;

const DOCS_TOOLBAR_GROUPS = [
  [
    { label: "Undo", value: "undo", icon: "↶" },
    { label: "Redo", value: "redo", icon: "↷" },
    { label: "Print", value: "print", icon: "▣" }
  ],
  [
    { label: "Zoom", value: "100%" },
    { label: "Paragraph style", value: "Normal text" },
    { label: "Font", value: "Arial" },
    { label: "Font size", value: "11" }
  ],
  [
    { label: "Bold", value: "B", active: true },
    { label: "Italic", value: "I" },
    { label: "Underline", value: "U" },
    { label: "Text color", value: "A" },
    { label: "Highlight color", value: "▰" }
  ],
  [
    { label: "Align left", value: "≡", active: true },
    { label: "Line spacing", value: "↕" },
    { label: "Checklist", value: "☑" },
    { label: "Bulleted list", value: "•" },
    { label: "Numbered list", value: "1." }
  ],
  [
    { label: "Insert image", value: "□" },
    { label: "Insert link", value: "⌁" },
    { label: "Editing mode", value: "Editing" }
  ]
] as const;

const DOCS_HORIZONTAL_RULER_TICKS = ["1", "2", "3", "4", "5", "6", "7"];

function DocsToolbarButton({
  label,
  value,
  icon,
  active = false
}: {
  label: string;
  value: string;
  icon?: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      className={`docs-toolbar-button${active ? " docs-toolbar-button-active" : ""}${icon ? " docs-toolbar-icon-button" : ""}`}
      aria-label={`${label} mock command`}
    >
      <span aria-hidden="true">{icon ?? value}</span>
      {!icon && value.length > 2 ? <span className="docs-toolbar-caret" aria-hidden="true" /> : null}
    </button>
  );
}

export function DocsShell({ children, option, chatSidebar }: ThemeShellProps) {
  const { pathname, currentRoute } = useShellRoute();
  const icon = getThemeFamilyIcon(option.family);

  return (
    <div className="theme-shell theme-shell-docs" data-testid="program-shell" data-program-shell="docs">
      <div className="docs-app-header" data-testid="program-header">
        <div className="docs-titlebar" data-testid="docs-titlebar">
          <div className="docs-document-identity">
            <Link className="docs-home-link" href="/" aria-label="곡소리닷컴 홈">
              <img
                className="theme-shell-brand-icon docs-product-icon"
                src={icon.href}
                alt={`${icon.label} 컨셉 아이콘`}
                width={24}
                height={24}
                data-testid="theme-shell-brand-icon"
              />
            </Link>
            <div className="docs-title-stack">
              <div className="docs-file-row">
                <Link className="docs-file-title" href={currentRoute.href} aria-label="현재 문서 열기">
                  {currentRoute.fileName}
                </Link>
                <button type="button" className="docs-file-action" aria-label="Star document mock command">
                  ☆
                </button>
                <button type="button" className="docs-file-action" aria-label="Move document mock command">
                  ▱
                </button>
                <button type="button" className="docs-save-state" aria-label="Saved to Drive mock status">
                  Saved
                </button>
              </div>
              <nav className="docs-menu-bar" data-testid="docs-menu-bar" aria-label="Google Docs 메뉴">
                {DOCS_MENUS.map((menu) => (
                  <button key={menu} type="button" className="docs-menu-button">
                    {menu}
                  </button>
                ))}
              </nav>
            </div>
          </div>

          <div className="docs-top-actions">
            <div className="docs-collaborators" aria-label="현재 공동작업자">
              <span>J</span>
              <span>K</span>
              <span>S</span>
            </div>
            <button type="button" className="docs-round-action" aria-label="Open comments mock command">
              <span aria-hidden="true">□</span>
            </button>
            <button type="button" className="docs-meet-action" aria-label="Start Meet mock command">
              Meet
            </button>
            <button type="button" className="docs-share-action" aria-label="Share document mock command">
              Share
            </button>
            <ShellHeaderActions />
          </div>
        </div>

        <div className="docs-toolbar" data-testid="docs-toolbar" role="toolbar" aria-label="Google Docs 기능 바">
          <button type="button" className="docs-tool-finder" aria-label="Search the menus mock command">
            <span aria-hidden="true">⌕</span>
            <span>Search the menus</span>
          </button>
          {DOCS_TOOLBAR_GROUPS.map((group, index) => (
            <div key={index} className="docs-toolbar-group" role="group">
              {group.map((item) => (
                <DocsToolbarButton key={item.label} {...item} />
              ))}
            </div>
          ))}
        </div>
      </div>

      <section className="theme-shell-workspace docs-workspace">
        <aside className="docs-outline" data-testid="docs-sidebar">
          <div className="docs-outline-heading">
            <span aria-hidden="true">☰</span>
            <p>Document outline</p>
          </div>
          <RouteLinks pathname={pathname} className="docs-outline-links" fileNames />
        </aside>
        <main className="theme-shell-content-area docs-reader" data-testid="program-content-area">
          <div className="docs-ruler-row" data-testid="docs-ruler">
            <div className="docs-ruler-corner" />
            <div className="docs-horizontal-ruler" aria-hidden="true">
              {DOCS_HORIZONTAL_RULER_TICKS.map((tick) => (
                <span key={tick}>{tick}</span>
              ))}
            </div>
          </div>
          <article className="theme-shell-content-frame docs-content-frame">
            <div className="docs-document-stage">
              {children}
            </div>
          </article>
        </main>
        {chatSidebar}
      </section>

      <ShellStatusBar option={option} shellType="docs" currentRoute={currentRoute} />
    </div>
  );
}
