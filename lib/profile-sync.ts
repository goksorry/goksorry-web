import "server-only";

import { createHash } from "crypto";
import { getServerEnv } from "@/lib/env";
import { getServiceSupabaseClient } from "@/lib/supabase/service";

export type AppRole = "admin" | "user";

export type SyncedProfile = {
  id: string;
  email: string;
  nickname: string;
  role: AppRole;
  created_at: string;
};

export const normalizeEmail = (value: string): string => value.trim().toLowerCase();

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
  const fallback = normalizeEmail(email).split("@")[0] || "user";
  const candidate = String(preferredName ?? "").replace(/[<>]/g, "").trim().slice(0, 30);
  return candidate || fallback;
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
      id: String(preferredId ?? "").trim() || buildStableProfileId(normalizedEmail),
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
