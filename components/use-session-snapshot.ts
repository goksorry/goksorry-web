"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

type SessionSnapshot = {
  id: string | null;
  email: string;
  nickname: string | null;
  role: "admin" | "user";
  profile_setup_required: boolean;
};

type SessionSnapshotUser = SessionSnapshot;

const SESSION_SNAPSHOT_KEY = "session-snapshot";

const readSessionSnapshot = (): SessionSnapshot | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.sessionStorage.getItem(SESSION_SNAPSHOT_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<SessionSnapshot>;
    if (typeof parsed.email !== "string" || !parsed.email.trim()) {
      return null;
    }

    return {
      id: typeof parsed.id === "string" ? parsed.id : null,
      email: parsed.email,
      nickname: typeof parsed.nickname === "string" ? parsed.nickname : null,
      role: parsed.role === "admin" ? "admin" : "user",
      profile_setup_required: Boolean(parsed.profile_setup_required)
    };
  } catch {
    return null;
  }
};

const writeSessionSnapshot = (snapshot: SessionSnapshot) => {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(SESSION_SNAPSHOT_KEY, JSON.stringify(snapshot));
};

const clearSessionSnapshot = () => {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(SESSION_SNAPSHOT_KEY);
};

const buildSnapshot = (session: ReturnType<typeof useSession>["data"]): SessionSnapshot | null => {
  const user = session?.user;
  const email = typeof user?.email === "string" ? user.email.trim() : "";
  if (!email) {
    return null;
  }

  return {
    id: typeof user?.id === "string" ? user.id : null,
    email,
    nickname: typeof user?.nickname === "string" ? user.nickname : null,
    role: user?.role === "admin" ? "admin" : "user",
    profile_setup_required: Boolean(user?.profile_setup_required)
  };
};

export function useSessionSnapshot() {
  const { data: session, status, update } = useSession();
  const [snapshot, setSnapshot] = useState<SessionSnapshot | null>(null);
  const sessionUser = session?.user ?? null;

  useEffect(() => {
    setSnapshot(readSessionSnapshot());
  }, []);

  useEffect(() => {
    if (status === "authenticated") {
      const nextSnapshot = buildSnapshot(session);
      if (nextSnapshot) {
        writeSessionSnapshot(nextSnapshot);
        setSnapshot(nextSnapshot);
      }
      return;
    }

    if (status === "unauthenticated") {
      clearSessionSnapshot();
      setSnapshot(null);
    }
  }, [
    sessionUser?.email,
    sessionUser?.id,
    sessionUser?.nickname,
    sessionUser?.profile_setup_required,
    sessionUser?.role,
    status,
    session
  ]);

  const hintedUser = status === "loading" && !sessionUser?.email ? snapshot : null;
  const user = sessionUser?.email ? sessionUser : (hintedUser as SessionSnapshotUser | null);

  return {
    session,
    status,
    update,
    user,
    hinted: Boolean(hintedUser),
    authenticated: Boolean(user?.email)
  };
}
