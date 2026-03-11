import { NextResponse } from "next/server";
import { getUserFromAuthorization } from "@/lib/auth-server";
import { getRequestId, jsonError, logApiError, requireSameOriginMutation } from "@/lib/api-auth";
import { generateTradingBotApiToken } from "@/lib/api-tokens";
import { allowRateLimit } from "@/lib/rate-limit";
import { getServiceSupabaseClient } from "@/lib/supabase/service";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const jsonNoStore = (body: Record<string, unknown>, status: number = 200): NextResponse => {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "no-store");
  return response;
};

const oneYearFromNowIso = (): string => {
  const expiresAt = new Date();
  expiresAt.setFullYear(expiresAt.getFullYear() + 1);
  return expiresAt.toISOString();
};

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const requestId = getRequestId(request);
  const sameOriginError = requireSameOriginMutation(request, requestId);
  if (sameOriginError) {
    return sameOriginError;
  }

  const user = await getUserFromAuthorization(request);
  if (!user) {
    return jsonError(requestId, 401, "UNAUTHORIZED", "login required");
  }

  if (!allowRateLimit(`token-claim:${user.id}`, 10)) {
    return jsonError(requestId, 429, "RATE_LIMITED", "too many token claims. try again in a minute");
  }

  const id = String(params.id ?? "").trim();
  if (!UUID_PATTERN.test(id)) {
    return jsonError(requestId, 400, "INVALID_QUERY", "invalid token id");
  }

  const service = getServiceSupabaseClient();
  const { data, error } = await service
    .from("api_access_tokens")
    .select("id,name,token_prefix,token_hash,scope,approval_status,approved_at,revoked_at")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    logApiError("token claim lookup failed", requestId, error);
    return jsonError(requestId, 504, "UPSTREAM_TIMEOUT", "token lookup failed");
  }

  if (!data) {
    return jsonError(requestId, 404, "NOT_FOUND", "token not found");
  }

  if (data.revoked_at) {
    return jsonError(requestId, 403, "FORBIDDEN", "token revoked");
  }

  if (String(data.approval_status) !== "approved") {
    return jsonError(requestId, 403, "FORBIDDEN", "token pending admin approval");
  }

  if (data.token_hash) {
    return jsonError(requestId, 409, "FORBIDDEN", "token value is already claimed");
  }

  const generated = generateTradingBotApiToken();
  const expiresAt = oneYearFromNowIso();
  const { error: updateError } = await service
    .from("api_access_tokens")
    .update({
      token_prefix: generated.tokenPrefix,
      token_hash: generated.tokenHash,
      expires_at: expiresAt
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .is("token_hash", null)
    .eq("approval_status", "approved");

  if (updateError) {
    logApiError("token claim update failed", requestId, updateError);
    return jsonError(requestId, 504, "UPSTREAM_TIMEOUT", "token claim failed");
  }

  return jsonNoStore({
    status: "ok",
    token: {
      id: String(data.id),
      name: String(data.name ?? ""),
      token_prefix: generated.tokenPrefix,
      scope: String(data.scope ?? "tradingbot.read"),
      approved_at: data.approved_at ? String(data.approved_at) : null,
      expires_at: expiresAt,
      value: generated.rawToken
    },
    note: "token value is shown only once"
  });
}
