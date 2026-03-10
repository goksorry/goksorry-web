"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

export function GoogleSignInButton({
  callbackUrl,
  label = "구글계정으로 로그인"
}: {
  callbackUrl: string;
  label?: string;
}) {
  const [pending, setPending] = useState(false);

  const handleSignIn = async () => {
    setPending(true);
    try {
      await signIn("google", { callbackUrl });
    } finally {
      setPending(false);
    }
  };

  return (
    <button type="button" onClick={() => void handleSignIn()} disabled={pending}>
      {pending ? "로그인 중..." : label}
    </button>
  );
}
