"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatKstDateTime } from "@/lib/date-time";
import type { ActivePolicyChange } from "@/lib/policy-changes";

type PolicyChangeBannerClientProps = {
  change: ActivePolicyChange;
};

export function PolicyChangeBannerClient({ change }: PolicyChangeBannerClientProps) {
  const storageKey = useMemo(() => `policy-change-banner:${change.id}`, [change.id]);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try { setIsDismissed(window.sessionStorage.getItem(storageKey) === "dismissed"); } catch { /* Storage may be disabled. */ }
  }, [storageKey]);

  const handleDismiss = () => {
    if (typeof window !== "undefined") {
      try { window.sessionStorage.setItem(storageKey, "dismissed"); } catch { /* Dismiss for this render. */ }
    }

    setIsDismissed(true);
  };

  if (isDismissed) {
    return null;
  }

  return (
    <div className="policy-change-banner" role="status" aria-live="polite">
      <div className="policy-change-banner-inner">
        <p className="policy-change-banner-copy">
          {change.label} 개정 안내. {change.summary}. {formatKstDateTime(change.effectiveAt)} (한국 시간)부터 적용됩니다.{" "}
          <Link href={change.href}>자세히 보기</Link>
        </p>
        <button
          type="button"
          className="policy-change-banner-close"
          aria-label={`${change.label} 변경 배너 닫기`}
          onClick={handleDismiss}
        >
          닫기
        </button>
      </div>
    </div>
  );
}
