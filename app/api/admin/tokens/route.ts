import { NextResponse } from "next/server";
import { getRequestId, jsonMessage, logApiError } from "@/lib/api-auth";
import { getCompletedProfileForUser, getUserFromAuthorization, isAdminEmail } from "@/lib/auth-server";
import { getServiceSupabaseClient } from "@/lib/supabase/service";

const parseStatus = (value: string | null): "pending" | "approved" | "rejected" | "all" => {
  const normalized = String(value ?? "pending").trim().toLowerCase();
  if (normalized === "approved" || normalized === "rejected" || normalized === "all") {
    return normalized;
  }
  return "pending";
};

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  const user = await getUserFromAuthorization(request);
  if (!user) {
    return jsonMessage(requestId, 401, "Unauthorized");
  }
  const profile = await getCompletedProfileForUser(user);
  if (!profile) {
    return jsonMessage(requestId, 403, "프로필 가입 설정을 먼저 완료해야 합니다.");
  }

  const role = profile.role;
  if (role !== "admin" && !isAdminEmail(user.email)) {
    return jsonMessage(requestId, 403, "Forbidden");
  }

  const status = parseStatus(new URL(request.url).searchParams.get("status"));
  const service = getServiceSupabaseClient();

  let query = service
    .from("api_access_tokens")
    .select(
      "id,user_id,name,token_prefix,scope,approval_status,approval_requested_at,approved_at,approved_by,rejected_at,rejected_by,approval_note,created_at,last_used_at,expires_at,revoked_at"
    )
    .order("approval_requested_at", { ascending: false })
    .limit(300);

  if (status !== "all") {
    query = query.eq("approval_status", status);
  }
  if (status === "pending") {
    query = query.is("revoked_at", null);
  }

  const { data: tokens, error } = await query;
  if (error) {
    logApiError("admin token list lookup failed", requestId, error);
    return jsonMessage(requestId, 500, "토큰 요청 목록을 불러오지 못했습니다.");
  }

  const userIds = [...new Set((tokens ?? []).map((token) => String(token.user_id ?? "")).filter(Boolean))];
  const actorIds = [
    ...new Set(
      (tokens ?? [])
        .flatMap((token) => [token.approved_by, token.rejected_by])
        .map((value) => String(value ?? ""))
        .filter(Boolean)
    )
  ];
  const profileIds = [...new Set([...userIds, ...actorIds])];

  let profileMap = new Map<string, { nickname: string; email: string }>();
  if (profileIds.length > 0) {
    const { data: profiles } = await service.from("profiles").select("id,nickname,email").in("id", profileIds);
    profileMap = new Map(
      (profiles ?? []).map((profile) => [
        String(profile.id),
        {
          nickname: String(profile.nickname ?? ""),
          email: String(profile.email ?? "")
        }
      ])
    );
  }

  const normalized = (tokens ?? []).map((token) => {
    const requester = profileMap.get(String(token.user_id));
    const approvedBy = token.approved_by ? profileMap.get(String(token.approved_by)) : null;
    const rejectedBy = token.rejected_by ? profileMap.get(String(token.rejected_by)) : null;

    return {
      id: String(token.id),
      requester_id: String(token.user_id),
      requester_nickname: requester?.nickname ?? null,
      requester_email: requester?.email ?? null,
      name: String(token.name ?? ""),
      token_prefix: token.token_prefix ? String(token.token_prefix) : null,
      scope: String(token.scope ?? "tradingbot.read"),
      approval_status: String(token.approval_status ?? "pending"),
      approval_requested_at: token.approval_requested_at ? String(token.approval_requested_at) : null,
      approved_at: token.approved_at ? String(token.approved_at) : null,
      approved_by_nickname: approvedBy?.nickname ?? null,
      rejected_at: token.rejected_at ? String(token.rejected_at) : null,
      rejected_by_nickname: rejectedBy?.nickname ?? null,
      approval_note: token.approval_note ? String(token.approval_note) : null,
      created_at: token.created_at ? String(token.created_at) : null,
      last_used_at: token.last_used_at ? String(token.last_used_at) : null,
      expires_at: token.expires_at ? String(token.expires_at) : null,
      revoked_at: token.revoked_at ? String(token.revoked_at) : null,
      token_claimed: Boolean(token.token_prefix)
    };
  });

  return NextResponse.json({
    status: "ok",
    filter: status,
    tokens: normalized
  });
}
