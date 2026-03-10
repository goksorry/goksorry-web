import "server-only";

import { createHash } from "crypto";
import { getServerEnv } from "@/lib/env";
import { getServiceSupabaseClient } from "@/lib/supabase/service";

export type AppRole = "admin" | "user";
export const NICKNAME_MAX_LENGTH = 30;
export const NICKNAME_CHANGE_COOLDOWN_DAYS = 7;

export type SyncedProfile = {
  id: string;
  email: string;
  nickname: string;
  role: AppRole;
  created_at: string;
  nickname_confirmed_at: string | null;
  nickname_changed_at: string | null;
};

export type NicknamePolicy = {
  can_change: boolean;
  needs_setup: boolean;
  available_at: string | null;
};

export class WithdrawnAccountError extends Error {
  constructor() {
    super("withdrawn_account");
    this.name = "WithdrawnAccountError";
  }
}

export const normalizeEmail = (value: string): string => value.trim().toLowerCase();

export const isWithdrawnEmail = async (email: string): Promise<boolean> => {
  const service = getServiceSupabaseClient();
  const normalizedEmail = normalizeEmail(email);

  const { data, error } = await service
    .from("withdrawn_accounts")
    .select("email")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data?.email);
};

export const withdrawAccount = async ({
  id,
  email,
  reason
}: {
  id: string;
  email: string;
  reason?: string | null;
}): Promise<void> => {
  const service = getServiceSupabaseClient();
  const normalizedEmail = normalizeEmail(email);
  const normalizedReason = String(reason ?? "").replace(/[<>]/g, "").trim() || null;

  const { error: tombstoneError } = await service.from("withdrawn_accounts").upsert(
    {
      email: normalizedEmail,
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

export const buildStableProfileId = (email: string): string => {
  const bytes = createHash("sha256")
    .update(`goksorry:${normalizeEmail(email)}`)
    .digest()
    .subarray(0, 16);

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
};

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

export const syncProfile = async ({
  email,
  preferredName,
  preferredId
}: {
  email: string;
  preferredName?: string | null;
  preferredId?: string | null;
}): Promise<SyncedProfile> => {
  const service = getServiceSupabaseClient();
  const normalizedEmail = normalizeEmail(email);
  if (await isWithdrawnEmail(normalizedEmail)) {
    throw new WithdrawnAccountError();
  }
  const desiredRole: AppRole = isAdminEmail(normalizedEmail) ? "admin" : "user";
  const nickname = buildNickname(normalizedEmail, preferredName);

  const { data: existing, error: existingError } = await service
    .from("profiles")
    .select("id,email,nickname,role,created_at,nickname_confirmed_at,nickname_changed_at")
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
      .select("id,email,nickname,role,created_at,nickname_confirmed_at,nickname_changed_at")
      .single();

    if (updateError || !updated) {
      throw new Error(updateError?.message ?? "failed to update profile");
    }

    return {
      id: String(updated.id),
      email: String(updated.email),
      nickname: String(updated.nickname),
      role: updated.role === "admin" ? "admin" : "user",
      created_at: String(updated.created_at),
      nickname_confirmed_at: updated.nickname_confirmed_at ? String(updated.nickname_confirmed_at) : null,
      nickname_changed_at: updated.nickname_changed_at ? String(updated.nickname_changed_at) : null
    };
  }

  const { data: inserted, error: insertError } = await service
    .from("profiles")
    .insert({
      id: String(preferredId ?? "").trim() || buildStableProfileId(normalizedEmail),
      email: normalizedEmail,
      nickname,
      role: desiredRole
    })
    .select("id,email,nickname,role,created_at,nickname_confirmed_at,nickname_changed_at")
    .single();

  if (insertError || !inserted) {
    throw new Error(insertError?.message ?? "failed to create profile");
  }

  return {
    id: String(inserted.id),
    email: String(inserted.email),
    nickname: String(inserted.nickname),
    role: inserted.role === "admin" ? "admin" : "user",
    created_at: String(inserted.created_at),
    nickname_confirmed_at: inserted.nickname_confirmed_at ? String(inserted.nickname_confirmed_at) : null,
    nickname_changed_at: inserted.nickname_changed_at ? String(inserted.nickname_changed_at) : null
  };
};

export const findProfileByIdentity = async ({
  id,
  email
}: {
  id?: string | null;
  email?: string | null;
}): Promise<SyncedProfile | null> => {
  const service = getServiceSupabaseClient();
  let query = service
    .from("profiles")
    .select("id,email,nickname,role,created_at,nickname_confirmed_at,nickname_changed_at");

  if (id) {
    query = query.eq("id", id);
  } else if (email) {
    query = query.ilike("email", normalizeEmail(email));
  } else {
    return null;
  }

  const { data, error } = await query.maybeSingle();

  if (error || !data) {
    return null;
  }

  return {
    id: String(data.id),
    email: String(data.email),
    nickname: String(data.nickname),
    role: data.role === "admin" ? "admin" : "user",
    created_at: String(data.created_at),
    nickname_confirmed_at: data.nickname_confirmed_at ? String(data.nickname_confirmed_at) : null,
    nickname_changed_at: data.nickname_changed_at ? String(data.nickname_changed_at) : null
  };
};
