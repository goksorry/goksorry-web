import "server-only";

import { getServerSession } from "next-auth";
import { getServerEnv } from "@/lib/env";
import { authOptions } from "@/lib/auth";
import { getServiceSupabaseClient } from "@/lib/supabase/service";

export type AppAuthUser = {
  id: string;
  email: string | null;
  name: string | null;
  image: string | null;
  nickname: string | null;
  role: "admin" | "user";
  created_at: string;
};

export const MIN_ACCOUNT_AGE_MINUTES = 15;

export const isAdminEmail = (email?: string | null): boolean => {
  if (!email) {
    return false;
  }
  const adminEmail = getServerEnv().ADMIN_EMAIL.trim().toLowerCase();
  if (!adminEmail) {
    return false;
  }
  return email.toLowerCase() === adminEmail;
};

const deriveNickname = (user: Pick<AppAuthUser, "id" | "email" | "name" | "nickname">): string => {
  const fallback = String(user.email ?? "").trim().toLowerCase().split("@")[0] || `user_${user.id.slice(0, 8)}`;
  const source = String(user.name ?? user.nickname ?? "").replace(/[<>]/g, "").trim().slice(0, 30);
  return source || fallback;
};

export const getUserFromAuthorization = async (_request?: Request): Promise<AppAuthUser | null> => {
  const session = await getServerSession(authOptions);
  const email = String(session?.user?.email ?? "").trim().toLowerCase();
  const id = String(session?.user?.id ?? "").trim();

  if (!session?.user || !email || !id) {
    return null;
  }

  const service = getServiceSupabaseClient();
  const { data: profile } = await service
    .from("profiles")
    .select("id,email,nickname,role,created_at")
    .eq("id", id)
    .maybeSingle();

  if (profile) {
    return {
      id: String(profile.id),
      email: String(profile.email ?? email),
      name: session.user.name ?? null,
      image: session.user.image ?? null,
      nickname: String(profile.nickname ?? ""),
      role: profile.role === "admin" ? "admin" : "user",
      created_at: String(profile.created_at)
    };
  }

  const createdAt = String(session.user.created_at ?? "").trim();
  if (!createdAt) {
    return null;
  }

  return {
    id,
    email,
    name: session.user.name ?? null,
    image: session.user.image ?? null,
    nickname: session.user.nickname ?? null,
    role: session.user.role === "admin" ? "admin" : "user",
    created_at: createdAt
  };
};

export const ensureProfileForUser = async (user: AppAuthUser): Promise<"admin" | "user"> => {
  if (!user.email) {
    return "user";
  }

  const role: "admin" | "user" = isAdminEmail(user.email) ? "admin" : user.role;
  const nickname = deriveNickname(user);
  const normalizedEmail = user.email.trim().toLowerCase();

  const service = getServiceSupabaseClient();
  const { error } = await service.from("profiles").upsert(
    {
      id: user.id,
      email: normalizedEmail,
      nickname,
      role
    },
    { onConflict: "id" }
  );

  if (error) {
    throw error;
  }

  return role;
};

export const checkAccountAge = (
  user: Pick<AppAuthUser, "created_at">,
  minMinutes: number = MIN_ACCOUNT_AGE_MINUTES
): { ok: boolean; waitMinutes: number } => {
  const createdAtMs = new Date(user.created_at).getTime();
  if (Number.isNaN(createdAtMs)) {
    return { ok: false, waitMinutes: minMinutes };
  }

  const elapsed = Date.now() - createdAtMs;
  const threshold = minMinutes * 60_000;
  if (elapsed >= threshold) {
    return { ok: true, waitMinutes: 0 };
  }

  const waitMinutes = Math.ceil((threshold - elapsed) / 60_000);
  return { ok: false, waitMinutes };
};
