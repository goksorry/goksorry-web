"use client";

import { useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

const MIN_REFRESH_INTERVAL_MS = 60_000;

export function SessionResumeRefresh() {
  const router = useRouter();
  const { status } = useSession();
  const [, startTransition] = useTransition();
  const lastRefreshAtRef = useRef(0);

  useEffect(() => {
    if (status === "authenticated") {
      lastRefreshAtRef.current = Date.now();
      return;
    }

    const refreshSessionShell = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }

      const now = Date.now();
      if (now - lastRefreshAtRef.current < MIN_REFRESH_INTERVAL_MS) {
        return;
      }

      lastRefreshAtRef.current = now;
      startTransition(() => {
        router.refresh();
      });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshSessionShell();
      }
    };

    const handlePageShow = () => {
      refreshSessionShell();
    };

    window.addEventListener("pageshow", handlePageShow);
    window.addEventListener("focus", refreshSessionShell);
    window.addEventListener("online", refreshSessionShell);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("pageshow", handlePageShow);
      window.removeEventListener("focus", refreshSessionShell);
      window.removeEventListener("online", refreshSessionShell);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [router, startTransition, status]);

  return null;
}
