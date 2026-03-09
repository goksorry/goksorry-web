"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getBrowserSupabaseClient } from "@/lib/supabase/browser";

const normalizeNext = (value: string | null): string => {
  if (!value) {
    return "/";
  }
  return value.startsWith("/") ? value : "/";
};

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState("구글 로그인 처리를 마무리하는 중입니다...");

  const code = useMemo(() => searchParams.get("code"), [searchParams]);
  const nextPath = useMemo(() => normalizeNext(searchParams.get("next")), [searchParams]);

  useEffect(() => {
    let active = true;

    const run = async () => {
      const supabase = getBrowserSupabaseClient();

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setStatus(`OAuth 오류: ${error.message}`);
          return;
        }
      }

      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        setStatus("OAuth는 끝났지만 세션 토큰을 받지 못했습니다.");
        return;
      }

      const cookieResponse = await fetch("/api/auth/session", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!cookieResponse.ok) {
        const payload = await cookieResponse.json().catch(() => ({}));
        setStatus(`세션 마무리에 실패했습니다: ${String((payload as any)?.error ?? cookieResponse.status)}`);
        return;
      }

      await fetch("/api/auth/sync-profile", {
        method: "POST"
      }).catch(() => undefined);

      await supabase.auth.signOut().catch(() => undefined);

      if (!active) {
        return;
      }
      router.replace(nextPath);
      router.refresh();
    };

    run().catch((error) => {
      setStatus(`콜백 처리 실패: ${String(error)}`);
    });

    return () => {
      active = false;
    };
  }, [code, nextPath, router]);

  return (
    <section className="panel">
      <h1>구글 로그인 콜백</h1>
      <p className="muted">{status}</p>
    </section>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <section className="panel">
          <h1>구글 로그인 콜백</h1>
          <p className="muted">구글 로그인 처리를 마무리하는 중입니다...</p>
        </section>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  );
}
