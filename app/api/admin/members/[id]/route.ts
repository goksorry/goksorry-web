import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getRequestId, jsonMessage, logApiError, requireSameOriginMutation } from "@/lib/api-auth";
import { getUserFromAuthorization, isAdminEmail } from "@/lib/auth-server";
import { sanitizePlainText } from "@/lib/plain-text";
import { withdrawAccount } from "@/lib/profile-sync";
import { getServiceSupabaseClient } from "@/lib/supabase/service";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const jsonNoStore = (body: Record<string, unknown>, status: number = 200): NextResponse => {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "no-store");
  return response;
};

const lookupMember = async (id: string) => {
  const service = getServiceSupabaseClient();
  const { data, error } = await service
    .from("profiles")
    .select("id,email,nickname,role,nickname_confirmed_at,nickname_changed_at")
    .eq("id", id)
    .maybeSingle();

  return {
    service,
    data,
    error
  };
};

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const requestId = getRequestId(request);
  const sameOriginError = requireSameOriginMutation(request, requestId);
  if (sameOriginError) {
    return sameOriginError;
  }

  const user = await getUserFromAuthorization(request);
  if (!user) {
    return jsonMessage(requestId, 401, "Unauthorized");
  }
  if (user.role !== "admin" && !isAdminEmail(user.email)) {
    return jsonMessage(requestId, 403, "Forbidden");
  }

  const id = String(params.id ?? "").trim();
  if (!UUID_PATTERN.test(id)) {
    return jsonMessage(requestId, 400, "잘못된 회원 ID입니다.");
  }

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

  const { service, data: member, error } = await lookupMember(id);
  if (error) {
    logApiError("admin member nickname lookup failed", requestId, error);
    return jsonMessage(requestId, 500, "회원 정보를 불러오지 못했습니다.");
  }
  if (!member) {
    return jsonMessage(requestId, 404, "회원을 찾지 못했습니다.");
  }
  if (member.role === "admin") {
    return jsonMessage(requestId, 403, "관리자 계정은 이 화면에서 강제 변경할 수 없습니다.");
  }

  const nowIso = new Date().toISOString();
  const updates = {
    nickname,
    nickname_confirmed_at: member.nickname_confirmed_at ?? nowIso,
    nickname_changed_at: nowIso
  };

  const { error: updateError } = await service.from("profiles").update(updates).eq("id", id);
  if (updateError) {
    if (updateError.code === "23505") {
      return jsonMessage(requestId, 409, "이미 사용 중인 닉네임입니다.");
    }
    logApiError("admin member nickname update failed", requestId, updateError);
    return jsonMessage(requestId, 500, "닉네임을 변경하지 못했습니다.");
  }

  revalidatePath("/admin/members");
  revalidatePath("/profile");
  revalidatePath("/");
  revalidatePath("/community");

  return jsonNoStore({
    status: "ok",
    member: {
      id,
      nickname
    }
  });
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const requestId = getRequestId(request);
  const sameOriginError = requireSameOriginMutation(request, requestId);
  if (sameOriginError) {
    return sameOriginError;
  }

  const user = await getUserFromAuthorization(request);
  if (!user) {
    return jsonMessage(requestId, 401, "Unauthorized");
  }
  if (user.role !== "admin" && !isAdminEmail(user.email)) {
    return jsonMessage(requestId, 403, "Forbidden");
  }

  const id = String(params.id ?? "").trim();
  if (!UUID_PATTERN.test(id)) {
    return jsonMessage(requestId, 400, "잘못된 회원 ID입니다.");
  }

  const { data: member, error } = await getServiceSupabaseClient()
    .from("profiles")
    .select("id,email,role")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    logApiError("admin member withdrawal lookup failed", requestId, error);
    return jsonMessage(requestId, 500, "회원 정보를 불러오지 못했습니다.");
  }
  if (!member) {
    return jsonMessage(requestId, 404, "회원을 찾지 못했습니다.");
  }
  if (member.role === "admin") {
    return jsonMessage(requestId, 403, "관리자 계정은 이 화면에서 탈퇴시킬 수 없습니다.");
  }

  try {
    await withdrawAccount({
      id: String(member.id),
      email: String(member.email),
      reason: "admin_forced_withdrawal"
    });
  } catch (withdrawError) {
    logApiError("admin member withdrawal failed", requestId, withdrawError);
    return jsonMessage(requestId, 500, "회원 탈퇴를 처리하지 못했습니다.");
  }

  revalidatePath("/admin/members");
  revalidatePath("/profile");
  revalidatePath("/");
  revalidatePath("/community");

  return jsonNoStore({
    status: "ok",
    member_id: id,
    withdrawn: true
  });
}
