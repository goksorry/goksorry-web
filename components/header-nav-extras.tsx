"use client";

import Link from "next/link";
import type { Session } from "next-auth";
import { useSession } from "next-auth/react";

export function HeaderNavExtras({ initialSession }: { initialSession: Session | null }) {
  const { data: liveSession } = useSession();
  const session = liveSession ?? initialSession;

  if (session?.user?.role !== "admin") {
    return null;
  }

  return <Link href="/admin/reports">신고 관리</Link>;
}
