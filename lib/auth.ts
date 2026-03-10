import "server-only";

import { randomUUID } from "crypto";
import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import type { JWT } from "next-auth/jwt";
import { getServerEnv } from "@/lib/env";
import { getServiceSupabaseClient } from "@/lib/supabase/service";

type AppRole = "admin" | "user";

type SyncedProfile = {
  id: string;
  email: string;
  nickname: string;
  role: AppRole;
  created_at: string;
};

const normalizeEmail = (value: string): string => value.trim().toLowerCase();

const isAdminEmail = (email?: string | null): boolean => {
  if (!email) {
    return false;
  }

  const adminEmail = getServerEnv().ADMIN_EMAIL.trim().toLowerCase();
  if (!adminEmail) {
    return false;
  }

  return normalizeEmail(email) === adminEmail;
};

const buildNickname = (email: string, preferredName?: string | null): string => {
  const fallback = normalizeEmail(email).split("@")[0] || `user_${randomUUID().slice(0, 8)}`;
  const candidate = String(preferredName ?? "").replace(/[<>]/g, "").trim().slice(0, 30);
  return candidate || fallback;
};

const syncProfile = async ({
  email,
  preferredName
}: {
  email: string;
  preferredName?: string | null;
}): Promise<SyncedProfile> => {
  const service = getServiceSupabaseClient();
  const normalizedEmail = normalizeEmail(email);
  const desiredRole: AppRole = isAdminEmail(normalizedEmail) ? "admin" : "user";
  const nickname = buildNickname(normalizedEmail, preferredName);

  const { data: existing, error: existingError } = await service
    .from("profiles")
    .select("id,email,nickname,role,created_at")
    .ilike("email", normalizedEmail)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (existing) {
    const nextRole: AppRole = existing.role === "admin" || desiredRole === "admin" ? "admin" : "user";
    const nextNickname = String(existing.nickname ?? "").trim() || nickname;

    const { data: updated, error: updateError } = await service
      .from("profiles")
      .upsert(
        {
          id: existing.id,
          email: normalizedEmail,
          nickname: nextNickname,
          role: nextRole
        },
        { onConflict: "id" }
      )
      .select("id,email,nickname,role,created_at")
      .single();

    if (updateError || !updated) {
      throw new Error(updateError?.message ?? "failed to update profile");
    }

    return {
      id: String(updated.id),
      email: String(updated.email),
      nickname: String(updated.nickname),
      role: updated.role === "admin" ? "admin" : "user",
      created_at: String(updated.created_at)
    };
  }

  const { data: inserted, error: insertError } = await service
    .from("profiles")
    .insert({
      id: randomUUID(),
      email: normalizedEmail,
      nickname,
      role: desiredRole
    })
    .select("id,email,nickname,role,created_at")
    .single();

  if (insertError || !inserted) {
    throw new Error(insertError?.message ?? "failed to create profile");
  }

  return {
    id: String(inserted.id),
    email: String(inserted.email),
    nickname: String(inserted.nickname),
    role: inserted.role === "admin" ? "admin" : "user",
    created_at: String(inserted.created_at)
  };
};

const syncTokenProfile = async (
  token: JWT,
  user?: {
    email?: string | null;
    name?: string | null;
  }
): Promise<JWT> => {
  const email = String(user?.email ?? token.email ?? "").trim().toLowerCase();
  if (!email) {
    return token;
  }

  const profile = await syncProfile({
    email,
    preferredName: user?.name ?? (typeof token.name === "string" ? token.name : null)
  });

  token.email = profile.email;
  token.name = profile.nickname;
  token.appUserId = profile.id;
  token.role = profile.role;
  token.nickname = profile.nickname;
  token.profileCreatedAt = profile.created_at;
  return token;
};

export const authOptions: NextAuthOptions = {
  secret: getServerEnv().NEXTAUTH_SECRET,
  session: {
    strategy: "jwt"
  },
  pages: {
    signIn: "/auth/login"
  },
  providers: [
    GoogleProvider({
      clientId: getServerEnv().GOOGLE_CLIENT_ID,
      clientSecret: getServerEnv().GOOGLE_CLIENT_SECRET
    })
  ],
  callbacks: {
    async signIn({ user }) {
      return Boolean(user.email);
    },
    async jwt({ token, user }) {
      if (user?.email || !token.appUserId) {
        return syncTokenProfile(token, user);
      }

      return token;
    },
    async session({ session, token }) {
      if (!session.user) {
        return session;
      }

      session.user.id = String(token.appUserId ?? "");
      session.user.role = token.role === "admin" ? "admin" : "user";
      session.user.nickname = typeof token.nickname === "string" ? token.nickname : null;
      session.user.created_at =
        typeof token.profileCreatedAt === "string" ? token.profileCreatedAt : new Date().toISOString();
      session.user.name = typeof token.name === "string" ? token.name : session.user.name ?? null;
      session.user.email = typeof token.email === "string" ? token.email : session.user.email ?? null;
      return session;
    }
  }
};
