import "server-only";

import { createClient, type User } from "@supabase/supabase-js";
import { getPublicEnv, getServerEnv } from "@/lib/env";
import { getServiceSupabaseClient } from "@/lib/supabase/service";

export const MIN_ACCOUNT_AGE_MINUTES = 15;
export const SESSION_COOKIE_NAME = "gks_session";

const parseBearerToken = (request: Request): string | null => {
  const authHeader = request.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return null;
  }
  const token = authHeader.slice(7).trim();
  return token || null;
};

const parseCookieToken = (request: Request): string | null => {
  const cookieHeader = request.headers.get("cookie") ?? "";
  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(";");
  for (const part of cookies) {
    const [rawName, ...rest] = part.trim().split("=");
    if (!rawName || rest.length === 0) {
      continue;
    }

    if (rawName !== SESSION_COOKIE_NAME) {
      continue;
    }

    const rawValue = rest.join("=");
    try {
      const decoded = decodeURIComponent(rawValue);
      return decoded || null;
    } catch {
      return rawValue || null;
    }
  }

  return null;
};

export const getUserFromAccessToken = async (accessToken: string): Promise<User | null> => {
  const token = accessToken.trim();
  if (!token) {
    return null;
  }

  const env = getPublicEnv();
  const anonClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  const { data, error } = await anonClient.auth.getUser(token);
  if (error || !data.user) {
    return null;
  }

  return data.user;
};

export const getUserFromAuthorization = async (request: Request): Promise<User | null> => {
  const token = parseBearerToken(request) ?? parseCookieToken(request);
  if (!token) {
    return null;
  }

  return getUserFromAccessToken(token);
};

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

export const ensureProfileForUser = async (user: User): Promise<"admin" | "user"> => {
  const service = getServiceSupabaseClient();
  const role: "admin" | "user" = isAdminEmail(user.email) ? "admin" : "user";

  const email = user.email ?? `unknown_${user.id.slice(0, 8)}@local.invalid`;
  const nameFromProvider = String(user.user_metadata?.full_name ?? user.user_metadata?.name ?? "");
  const fallback = email.split("@")[0] || `user_${user.id.slice(0, 8)}`;
  const nickname = (nameFromProvider || fallback).replace(/[<>]/g, "").trim().slice(0, 30) || fallback;

  await service.from("profiles").upsert(
    {
      id: user.id,
      email,
      nickname,
      role
    },
    { onConflict: "id" }
  );

  return role;
};

export const checkAccountAge = (
  user: User,
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
