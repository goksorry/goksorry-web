"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { PROFILE_SETUP_COMPLETED_FLAG } from "@/lib/profile-setup-client";

const buildNextPath = (pathname: string): string => {
  if (typeof window === "undefined") {
    return pathname;
  }

  const query = window.location.search.replace(/^\?/, "");
  return query ? `${pathname}?${query}` : pathname;
};

export function ProfileSetupRedirect() {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, status, update } = useSession();
  const recoveryAttemptedRef = useRef(false);

  useEffect(() => {
    if (status === "loading" || typeof window === "undefined") {
      return;
    }

    const pendingSetupCompletion = window.sessionStorage.getItem(PROFILE_SETUP_COMPLETED_FLAG) === "1";

    if (pendingSetupCompletion) {
      if (!session?.user?.profile_setup_required) {
        window.sessionStorage.removeItem(PROFILE_SETUP_COMPLETED_FLAG);
        recoveryAttemptedRef.current = false;
        return;
      }

      if (!recoveryAttemptedRef.current) {
        recoveryAttemptedRef.current = true;
        void update().finally(() => {
          router.refresh();
        });
      }
      return;
    }

    if (!session?.user?.email || !session.user.profile_setup_required) {
      recoveryAttemptedRef.current = false;
      return;
    }

    if (pathname.startsWith("/profile")) {
      return;
    }

    const next = buildNextPath(pathname);
    router.replace(`/profile?next=${encodeURIComponent(next)}`);
  }, [pathname, router, session?.user?.email, session?.user?.profile_setup_required, status, update]);

  return null;
}
