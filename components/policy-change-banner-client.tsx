"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ActivePolicyChange } from "@/lib/policy-changes";

type PolicyChangeBannerClientProps = {
  change: ActivePolicyChange;
};

const formatEffectiveDate = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
};

export function PolicyChangeBannerClient({ change }: PolicyChangeBannerClientProps) {
  const storageKey = useMemo(() => `policy-change-banner:${change.id}`, [change.id]);
  const [isMounted, setIsMounted] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    setIsDismissed(window.sessionStorage.getItem(storageKey) === "dismissed");
    setIsMounted(true);
  }, [storageKey]);

  const handleDismiss = () => {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(storageKey, "dismissed");
    }

    setIsDismissed(true);
  };

  if (!isMounted || isDismissed) {
    return null;
  }

  return (
    <div className="policy-change-banner" role="status" aria-live="polite">
      <div className="policy-change-banner-inner">
        <p className="policy-change-banner-copy">
          {change.label}이 변경됩니다. {formatEffectiveDate(change.effectiveAt)}부터 적용됩니다.{" "}
          <Link href={change.href}>자세히 보기</Link>
        </p>
        <button
          type="button"
          className="policy-change-banner-close"
          aria-label="약관 변경 배너 닫기"
          onClick={handleDismiss}
        >
          닫기
        </button>
      </div>
    </div>
  );
}
