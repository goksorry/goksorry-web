"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";

export function HeaderChatLink() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return null;
  }

  if (session?.user?.profile_setup_required) {
    return null;
  }

  return (
    <Link href="/chat" replace>
      채팅
    </Link>
  );
}
