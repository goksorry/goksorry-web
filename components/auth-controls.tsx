"use client";

import { useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";

const buildNextPath = (): string => {
  if (typeof window === "undefined") {
    return "/";
  }
  return `${window.location.pathname}${window.location.search}`;
};

export function AuthControls() {
  const { data: session, status } = useSession();
  const [pending, setPending] = useState(false);

  const loading = status === "loading" || pending;
  const authenticated = status === "authenticated" && Boolean(session?.user?.email);

  const handleSignIn = async () => {
    setPending(true);
    try {
      await signIn("google", {
        callbackUrl: buildNextPath()
      });
    } finally {
      setPending(false);
    }
  };

  const handleSignOut = async () => {
    setPending(true);
    try {
      await signOut({
        callbackUrl: buildNextPath()
      });
    } finally {
      setPending(false);
    }
  };

  if (!authenticated) {
    return (
      <button type="button" onClick={() => void handleSignIn()} disabled={loading}>
        {loading ? "로그인 중..." : "구글계정으로 로그인"}
      </button>
    );
  }

  return (
    <div className="inline">
      <span className="muted">
        {session.user.email ?? "로그인됨"}
        {session.user.nickname ? ` (${session.user.nickname})` : ""}
      </span>
      <button type="button" className="btn-secondary" onClick={() => void handleSignOut()} disabled={loading}>
        로그아웃
      </button>
    </div>
  );
}
