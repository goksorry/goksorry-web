"use client";

import { useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { buildCleanFilterCookie } from "@/lib/clean-filter";
import { useCleanFilter } from "@/components/clean-filter-provider";

export function CleanFilterToggle() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const pendingStartedAtRef = useRef<number | null>(null);
  const { cleanFilterEnabled, isApplying, beginApply, finishApply } = useCleanFilter();

  const onToggle = () => {
    if (isApplying || isPending) {
      return;
    }

    const nextValue = !cleanFilterEnabled;
    pendingStartedAtRef.current = Date.now();
    beginApply(nextValue);
    document.cookie = buildCleanFilterCookie(nextValue);
    startTransition(() => {
      router.refresh();
    });
  };

  useEffect(() => {
    if (isPending) {
      return;
    }

    if (pendingStartedAtRef.current === null) {
      return;
    }

    const elapsedMs = Date.now() - pendingStartedAtRef.current;
    const remainingMs = Math.max(0, 240 - elapsedMs);
    const timeout = window.setTimeout(() => {
      finishApply();
      pendingStartedAtRef.current = null;
    }, remainingMs);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [finishApply, isPending]);

  return (
    <button
      type="button"
      className={`clean-filter-toggle${cleanFilterEnabled ? " clean-filter-toggle-active" : ""}`}
      onClick={onToggle}
      aria-pressed={cleanFilterEnabled}
      aria-busy={isApplying || isPending}
      aria-label={cleanFilterEnabled ? "클린필터 끄기" : "클린필터 켜기"}
      title={cleanFilterEnabled ? "클린필터 켜짐" : "클린필터 꺼짐"}
      disabled={isApplying || isPending}
    >
      <span aria-hidden="true" className="clean-filter-toggle-emoji">
        🧼
      </span>
      <span className="clean-filter-toggle-label">예쁜말</span>
      <span className="clean-filter-toggle-state">{cleanFilterEnabled ? "ON" : "OFF"}</span>
    </button>
  );
}
