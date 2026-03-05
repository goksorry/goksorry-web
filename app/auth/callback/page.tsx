"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getBrowserSupabaseClient } from "@/lib/supabase/browser";

const normalizeNext = (value: string | null): string => {
  if (!value) {
    return "/";
  }
  return value.startsWith("/") ? value : "/";
};

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState("Completing OAuth sign-in...");

  const code = useMemo(() => searchParams.get("code"), [searchParams]);
  const nextPath = useMemo(() => normalizeNext(searchParams.get("next")), [searchParams]);

  useEffect(() => {
    let active = true;

    const run = async () => {
      const supabase = getBrowserSupabaseClient();

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setStatus(`OAuth error: ${error.message}`);
          return;
        }
      }

      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (token) {
        await fetch("/api/auth/sync-profile", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`
          }
        }).catch(() => undefined);
      }

      if (!active) {
        return;
      }
      router.replace(nextPath);
      router.refresh();
    };

    run().catch((error) => {
      setStatus(`Callback failed: ${String(error)}`);
    });

    return () => {
      active = false;
    };
  }, [code, nextPath, router]);

  return (
    <section className="panel">
      <h1>OAuth Callback</h1>
      <p className="muted">{status}</p>
    </section>
  );
}
