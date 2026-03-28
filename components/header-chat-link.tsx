"use client";

import Link from "next/link";
import { useSessionSnapshot } from "@/components/use-session-snapshot";

export function HeaderChatLink() {
  const { user } = useSessionSnapshot();

  if (user?.profile_setup_required) {
    return null;
  }

  return (
    <Link href="/chat" replace>
      채팅
    </Link>
  );
}
