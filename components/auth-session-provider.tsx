"use client";

import type { ReactNode } from "react";
import type { Session } from "next-auth";
import { SessionProvider } from "next-auth/react";
import { SessionResumeRefresh } from "@/components/session-resume-refresh";

export function AuthSessionProvider({
  children,
  session
}: {
  children: ReactNode;
  session: Session | null;
}) {
  const sessionKey = session?.user
    ? `auth:${session.user.id ?? ""}:${session.user.email ?? ""}:${session.user.role ?? "user"}:${session.user.nickname ?? ""}:${session.user.profile_setup_required ? "setup" : "ready"}`
    : "guest";

  return (
    <SessionProvider key={sessionKey} session={session} refetchOnWindowFocus refetchInterval={300}>
      <SessionResumeRefresh />
      {children}
    </SessionProvider>
  );
}
