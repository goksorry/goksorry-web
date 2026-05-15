"use client";

import { THEME_OPTIONS, type ThemeId } from "@/lib/theme";
import { ThemeOptionButton } from "@/components/theme-toggle";
import { useTheme } from "@/components/theme-provider";

const FEATURED_THEME_IDS: ThemeId[] = [
  "light",
  "dark",
  "excel-light",
  "powerpoint-dark",
  "blog-light",
  "docs-dark",
  "vscode-dark",
  "jetbrains-dark",
  "vs-dark"
];

export function ThemeFirstVisit() {
  const { themeId, showThemePrompt, selectTheme, dismissThemePrompt } = useTheme();

  if (!showThemePrompt) {
    return null;
  }

  const featuredThemes = FEATURED_THEME_IDS.map((id) => THEME_OPTIONS.find((option) => option.id === id)).filter(
    Boolean
  );

  return (
    <div className="theme-first-visit" role="presentation">
      <div className="theme-first-visit-panel" role="dialog" aria-modal="true" aria-labelledby="theme-first-visit-title">
        <p className="theme-first-visit-kicker">테마 선택</p>
        <h2 id="theme-first-visit-title">사이트 분위기를 고르세요.</h2>
        <p className="muted">나중에도 우측 상단의 ... 메뉴에서 바꿀 수 있습니다.</p>
        <div className="theme-first-visit-options">
          {featuredThemes.map((option) =>
            option ? (
              <ThemeOptionButton key={option.id} option={option} active={option.id === themeId} onSelect={selectTheme} />
            ) : null
          )}
        </div>
        <div className="actions">
          <button type="button" className="btn btn-secondary" onClick={dismissThemePrompt}>
            기본 유지
          </button>
        </div>
      </div>
    </div>
  );
}
