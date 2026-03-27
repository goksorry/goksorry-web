import "server-only";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { buildStableProfileId, findProfileByIdentity, getProfileSetupState, isAdminEmail, type SyncedProfile } from "@/lib/profile-sync";

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
  profile_setup_required: boolean;
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

  const profile = await findProfileByIdentity({ id, email });

  if (profile) {
    const profileSetupState = getProfileSetupState({
      nickname_confirmed_at: profile.nickname_confirmed_at ? String(profile.nickname_confirmed_at) : null,
      age_confirmed_at: profile.age_confirmed_at ? String(profile.age_confirmed_at) : null,
      terms_agreed_at: profile.terms_agreed_at ? String(profile.terms_agreed_at) : null,
      privacy_agreed_at: profile.privacy_agreed_at ? String(profile.privacy_agreed_at) : null
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
      profile_setup_required: profileSetupState.needs_setup
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
    created_at: createdAt,
    nickname_confirmed_at: session.user.nickname_confirmed_at ?? null,
    nickname_changed_at: session.user.nickname_changed_at ?? null,
    profile_setup_required: Boolean(session.user.profile_setup_required)
  };
};

export const getStoredProfileForUser = async (
  user: Pick<AppAuthUser, "id" | "email">
): Promise<SyncedProfile | null> => {
  if (!user.email) {
    return null;
  }

  return findProfileByIdentity({
    id: user.id,
    email: user.email
  });
};

export const getCompletedProfileForUser = async (
  user: Pick<AppAuthUser, "id" | "email">
): Promise<SyncedProfile | null> => {
  const profile = await getStoredProfileForUser(user);
  if (!profile) {
    return null;
  }

  return getProfileSetupState(profile).needs_setup ? null : profile;
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
