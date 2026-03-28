"use client";

import type { ReactNode } from "react";
import { SessionProvider } from "next-auth/react";
import { SessionResumeRefresh } from "@/components/session-resume-refresh";

export function AuthSessionProvider({ children }: { children: ReactNode }) {
  return (
    <SessionProvider refetchOnWindowFocus refetchInterval={300}>
      <SessionResumeRefresh />
      {children}
    </SessionProvider>
  );
}
