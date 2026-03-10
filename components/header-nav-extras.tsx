"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";

export function HeaderNavExtras() {
  const { data: session, status } = useSession();

  if (status !== "authenticated" || !session?.user?.email) {
    return null;
  }

  return (
    <>
      <Link href="/profile">내 프로필</Link>
      {session.user.role === "admin" ? <Link href="/admin/reports">신고 관리</Link> : null}
    </>
  );
}
