"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";

const buildNextPath = (pathname: string, searchParams: URLSearchParams): string => {
  const query = searchParams.toString();
  return query ? `${pathname}?${query}` : pathname;
};

export function ProfileSetupRedirect() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.nickname_needs_setup) {
      return;
    }

    if (pathname.startsWith("/profile")) {
      return;
    }

    const next = buildNextPath(pathname, searchParams);
    router.replace(`/profile?next=${encodeURIComponent(next)}`);
  }, [pathname, router, searchParams, session?.user?.nickname_needs_setup, status]);

  return null;
}
