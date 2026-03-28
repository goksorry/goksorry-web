"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";

export function HeaderNavExtras() {
  const { data: session } = useSession();

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
