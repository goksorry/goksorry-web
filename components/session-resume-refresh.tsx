"use client";

import { useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { getSession, useSession } from "next-auth/react";

const MIN_RECOVERY_ATTEMPT_INTERVAL_MS = 15_000;

export function SessionResumeRefresh() {
  const router = useRouter();
  const { status } = useSession();
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

      // Ask the server whether a session appeared (e.g. login in another tab).
      // Only then re-render the server shell: refreshing for visitors who are
      // still anonymous re-runs every server query and drops the prefetch
      // cache (and on "/" the live world state) for nothing.
      void getSession({ broadcast: false })
        .catch(() => null)
        .then((recovered) => {
          if (!recovered?.user) return;
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

    window.addEventListener("pageshow", recoverSessionShell);
    window.addEventListener("focus", recoverSessionShell);
    window.addEventListener("online", recoverSessionShell);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("pageshow", recoverSessionShell);
      window.removeEventListener("focus", recoverSessionShell);
      window.removeEventListener("online", recoverSessionShell);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [router, startTransition, status]);

  return null;
}
