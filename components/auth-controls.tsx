"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getBrowserSupabaseClient } from "@/lib/supabase/browser";

type AuthSnapshot = {
  authenticated: boolean;
  email: string | null;
};

const buildNextPath = (): string => {
  if (typeof window === "undefined") {
    return "/";
  }
  return `${window.location.pathname}${window.location.search}`;
};

export function AuthControls() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchKey = useMemo(() => searchParams.toString(), [searchParams]);

  const [snapshot, setSnapshot] = useState<AuthSnapshot>({ authenticated: false, email: null });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const response = await fetch("/api/auth/me", {
          method: "GET",
          cache: "no-store"
        });
        const payload = (await response.json().catch(() => ({}))) as {
          authenticated?: boolean;
          user?: { email?: string | null };
        };

        if (!active) {
          return;
        }

        if (!response.ok || !payload.authenticated) {
          setSnapshot({ authenticated: false, email: null });
          return;
        }

        setSnapshot({ authenticated: true, email: payload.user?.email ?? null });
      } catch {
        if (!active) {
          return;
        }
        setSnapshot({ authenticated: false, email: null });
      }
    };

    load().catch(() => undefined);
    return () => {
      active = false;
    };
  }, [pathname, searchKey]);

  const signInWithGoogle = async () => {
    setLoading(true);
    try {
      const supabase = getBrowserSupabaseClient();
      const nextPath = buildNextPath();
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`;
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo
        }
      });
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    setLoading(true);
    try {
      await fetch("/api/auth/logout", {
        method: "POST"
      }).catch(() => undefined);

      const supabase = getBrowserSupabaseClient();
      await supabase.auth.signOut().catch(() => undefined);

      setSnapshot({ authenticated: false, email: null });
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  if (!snapshot.authenticated) {
    return (
      <button type="button" onClick={signInWithGoogle} disabled={loading}>
        {loading ? "Signing in..." : "Google Login"}
      </button>
    );
  }

  return (
    <div className="inline">
      <span className="muted">{snapshot.email ?? "Logged in"}</span>
      <button type="button" className="btn-secondary" onClick={signOut} disabled={loading}>
        Logout
      </button>
    </div>
  );
}
