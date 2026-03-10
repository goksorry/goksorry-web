import "server-only";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { buildStableProfileId, getNicknamePolicy, isAdminEmail, normalizeEmail, syncProfile } from "@/lib/profile-sync";
import { getServiceSupabaseClient } from "@/lib/supabase/service";

export type AppAuthUser = {
  id: string;
  email: string | null;
  name: string | null;
  image: string | null;
  nickname: string | null;
  role: "admin" | "user";
  created_at: string;
  nickname_confirmed_at: string | null;
  nickname_changed_at: string | null;
  nickname_needs_setup: boolean;
};

export const MIN_ACCOUNT_AGE_MINUTES = 15;
export { isAdminEmail };

export const getUserFromAuthorization = async (_request?: Request): Promise<AppAuthUser | null> => {
  const session = await getServerSession(authOptions);
  const email = String(session?.user?.email ?? "").trim().toLowerCase();
  const id = String(session?.user?.id ?? (email ? buildStableProfileId(email) : "")).trim();

  if (!session?.user || !email || !id) {
    return null;
  }

  const service = getServiceSupabaseClient();
  const { data: profile } = await service
    .from("profiles")
    .select("id,email,nickname,role,created_at,nickname_confirmed_at,nickname_changed_at")
    .eq("id", id)
    .maybeSingle();

  if (profile) {
    const nicknamePolicy = getNicknamePolicy({
      role: profile.role === "admin" ? "admin" : "user",
      nickname_confirmed_at: profile.nickname_confirmed_at ? String(profile.nickname_confirmed_at) : null,
      nickname_changed_at: profile.nickname_changed_at ? String(profile.nickname_changed_at) : null
    });

    return {
      id: String(profile.id),
      email: String(profile.email ?? email),
      name: session.user.name ?? null,
      image: session.user.image ?? null,
      nickname: String(profile.nickname ?? ""),
      role: profile.role === "admin" ? "admin" : "user",
      created_at: String(profile.created_at),
      nickname_confirmed_at: profile.nickname_confirmed_at ? String(profile.nickname_confirmed_at) : null,
      nickname_changed_at: profile.nickname_changed_at ? String(profile.nickname_changed_at) : null,
      nickname_needs_setup: nicknamePolicy.needs_setup
    };
  }

  try {
    const syncedProfile = await syncProfile({
      email,
      preferredName: session.user.name ?? session.user.nickname ?? null,
      preferredId: id
    });

    return {
      id: syncedProfile.id,
      email: syncedProfile.email,
      name: session.user.name ?? null,
      image: session.user.image ?? null,
      nickname: syncedProfile.nickname,
      role: syncedProfile.role,
      created_at: syncedProfile.created_at,
      nickname_confirmed_at: syncedProfile.nickname_confirmed_at,
      nickname_changed_at: syncedProfile.nickname_changed_at,
      nickname_needs_setup: getNicknamePolicy(syncedProfile).needs_setup
    };
  } catch (error) {
    console.error("profile sync failed during session lookup", error);
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
    created_at: createdAt,
    nickname_confirmed_at: session.user.nickname_confirmed_at ?? null,
    nickname_changed_at: session.user.nickname_changed_at ?? null,
    nickname_needs_setup: Boolean(session.user.nickname_needs_setup)
  };
};

export const ensureProfileForUser = async (user: AppAuthUser): Promise<"admin" | "user"> => {
  if (!user.email) {
    return "user";
  }

  const profile = await syncProfile({
    email: normalizeEmail(user.email),
    preferredName: user.name ?? user.nickname ?? null,
    preferredId: user.id
  });

  return profile.role;
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
