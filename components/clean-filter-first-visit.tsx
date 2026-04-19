"use client";

import type { MouseEvent } from "react";
import { buildCleanFilterCookie } from "@/lib/clean-filter";
import { useCleanFilter } from "@/components/clean-filter-provider";

export function CleanFilterFirstVisit() {
  const { isApplying, showFirstVisitPrompt, applyCleanFilter, dismissFirstVisitPrompt } = useCleanFilter();

  if (!showFirstVisitPrompt) {
    return null;
  }

  const handleEnable = () => {
    document.cookie = buildCleanFilterCookie(true);
    dismissFirstVisitPrompt();
  };

  const handleDisable = (event: MouseEvent<HTMLButtonElement>) => {
    if (isApplying) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    applyCleanFilter(false, {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    });
    document.cookie = buildCleanFilterCookie(false);
    dismissFirstVisitPrompt();
  };

  return (
    <div className="clean-filter-first-visit" role="presentation">
      <div className="clean-filter-first-visit-panel" role="dialog" aria-modal="true" aria-labelledby="clean-filter-first-visit-title">
        <p className="clean-filter-first-visit-kicker">처음 오셨군요</p>
        <h2 id="clean-filter-first-visit-title">이쁜말 필터를 켤까요?</h2>
        <p className="muted">외부 피드의 거친 표현을 조금 더 부드럽게 바꿔서 보여줍니다.</p>
        <p className="muted">
          주식하는 사람들은 항상 화나있기 때문에, 글들이 보기 거북하시면 켜보세요. 화면 상단에서 언제든 토글할 수 있습니다.
        </p>
        <div className="actions">
          <button type="button" className="btn" onClick={handleEnable}>
            켜기
          </button>
          <button type="button" className="btn btn-secondary" onClick={handleDisable}>
            끄기
          </button>
        </div>
      </div>
    </div>
  );
}
