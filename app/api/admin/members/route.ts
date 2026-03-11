import { NextResponse } from "next/server";
import { getRequestId, jsonMessage, logApiError } from "@/lib/api-auth";
import { getUserFromAuthorization, isAdminEmail } from "@/lib/auth-server";
import { getServiceSupabaseClient } from "@/lib/supabase/service";

const MEMBER_SELECT = "id,email,nickname,role,created_at,nickname_confirmed_at,nickname_changed_at";
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

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  const user = await getUserFromAuthorization(request);
  if (!user) {
    return jsonMessage(requestId, 401, "Unauthorized");
  }

  if (user.role !== "admin" && !isAdminEmail(user.email)) {
    return jsonMessage(requestId, 403, "Forbidden");
  }

  const service = getServiceSupabaseClient();
  const { data: members, error: membersError } = await service
    .from("profiles")
    .select(MEMBER_SELECT)
    .order("created_at", { ascending: false })
    .limit(300);

  if (membersError) {
    logApiError("admin member list lookup failed", requestId, membersError);
    return jsonMessage(requestId, 500, "회원 목록을 불러오지 못했습니다.");
  }

  const memberIds = [...new Set((members ?? []).map((member) => String(member.id ?? "")).filter(Boolean))];
  const tokensByUserId = new Map<string, Array<Record<string, unknown>>>();

  if (memberIds.length > 0) {
    const { data: tokens, error: tokensError } = await service
      .from("api_access_tokens")
      .select(TOKEN_SELECT)
      .in("user_id", memberIds)
      .order("created_at", { ascending: false });

    if (tokensError) {
      logApiError("admin member token lookup failed", requestId, tokensError);
      return jsonMessage(requestId, 500, "회원 토큰 목록을 불러오지 못했습니다.");
    }

    for (const token of tokens ?? []) {
      const memberId = String(token.user_id ?? "");
      const bucket = tokensByUserId.get(memberId) ?? [];
      bucket.push(token as Record<string, unknown>);
      tokensByUserId.set(memberId, bucket);
    }
  }

  const normalized = (members ?? []).map((member) => {
    const memberId = String(member.id);
    const memberTokens = (tokensByUserId.get(memberId) ?? []).map((token) => serializeToken(token));
    const activeTokenCount = memberTokens.filter(
      (token) =>
        !token.revoked_at && (token.approval_status === "pending" || token.approval_status === "approved")
    ).length;

    return {
      id: memberId,
      email: String(member.email ?? ""),
      nickname: String(member.nickname ?? ""),
      role: member.role === "admin" ? "admin" : "user",
      created_at: member.created_at ? String(member.created_at) : null,
      nickname_confirmed_at: member.nickname_confirmed_at ? String(member.nickname_confirmed_at) : null,
      nickname_changed_at: member.nickname_changed_at ? String(member.nickname_changed_at) : null,
      is_current_user: memberId === user.id,
      active_token_count: activeTokenCount,
      total_token_count: memberTokens.length,
      tokens: memberTokens
    };
  });

  return jsonNoStore({
    status: "ok",
    members: normalized
  });
}
