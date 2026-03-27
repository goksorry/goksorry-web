import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getRequestId, jsonMessage, logApiError, requireSameOriginMutation } from "@/lib/api-auth";
import { getUserFromAuthorization } from "@/lib/auth-server";
import { sanitizePlainText } from "@/lib/plain-text";
import { buildStableProfileId, getNicknamePolicy, getProfileSetupState, isAdminEmail, normalizeEmail, withdrawAccount } from "@/lib/profile-sync";
import { getServiceSupabaseClient } from "@/lib/supabase/service";

export async function PATCH(request: Request) {
  const requestId = getRequestId(request);
  const sameOriginError = requireSameOriginMutation(request, requestId);
  if (sameOriginError) {
    return sameOriginError;
  }

  const user = await getUserFromAuthorization(request);
  if (!user || !user.email) {
    return jsonMessage(requestId, 401, "Unauthorized");
  }

  let body: {
    nickname?: unknown;
    age_confirmed?: unknown;
    terms_agreed?: unknown;
    privacy_agreed?: unknown;
  };
  try {
    body = (await request.json()) as {
      nickname?: unknown;
      age_confirmed?: unknown;
      terms_agreed?: unknown;
      privacy_agreed?: unknown;
    };
  } catch {
    return jsonMessage(requestId, 400, "Invalid JSON body");
  }

  let nickname: string;
  try {
    nickname = sanitizePlainText(body.nickname, "nickname", 30);
  } catch (error) {
    return jsonMessage(requestId, 400, String(error));
  }

  const service = getServiceSupabaseClient();
  const { data: profile, error: profileError } = await service
    .from("profiles")
    .select("id,nickname,role,nickname_confirmed_at,nickname_changed_at,age_confirmed_at,terms_agreed_at,privacy_agreed_at")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    if (profileError) {
      logApiError("profile lookup failed", requestId, profileError);
    }
    return jsonMessage(requestId, 500, "프로필을 불러오지 못했습니다.");
  }

  const nextRole = profile?.role === "admin" || isAdminEmail(user.email) ? "admin" : "user";
  const nicknamePolicy = getNicknamePolicy({
    role: nextRole,
    nickname_confirmed_at: profile?.nickname_confirmed_at ? String(profile.nickname_confirmed_at) : null,
    nickname_changed_at: profile?.nickname_changed_at ? String(profile.nickname_changed_at) : null
  });
  const profileSetupState = getProfileSetupState({
    nickname_confirmed_at: profile?.nickname_confirmed_at ? String(profile.nickname_confirmed_at) : null,
    age_confirmed_at: profile?.age_confirmed_at ? String(profile.age_confirmed_at) : null,
    terms_agreed_at: profile?.terms_agreed_at ? String(profile.terms_agreed_at) : null,
    privacy_agreed_at: profile?.privacy_agreed_at ? String(profile.privacy_agreed_at) : null
  });

  const currentNickname = String(profile?.nickname ?? "").trim();
  const changed = currentNickname.localeCompare(nickname, undefined, { sensitivity: "accent" }) !== 0;

  if (changed && !nicknamePolicy.can_change) {
    return NextResponse.json(
      { error: "닉네임은 7일에 한 번만 변경할 수 있습니다. 관리자만 제한 없이 변경할 수 있습니다.", request_id: requestId },
      { status: 403 }
    );
  }

  const nowIso = new Date().toISOString();
  const updates: {
    id?: string;
    email?: string;
    role?: "admin" | "user";
    nickname: string;
    nickname_confirmed_at: string;
    nickname_changed_at: string;
    age_confirmed_at?: string;
    terms_agreed_at?: string;
    privacy_agreed_at?: string;
  } = {
    nickname,
    nickname_confirmed_at: profile?.nickname_confirmed_at ?? nowIso,
    nickname_changed_at: changed || !profile?.nickname_changed_at ? nowIso : profile.nickname_changed_at
  };

  if (!profile || profileSetupState.needs_setup) {
    if (body.age_confirmed !== true) {
      return jsonMessage(requestId, 400, "만 14세 이상 확인이 필요합니다.");
    }
    if (body.terms_agreed !== true) {
      return jsonMessage(requestId, 400, "이용약관 동의가 필요합니다.");
    }
    if (body.privacy_agreed !== true) {
      return jsonMessage(requestId, 400, "개인정보처리방침 동의가 필요합니다.");
    }

    updates.age_confirmed_at = profile?.age_confirmed_at ?? nowIso;
    updates.terms_agreed_at = profile?.terms_agreed_at ?? nowIso;
    updates.privacy_agreed_at = profile?.privacy_agreed_at ?? nowIso;
  }

  if (!profile) {
    updates.id = String(user.id ?? "").trim() || buildStableProfileId(normalizeEmail(user.email));
    updates.email = normalizeEmail(user.email);
    updates.role = nextRole;
  }

  const profileQuery = !profile
    ? service.from("profiles").insert(updates)
    : service.from("profiles").update(updates).eq("id", user.id);

  const { error: updateError } = await profileQuery;

  if (updateError) {
    if (updateError.code === "23505") {
      return jsonMessage(requestId, 409, "이미 사용 중인 닉네임입니다.");
    }
    logApiError("profile update failed", requestId, updateError);
    return jsonMessage(requestId, 500, "프로필을 저장하지 못했습니다.");
  }

  revalidatePath("/profile");
  revalidatePath("/");
  revalidatePath("/community");

  return NextResponse.json({
    ok: true,
    nickname,
    profile_setup_required: false
  });
}

export async function DELETE(request: Request) {
  const requestId = getRequestId(request);
  const sameOriginError = requireSameOriginMutation(request, requestId);
  if (sameOriginError) {
    return sameOriginError;
  }

  const user = await getUserFromAuthorization(request);
  if (!user || !user.email) {
    return jsonMessage(requestId, 401, "Unauthorized");
  }
  if (user.role === "admin") {
    return jsonMessage(requestId, 403, "관리자 계정은 회원 탈퇴할 수 없습니다.");
  }

  try {
    await withdrawAccount({
      id: user.id,
      email: user.email,
      reason: "user_requested"
    });
  } catch (error) {
    logApiError("profile withdrawal failed", requestId, error);
    return jsonMessage(requestId, 500, "회원 탈퇴를 처리하지 못했습니다.");
  }

  revalidatePath("/profile");
  revalidatePath("/");
  revalidatePath("/community");

  return NextResponse.json({
    ok: true,
    withdrawn: true
  });
}
