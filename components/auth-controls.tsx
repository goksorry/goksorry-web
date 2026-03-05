"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Session, User } from "@supabase/supabase-js";
import { getBrowserSupabaseClient } from "@/lib/supabase/browser";

type AuthState = {
  session: Session | null;
  user: User | null;
};

const buildNextPath = (): string => {
  if (typeof window === "undefined") {
    return "/";
  }
  return `${window.location.pathname}${window.location.search}`;
};

export function AuthControls() {
  const router = useRouter();
  const [authState, setAuthState] = useState<AuthState>({ session: null, user: null });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const supabase = getBrowserSupabaseClient();

    const loadInitial = async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) {
        return;
      }
      setAuthState({ session: data.session, user: data.session?.user ?? null });

      if (data.session?.access_token) {
        await fetch("/api/auth/sync-profile", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${data.session.access_token}`
          }
        }).catch(() => undefined);
      }
    };

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!active) {
        return;
      }
      setAuthState({ session, user: session?.user ?? null });

      if (session?.access_token) {
        await fetch("/api/auth/sync-profile", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`
          }
        }).catch(() => undefined);
      }

      router.refresh();
    });

    loadInitial().catch(() => undefined);

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [router]);

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
      const supabase = getBrowserSupabaseClient();
      await supabase.auth.signOut();
      setAuthState({ session: null, user: null });
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  if (!authState.user) {
    return (
      <button type="button" onClick={signInWithGoogle} disabled={loading}>
        {loading ? "Signing in..." : "Google Login"}
      </button>
    );
  }

  return (
    <div className="inline">
      <span className="muted">{authState.user.email}</span>
      <button type="button" className="btn-secondary" onClick={signOut} disabled={loading}>
        Logout
      </button>
    </div>
  );
}
