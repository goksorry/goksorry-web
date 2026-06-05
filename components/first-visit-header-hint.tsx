"use client";

import { persistCleanFilterPreference } from "@/lib/clean-filter";
import { useCleanFilter } from "@/components/clean-filter-provider";
import { useTheme } from "@/components/theme-provider";

export function FirstVisitHeaderHint() {
  const { cleanFilterEnabled, showFirstVisitPrompt, dismissFirstVisitPrompt } = useCleanFilter();
  const { showThemePrompt, dismissThemePrompt } = useTheme();
  const visible = showFirstVisitPrompt || showThemePrompt;

  if (!visible) {
    return null;
  }

  const dismiss = () => {
    persistCleanFilterPreference(cleanFilterEnabled);
    dismissFirstVisitPrompt();
    dismissThemePrompt();
  };

  return (
    <aside className="first-visit-header-hint" role="note" aria-label="초기 설정 안내">
      <span className="first-visit-header-hint-pointer" aria-hidden="true" />
      <p>이쁜말필터와 테마는 여기서 바꿀 수 있어요.</p>
      <button type="button" className="first-visit-header-hint-close" onClick={dismiss} aria-label="초기 설정 안내 닫기">
        확인
      </button>
    </aside>
  );
}
