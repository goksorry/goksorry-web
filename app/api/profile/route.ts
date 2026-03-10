import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getRequestId, jsonMessage, logApiError, requireSameOriginMutation } from "@/lib/api-auth";
import { ensureProfileForUser, getUserFromAuthorization } from "@/lib/auth-server";
import { sanitizePlainText } from "@/lib/plain-text";
import { getNicknamePolicy, withdrawAccount } from "@/lib/profile-sync";
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

  await ensureProfileForUser(user);

  let body: { nickname?: unknown };
  try {
    body = (await request.json()) as { nickname?: unknown };
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
    .select("id,nickname,role,nickname_confirmed_at,nickname_changed_at")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    if (profileError) {
      logApiError("profile lookup failed", requestId, profileError);
    }
    return jsonMessage(requestId, 404, "Profile not found");
  }

  const nextRole = profile.role === "admin" ? "admin" : "user";
  const nicknamePolicy = getNicknamePolicy({
    role: nextRole,
    nickname_confirmed_at: profile.nickname_confirmed_at ? String(profile.nickname_confirmed_at) : null,
    nickname_changed_at: profile.nickname_changed_at ? String(profile.nickname_changed_at) : null
  });

  const currentNickname = String(profile.nickname ?? "").trim();
  const changed = currentNickname.localeCompare(nickname, undefined, { sensitivity: "accent" }) !== 0;

  if (changed && !nicknamePolicy.can_change) {
    return NextResponse.json(
      { error: "닉네임은 7일에 한 번만 변경할 수 있습니다. 관리자만 제한 없이 변경할 수 있습니다.", request_id: requestId },
      { status: 403 }
    );
  }

  const nowIso = new Date().toISOString();
  const updates = {
    nickname,
    nickname_confirmed_at: profile.nickname_confirmed_at ?? nowIso,
    nickname_changed_at: changed || !profile.nickname_changed_at ? nowIso : profile.nickname_changed_at
  };

  const { error: updateError } = await service.from("profiles").update(updates).eq("id", user.id);

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
    nickname_needs_setup: false
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
