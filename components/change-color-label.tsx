import type { ReactNode } from "react";
import type { ChangeColorMode } from "@/lib/change-color-mode";

/** Names of the 등락률 colour conventions (button labels for screen readers). */
export const CHANGE_COLOR_LABELS: Record<ChangeColorMode, string> = {
  kr: "한국식",
  us: "미국식",
  hybrid: "하이브리드"
};

/** The visible label of a 등락률 colour choice: its flag and up/down arrows drawn in that convention's colours. */
export const renderChangeColorLabel = (mode: ChangeColorMode): ReactNode => {
  if (mode === "hybrid") {
    return <span className="theme-menu-change-label theme-menu-change-label-hybrid">🔀</span>;
  }

  return (
    <span className={`theme-menu-change-label theme-menu-change-label-${mode}`}>
      <span className="theme-menu-change-flag">{mode === "kr" ? "🇰🇷" : "🇺🇸"}</span>
      <span className="theme-menu-change-arrow theme-menu-change-up">↑</span>
      <span className="theme-menu-change-arrow theme-menu-change-down">↓</span>
    </span>
  );
};
