import "server-only";

import { createHash } from "crypto";
import { getServerEnv } from "@/lib/env";
import { getServiceSupabaseClient } from "@/lib/supabase/service";

export type AppRole = "admin" | "user";
export const NICKNAME_MAX_LENGTH = 30;
export const NICKNAME_CHANGE_COOLDOWN_DAYS = 7;
export const ACCOUNT_REJOIN_COOLDOWN_DAYS = 7;

export type SyncedProfile = {
  id: string;
  email: string;
  google_sub: string | null;
  nickname: string;
  role: AppRole;
  created_at: string;
  nickname_confirmed_at: string | null;
  nickname_changed_at: string | null;
  age_confirmed_at: string | null;
  terms_agreed_at: string | null;
  privacy_agreed_at: string | null;
};

export type NicknamePolicy = {
  can_change: boolean;
  needs_setup: boolean;
  available_at: string | null;
};

export type ProfileSetupState = {
  needs_setup: boolean;
  missing_nickname_confirmation: boolean;
  missing_age_confirmation: boolean;
  missing_terms_agreement: boolean;
  missing_privacy_agreement: boolean;
};

export const normalizeEmail = (value: string): string => value.trim().toLowerCase();
export const normalizeGoogleSub = (value: string): string => value.trim();

const WITHDRAWAL_REJOIN_COOLDOWN_MS = ACCOUNT_REJOIN_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
const WITHDRAWAL_PURGE_INTERVAL_MS = 24 * 60 * 60 * 1000;
const PROFILE_SELECT =
  "id,email,google_sub,nickname,role,created_at,nickname_confirmed_at,nickname_changed_at,age_confirmed_at,terms_agreed_at,privacy_agreed_at";

const isMissingDetectorStatusFieldError = (code: string | null | undefined, message: string): boolean => {
  return (
    code === "42P01" ||
    code === "42703" ||
    code === "PGRST204" ||
    message.includes("detector_status") ||
    message.includes("schema cache")
  );
};

const getWithdrawalExpiryCutoffIso = (): string => {
  return new Date(Date.now() - WITHDRAWAL_REJOIN_COOLDOWN_MS).toISOString();
};

const shouldPurgeExpiredWithdrawnAccounts = async (): Promise<boolean> => {
  const service = getServiceSupabaseClient();
  const { data, error } = await service
    .from("detector_status")
    .select("withdrawn_accounts_purged_at")
    .eq("singleton", true)
    .maybeSingle<{ withdrawn_accounts_purged_at: string | null }>();

  if (error) {
    if (isMissingDetectorStatusFieldError(error.code, error.message)) {
      return true;
    }

    console.error("failed to load withdrawn account purge status", error);
    return true;
  }

  const lastPurgedAtMs = data?.withdrawn_accounts_purged_at ? new Date(data.withdrawn_accounts_purged_at).getTime() : NaN;
  if (Number.isNaN(lastPurgedAtMs)) {
    return true;
  }

  return Date.now() - lastPurgedAtMs >= WITHDRAWAL_PURGE_INTERVAL_MS;
};

const markExpiredWithdrawnAccountsPurged = async (purgedAtIso: string): Promise<void> => {
  const service = getServiceSupabaseClient();
  const { error } = await service.from("detector_status").upsert(
    {
      singleton: true,
      withdrawn_accounts_purged_at: purgedAtIso
    },
    { onConflict: "singleton" }
  );

  if (error && !isMissingDetectorStatusFieldError(error.code, error.message)) {
    console.error("failed to update withdrawn account purge status", error);
  }
};

const purgeExpiredWithdrawnAccounts = async (): Promise<void> => {
  if (!(await shouldPurgeExpiredWithdrawnAccounts())) {
    return;
  }

  const service = getServiceSupabaseClient();
  const purgedAtIso = new Date().toISOString();
  const { error } = await service.from("withdrawn_accounts").delete().lt("withdrawn_at", getWithdrawalExpiryCutoffIso());

  if (error) {
    console.error("failed to purge expired withdrawn accounts", error);
    return;
  }

  await markExpiredWithdrawnAccountsPurged(purgedAtIso);
};

const getHoldAvailableAt = (withdrawnAt: string | null | undefined): string | null => {
  if (!withdrawnAt) {
    return null;
  }

  const withdrawnAtMs = new Date(withdrawnAt).getTime();
  if (Number.isNaN(withdrawnAtMs)) {
    return null;
  }

  const availableAtMs = withdrawnAtMs + WITHDRAWAL_REJOIN_COOLDOWN_MS;
  if (Date.now() >= availableAtMs) {
    return null;
  }

  return new Date(availableAtMs).toISOString();
};

const clearExpiredWithdrawalHold = async ({
  email,
  googleSub
}: {
  email?: string | null;
  googleSub?: string | null;
}): Promise<void> => {
  const service = getServiceSupabaseClient();

  if (googleSub) {
    const { error } = await service.from("withdrawn_accounts").delete().eq("google_sub", normalizeGoogleSub(googleSub));
    if (error) {
      console.error("failed to delete expired withdrawn account hold by google_sub", error);
    }
  }

  if (email) {
    const { error } = await service.from("withdrawn_accounts").delete().eq("email", normalizeEmail(email));
    if (error) {
      console.error("failed to delete expired withdrawn account hold by email", error);
    }
  }
};

export const getWithdrawalHoldUntil = async ({
  email,
  googleSub
}: {
  email: string;
  googleSub?: string | null;
}): Promise<string | null> => {
  const service = getServiceSupabaseClient();
  const normalizedEmail = normalizeEmail(email);
  const normalizedGoogleSub = googleSub ? normalizeGoogleSub(googleSub) : null;
  await purgeExpiredWithdrawnAccounts();

  if (normalizedGoogleSub) {
    const { data, error } = await service
      .from("withdrawn_accounts")
      .select("withdrawn_at")
      .eq("google_sub", normalizedGoogleSub)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    const availableAt = getHoldAvailableAt(data?.withdrawn_at ? String(data.withdrawn_at) : null);
    if (availableAt) {
      return availableAt;
    }

    if (data?.withdrawn_at) {
      await clearExpiredWithdrawalHold({
        email: normalizedEmail,
        googleSub: normalizedGoogleSub
      });
      return null;
    }
  }

  const { data, error } = await service.from("withdrawn_accounts").select("withdrawn_at").eq("email", normalizedEmail).maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const availableAt = getHoldAvailableAt(data?.withdrawn_at ? String(data.withdrawn_at) : null);
  if (availableAt) {
    return availableAt;
  }

  if (data?.withdrawn_at) {
    await clearExpiredWithdrawalHold({
      email: normalizedEmail,
      googleSub: normalizedGoogleSub
    });
    return null;
  }

  return null;
};

export const withdrawAccount = async ({
  id,
  email,
  googleSub,
  reason
}: {
  id: string;
  email: string;
  googleSub?: string | null;
  reason?: string | null;
}): Promise<void> => {
  const service = getServiceSupabaseClient();
  const normalizedEmail = normalizeEmail(email);
  const normalizedGoogleSub = googleSub ? normalizeGoogleSub(googleSub) : null;
  const normalizedReason = String(reason ?? "").replace(/[<>]/g, "").trim() || null;

  const { error: tombstoneError } = await service.from("withdrawn_accounts").upsert(
    {
      email: normalizedEmail,
      google_sub: normalizedGoogleSub,
      reason: normalizedReason
    },
    { onConflict: "email" }
  );

  if (tombstoneError) {
    throw new Error(tombstoneError.message);
  }

  const { error: deleteError } = await service.from("profiles").delete().eq("id", id);
  if (deleteError) {
    throw new Error(deleteError.message);
  }
};

export const isAdminEmail = (email?: string | null): boolean => {
  if (!email) {
    return false;
  }

  const adminEmail = getServerEnv().ADMIN_EMAIL.trim().toLowerCase();
  if (!adminEmail) {
    return false;
  }

  return normalizeEmail(email) === adminEmail;
};

export const buildNickname = (email: string, preferredName?: string | null): string => {
  const baseSource = String(preferredName ?? "").replace(/[<>]/g, "").trim() || normalizeEmail(email).split("@")[0] || "user";
  const suffix = createHash("sha256").update(normalizeEmail(email)).digest("hex").slice(0, 6);
  const maxBaseLength = Math.max(1, NICKNAME_MAX_LENGTH - suffix.length - 1);
  const base = baseSource.slice(0, maxBaseLength);
  return `${base}_${suffix}`;
};

const buildStableProfileIdFromSeed = (seed: string): string => {
  const bytes = createHash("sha256")
    .update(`goksorry:${seed}`)
    .digest()
    .subarray(0, 16);

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
};

export const buildLegacyProfileIdFromEmail = (email: string): string => buildStableProfileIdFromSeed(normalizeEmail(email));

export const buildStableProfileIdFromGoogleSub = (googleSub: string): string =>
  buildStableProfileIdFromSeed(`google:${normalizeGoogleSub(googleSub)}`);

export const getNicknamePolicy = ({
  role,
  nickname_confirmed_at,
  nickname_changed_at
}: {
  role: AppRole;
  nickname_confirmed_at?: string | null;
  nickname_changed_at?: string | null;
}): NicknamePolicy => {
  if (role === "admin") {
    return {
      can_change: true,
      needs_setup: !nickname_confirmed_at,
      available_at: null
    };
  }

  if (!nickname_confirmed_at) {
    return {
      can_change: true,
      needs_setup: true,
      available_at: null
    };
  }

  if (!nickname_changed_at) {
    return {
      can_change: true,
      needs_setup: false,
      available_at: null
    };
  }

  const changedAtMs = new Date(nickname_changed_at).getTime();
  if (Number.isNaN(changedAtMs)) {
    return {
      can_change: true,
      needs_setup: false,
      available_at: null
    };
  }

  const availableAtMs = changedAtMs + NICKNAME_CHANGE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
  const canChange = Date.now() >= availableAtMs;

  return {
    can_change: canChange,
    needs_setup: false,
    available_at: canChange ? null : new Date(availableAtMs).toISOString()
  };
};

export const getProfileSetupState = ({
  nickname_confirmed_at,
  age_confirmed_at,
  terms_agreed_at,
  privacy_agreed_at
}: {
  nickname_confirmed_at?: string | null;
  age_confirmed_at?: string | null;
  terms_agreed_at?: string | null;
  privacy_agreed_at?: string | null;
}): ProfileSetupState => {
  const missingNicknameConfirmation = !nickname_confirmed_at;
  const missingAgeConfirmation = !age_confirmed_at;
  const missingTermsAgreement = !terms_agreed_at;
  const missingPrivacyAgreement = !privacy_agreed_at;

  return {
    needs_setup:
      missingNicknameConfirmation ||
      missingAgeConfirmation ||
      missingTermsAgreement ||
      missingPrivacyAgreement,
    missing_nickname_confirmation: missingNicknameConfirmation,
    missing_age_confirmation: missingAgeConfirmation,
    missing_terms_agreement: missingTermsAgreement,
    missing_privacy_agreement: missingPrivacyAgreement
  };
};

const serializeProfile = (data: {
  id: string;
  email: string;
  google_sub?: string | null;
  nickname: string;
  role: string;
  created_at: string;
  nickname_confirmed_at?: string | null;
  nickname_changed_at?: string | null;
  age_confirmed_at?: string | null;
  terms_agreed_at?: string | null;
  privacy_agreed_at?: string | null;
}): SyncedProfile => {
  return {
    id: String(data.id),
    email: String(data.email),
    google_sub: data.google_sub ? String(data.google_sub) : null,
    nickname: String(data.nickname),
    role: data.role === "admin" ? "admin" : "user",
    created_at: String(data.created_at),
    nickname_confirmed_at: data.nickname_confirmed_at ? String(data.nickname_confirmed_at) : null,
    nickname_changed_at: data.nickname_changed_at ? String(data.nickname_changed_at) : null,
    age_confirmed_at: data.age_confirmed_at ? String(data.age_confirmed_at) : null,
    terms_agreed_at: data.terms_agreed_at ? String(data.terms_agreed_at) : null,
    privacy_agreed_at: data.privacy_agreed_at ? String(data.privacy_agreed_at) : null
  };
};

const findProfileByColumn = async (
  column: "google_sub" | "id" | "email",
  value: string
): Promise<SyncedProfile | null> => {
  const service = getServiceSupabaseClient();
  const query = service.from("profiles").select(PROFILE_SELECT);
  const scopedQuery =
    column === "email" ? query.ilike("email", normalizeEmail(value)) : query.eq(column, column === "google_sub" ? normalizeGoogleSub(value) : value);
  const { data, error } = await scopedQuery.maybeSingle();

  if (error || !data) {
    return null;
  }

  return serializeProfile(data);
};

export const findProfileByIdentity = async ({
  googleSub,
  id,
  email
}: {
  googleSub?: string | null;
  id?: string | null;
  email?: string | null;
}): Promise<SyncedProfile | null> => {
  if (googleSub) {
    const profile = await findProfileByColumn("google_sub", googleSub);
    if (profile) {
      return profile;
    }
  }

  if (id) {
    const profile = await findProfileByColumn("id", id);
    if (profile) {
      return profile;
    }
  }

  if (email) {
    return findProfileByColumn("email", email);
  }

  return null;
};

export const syncProfileIdentity = async (
  profile: SyncedProfile,
  {
    googleSub,
    email
  }: {
    googleSub?: string | null;
    email?: string | null;
  }
): Promise<SyncedProfile> => {
  const normalizedGoogleSub = googleSub ? normalizeGoogleSub(googleSub) : null;
  const normalizedEmail = email ? normalizeEmail(email) : null;
  const updates: {
    google_sub?: string;
    email?: string;
  } = {};

  if (normalizedGoogleSub && profile.google_sub !== normalizedGoogleSub) {
    updates.google_sub = normalizedGoogleSub;
  }

  if (normalizedEmail && normalizeEmail(profile.email) !== normalizedEmail) {
    updates.email = normalizedEmail;
  }

  if (Object.keys(updates).length === 0) {
    return profile;
  }

  const service = getServiceSupabaseClient();
  const { data, error } = await service.from("profiles").update(updates).eq("id", profile.id).select(PROFILE_SELECT).maybeSingle();

  if (error) {
    console.error("failed to sync profile identity", error);
    return profile;
  }

  if (!data) {
    return profile;
  }

  return serializeProfile(data);
};
