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
  return (
    <SessionProvider session={session} refetchOnWindowFocus refetchInterval={300}>
      <SessionResumeRefresh />
      {children}
    </SessionProvider>
  );
}
