import { NextResponse } from "next/server";
import { getRequestId, jsonMessage, logApiError, requireSameOriginMutation } from "@/lib/api-auth";
import { getUserFromAuthorization, isAdminEmail } from "@/lib/auth-server";
import { sanitizeOptionalPlainText } from "@/lib/plain-text";
import { getServiceSupabaseClient } from "@/lib/supabase/service";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const jsonNoStore = (body: Record<string, unknown>, status: number = 200): NextResponse => {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "no-store");
  return response;
};

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const requestId = getRequestId(request);
  const sameOriginError = requireSameOriginMutation(request, requestId);
  if (sameOriginError) {
    return sameOriginError;
  }

  const user = await getUserFromAuthorization(request);
  if (!user) {
    return jsonMessage(requestId, 401, "Unauthorized");
  }

  const role = user.role;
  if (role !== "admin" && !isAdminEmail(user.email)) {
    return jsonMessage(requestId, 403, "Forbidden");
  }

  const id = String(params.id ?? "").trim();
  if (!UUID_PATTERN.test(id)) {
    return jsonMessage(requestId, 400, "잘못된 토큰 ID입니다.");
  }

  let body: { decision?: unknown; note?: unknown };
  try {
    body = (await request.json()) as { decision?: unknown; note?: unknown };
  } catch {
    body = {};
  }

  const decision = String(body.decision ?? "").trim().toLowerCase();
  if (decision !== "approve" && decision !== "reject") {
    return jsonMessage(requestId, 400, "decision must be approve or reject");
  }

  let note: string | null = null;
  try {
    note = sanitizeOptionalPlainText(body.note, "note", 200);
  } catch (error) {
    return jsonMessage(requestId, 400, String(error));
  }

  const service = getServiceSupabaseClient();
  const { data, error } = await service
    .from("api_access_tokens")
    .select("id,approval_status,token_hash,revoked_at")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    logApiError("admin token decision lookup failed", requestId, error);
    return jsonMessage(requestId, 500, "토큰 요청을 불러오지 못했습니다.");
  }

  if (!data) {
    return jsonMessage(requestId, 404, "토큰 요청을 찾지 못했습니다.");
  }

  if (data.revoked_at) {
    return jsonMessage(requestId, 409, "이미 취소되거나 폐기된 요청입니다.");
  }

  if (String(data.approval_status) !== "pending") {
    return jsonMessage(requestId, 409, "대기 중인 요청만 처리할 수 있습니다.");
  }

  const nowIso = new Date().toISOString();
  const nextValues =
    decision === "approve"
      ? {
          approval_status: "approved",
          approved_at: nowIso,
          approved_by: user.id,
          rejected_at: null,
          rejected_by: null,
          approval_note: note
        }
      : {
          approval_status: "rejected",
          approved_at: null,
          approved_by: null,
          rejected_at: nowIso,
          rejected_by: user.id,
          approval_note: note,
          token_prefix: null,
          token_hash: null,
          last_used_at: null
        };

  const { error: updateError } = await service.from("api_access_tokens").update(nextValues).eq("id", id);
  if (updateError) {
    logApiError("admin token decision update failed", requestId, updateError);
    return jsonMessage(requestId, 500, "토큰 요청 처리에 실패했습니다.");
  }

  return jsonNoStore({
    status: "ok",
    token_id: id,
    decision
  });
}
