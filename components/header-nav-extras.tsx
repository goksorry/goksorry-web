"use client";

import Link from "next/link";
import type { Session } from "next-auth";
import { useSession } from "next-auth/react";

export function HeaderNavExtras({ initialSession }: { initialSession: Session | null }) {
  const { data: liveSession } = useSession();
  const session = liveSession ?? initialSession;

  if (session?.user?.role !== "admin" || session?.user?.profile_setup_required) {
    return null;
  }

  return (
    <>
      <Link href="/admin/reports">신고 관리</Link>
      <Link href="/admin/members">회원 관리</Link>
      <Link href="/admin/tokens">토큰 승인</Link>
      <Link href="/admin/policies">정책 문서</Link>
    </>
  );
}
