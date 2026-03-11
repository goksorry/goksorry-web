"use client";

import { useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

const MIN_RECOVERY_ATTEMPT_INTERVAL_MS = 15_000;

export function SessionResumeRefresh() {
  const router = useRouter();
  const { status, update } = useSession();
  const [, startTransition] = useTransition();
  const lastRecoveryAttemptAtRef = useRef(0);

  useEffect(() => {
    if (status === "authenticated") {
      lastRecoveryAttemptAtRef.current = 0;
      return;
    }

    const recoverSessionShell = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }

      const now = Date.now();
      if (now - lastRecoveryAttemptAtRef.current < MIN_RECOVERY_ATTEMPT_INTERVAL_MS) {
        return;
      }

      lastRecoveryAttemptAtRef.current = now;

      void update()
        .catch(() => null)
        .finally(() => {
          startTransition(() => {
            router.refresh();
          });
        });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        recoverSessionShell();
      }
    };

    const handlePageShow = () => {
      recoverSessionShell();
    };

    window.addEventListener("pageshow", handlePageShow);
    window.addEventListener("focus", recoverSessionShell);
    window.addEventListener("online", recoverSessionShell);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("pageshow", handlePageShow);
      window.removeEventListener("focus", recoverSessionShell);
      window.removeEventListener("online", recoverSessionShell);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [router, startTransition, status, update]);

  return null;
}
