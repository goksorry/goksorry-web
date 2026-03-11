import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getRequestId, jsonMessage, logApiError, requireSameOriginMutation } from "@/lib/api-auth";
import { getUserFromAuthorization, isAdminEmail } from "@/lib/auth-server";
import { sanitizePlainText } from "@/lib/plain-text";
import { withdrawAccount } from "@/lib/profile-sync";
import { getServiceSupabaseClient } from "@/lib/supabase/service";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const TOKEN_SELECT =
  "id,user_id,name,token_prefix,scope,approval_status,approval_requested_at,approved_at,rejected_at,approval_note,created_at,last_used_at,expires_at,revoked_at";

const jsonNoStore = (body: Record<string, unknown>, status: number = 200): NextResponse => {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "no-store");
  return response;
};

const serializeToken = (row: Record<string, unknown>) => ({
  id: String(row.id),
  name: String(row.name ?? ""),
  token_prefix:
    typeof row.token_prefix === "string" && row.token_prefix.trim() ? String(row.token_prefix) : null,
  scope: String(row.scope ?? "tradingbot.read"),
  approval_status: String(row.approval_status ?? "pending"),
  approval_requested_at: row.approval_requested_at ? String(row.approval_requested_at) : null,
  approved_at: row.approved_at ? String(row.approved_at) : null,
  rejected_at: row.rejected_at ? String(row.rejected_at) : null,
  approval_note: row.approval_note ? String(row.approval_note) : null,
  created_at: row.created_at ? String(row.created_at) : null,
  last_used_at: row.last_used_at ? String(row.last_used_at) : null,
  expires_at: row.expires_at ? String(row.expires_at) : null,
  revoked_at: row.revoked_at ? String(row.revoked_at) : null,
  token_claimed: Boolean(row.token_prefix),
  claim_ready: String(row.approval_status ?? "pending") === "approved" && !row.token_prefix && !row.revoked_at
});

const lookupMember = async (id: string) => {
  const service = getServiceSupabaseClient();
  const { data, error } = await service
    .from("profiles")
    .select("id,email,nickname,role,created_at,nickname_confirmed_at,nickname_changed_at")
    .eq("id", id)
    .maybeSingle();

  return {
    service,
    data,
    error
  };
};

const requireAdmin = async (request: Request) => {
  const requestId = getRequestId(request);
  const user = await getUserFromAuthorization(request);
  if (!user) {
    return {
      requestId,
      user: null,
      error: jsonMessage(requestId, 401, "Unauthorized")
    };
  }
  if (user.role !== "admin" && !isAdminEmail(user.email)) {
    return {
      requestId,
      user,
      error: jsonMessage(requestId, 403, "Forbidden")
    };
  }

  return {
    requestId,
    user,
    error: null
  };
};

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(request);
  if (auth.error) {
    return auth.error;
  }

  const id = String(params.id ?? "").trim();
  if (!UUID_PATTERN.test(id)) {
    return jsonMessage(auth.requestId, 400, "잘못된 회원 ID입니다.");
  }

  const { service, data: member, error } = await lookupMember(id);
  if (error) {
    logApiError("admin member detail lookup failed", auth.requestId, error);
    return jsonMessage(auth.requestId, 500, "회원 정보를 불러오지 못했습니다.");
  }
  if (!member) {
    return jsonMessage(auth.requestId, 404, "회원을 찾지 못했습니다.");
  }

  const { data: tokens, error: tokensError } = await service
    .from("api_access_tokens")
    .select(TOKEN_SELECT)
    .eq("user_id", id)
    .order("created_at", { ascending: false });

  if (tokensError) {
    logApiError("admin member detail token lookup failed", auth.requestId, tokensError);
    return jsonMessage(auth.requestId, 500, "회원 토큰 목록을 불러오지 못했습니다.");
  }

  const serializedTokens = (tokens ?? []).map((token) => serializeToken(token as Record<string, unknown>));
  const activeTokenCount = serializedTokens.filter(
    (token) => !token.revoked_at && (token.approval_status === "pending" || token.approval_status === "approved")
  ).length;

  return jsonNoStore({
    status: "ok",
    member: {
      id: String(member.id),
      email: String(member.email ?? ""),
      nickname: String(member.nickname ?? ""),
      role: member.role === "admin" ? "admin" : "user",
      created_at: member.created_at ? String(member.created_at) : null,
      nickname_confirmed_at: member.nickname_confirmed_at ? String(member.nickname_confirmed_at) : null,
      nickname_changed_at: member.nickname_changed_at ? String(member.nickname_changed_at) : null,
      is_current_user: String(member.id) === auth.user?.id,
      active_token_count: activeTokenCount,
      total_token_count: serializedTokens.length,
      tokens: serializedTokens
    }
  });
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(request);
  if (auth.error) {
    return auth.error;
  }

  const sameOriginError = requireSameOriginMutation(request, auth.requestId);
  if (sameOriginError) {
    return sameOriginError;
  }

  const id = String(params.id ?? "").trim();
  if (!UUID_PATTERN.test(id)) {
    return jsonMessage(auth.requestId, 400, "잘못된 회원 ID입니다.");
  }

  let body: { nickname?: unknown };
  try {
    body = (await request.json()) as { nickname?: unknown };
  } catch {
    return jsonMessage(auth.requestId, 400, "Invalid JSON body");
  }

  let nickname: string;
  try {
    nickname = sanitizePlainText(body.nickname, "nickname", 30);
  } catch (error) {
    return jsonMessage(auth.requestId, 400, String(error));
  }

  const { service, data: member, error } = await lookupMember(id);
  if (error) {
    logApiError("admin member nickname lookup failed", auth.requestId, error);
    return jsonMessage(auth.requestId, 500, "회원 정보를 불러오지 못했습니다.");
  }
  if (!member) {
    return jsonMessage(auth.requestId, 404, "회원을 찾지 못했습니다.");
  }
  if (member.role === "admin") {
    return jsonMessage(auth.requestId, 403, "관리자 계정은 이 화면에서 강제 변경할 수 없습니다.");
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
      return jsonMessage(auth.requestId, 409, "이미 사용 중인 닉네임입니다.");
    }
    logApiError("admin member nickname update failed", auth.requestId, updateError);
    return jsonMessage(auth.requestId, 500, "닉네임을 변경하지 못했습니다.");
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
  const auth = await requireAdmin(request);
  if (auth.error) {
    return auth.error;
  }

  const sameOriginError = requireSameOriginMutation(request, auth.requestId);
  if (sameOriginError) {
    return sameOriginError;
  }

  const id = String(params.id ?? "").trim();
  if (!UUID_PATTERN.test(id)) {
    return jsonMessage(auth.requestId, 400, "잘못된 회원 ID입니다.");
  }

  const { data: member, error } = await getServiceSupabaseClient()
    .from("profiles")
    .select("id,email,role")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    logApiError("admin member withdrawal lookup failed", auth.requestId, error);
    return jsonMessage(auth.requestId, 500, "회원 정보를 불러오지 못했습니다.");
  }
  if (!member) {
    return jsonMessage(auth.requestId, 404, "회원을 찾지 못했습니다.");
  }
  if (member.role === "admin") {
    return jsonMessage(auth.requestId, 403, "관리자 계정은 이 화면에서 탈퇴시킬 수 없습니다.");
  }

  try {
    await withdrawAccount({
      id: String(member.id),
      email: String(member.email),
      reason: "admin_forced_withdrawal"
    });
  } catch (withdrawError) {
    logApiError("admin member withdrawal failed", auth.requestId, withdrawError);
    return jsonMessage(auth.requestId, 500, "회원 탈퇴를 처리하지 못했습니다.");
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
