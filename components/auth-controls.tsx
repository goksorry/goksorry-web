"use client";

import Image from "next/image";
import Link from "next/link";
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
      <button
        type="button"
        className="btn header-auth-button header-login-button"
        onClick={() => void handleSignIn()}
        disabled={loading}
        aria-label={loading ? "구글 로그인 중" : "구글 로그인"}
        title={loading ? "구글계정으로 로그인 중" : "구글계정으로 로그인"}
      >
        <Image src="/google-mark.svg" alt="" width={16} height={16} aria-hidden="true" />
        <span className="header-auth-emoji" aria-hidden="true">
          🔐
        </span>
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
        className="header-auth-signout"
        onClick={() => void handleSignOut()}
        disabled={loading}
        aria-label="로그아웃"
        title="로그아웃"
      >
        <span className="header-auth-emoji" aria-hidden="true">
          🚪
        </span>
      </button>
    </div>
  );
}
