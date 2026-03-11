"use client";

import Link from "next/link";
import { useState } from "react";
import type { Session } from "next-auth";
import { signIn, signOut, useSession } from "next-auth/react";

const buildNextPath = (): string => {
  if (typeof window === "undefined") {
    return "/";
  }
  return `${window.location.pathname}${window.location.search}`;
};

export function AuthControls({ initialSession }: { initialSession: Session | null }) {
  const { data: liveSession, status } = useSession();
  const [pending, setPending] = useState(false);
  const session = liveSession ?? initialSession;
  const user = session?.user ?? null;

  const authenticated = Boolean(user?.email);
  const loading = pending || (status === "loading" && !authenticated);

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
      <button type="button" className="btn header-auth-button" onClick={() => void handleSignIn()} disabled={loading}>
        {loading ? "로그인 중..." : "구글계정으로 로그인"}
      </button>
    );
  }

  const profileLabel = user?.nickname?.trim() || user?.email || "로그인됨";

  return (
    <div className="header-auth-shell">
      <Link className="header-profile-link" href="/profile" aria-label="내 프로필">
        <span className="header-profile-name">{profileLabel}</span>
        {user?.nickname?.trim() && user.email ? <span className="header-profile-email">{user.email}</span> : null}
      </Link>
      <button
        type="button"
        className="btn-secondary header-auth-button"
        onClick={() => void handleSignOut()}
        disabled={loading}
      >
        로그아웃
      </button>
    </div>
  );
}
