"use client";

import { useCleanFilter } from "@/components/clean-filter-provider";

export function CleanFilterOverlay() {
  const { cleanFilterEnabled, isApplying, animationMode } = useCleanFilter();

  if (!isApplying && !animationMode) {
    return null;
  }

  return (
    <div
      className={`clean-filter-overlay${isApplying ? " clean-filter-overlay-loading" : ""}${
        animationMode ? ` clean-filter-overlay-${animationMode}` : ""
      }`}
      aria-hidden={!isApplying}
    >
      {animationMode ? <div className="clean-filter-overlay-flash" /> : null}

      {isApplying ? (
        <div className="clean-filter-overlay-loader" role="status" aria-live="polite">
          <span className="clean-filter-overlay-spinner" aria-hidden="true" />
          <span className="clean-filter-overlay-text">
            {cleanFilterEnabled ? "예쁜말 적용 중..." : "날 것으로 돌리는중"}
          </span>
        </div>
      ) : null}
    </div>
  );
}
