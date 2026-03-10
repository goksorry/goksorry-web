import { NextResponse } from "next/server";
import { ensureProfileForUser, getUserFromAuthorization } from "@/lib/auth-server";
import { getRequestId, jsonError, logApiError, requireSameOriginMutation } from "@/lib/api-auth";
import { allowRateLimit } from "@/lib/rate-limit";
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
    return jsonError(requestId, 401, "UNAUTHORIZED", "login required");
  }

  if (!allowRateLimit(`token-revoke:${user.id}`, 20)) {
    return jsonError(requestId, 429, "RATE_LIMITED", "too many token revokes. try again in a minute");
  }

  await ensureProfileForUser(user);

  const id = String(params.id ?? "").trim();
  if (!UUID_PATTERN.test(id)) {
    return jsonError(requestId, 400, "INVALID_QUERY", "invalid token id");
  }

  const service = getServiceSupabaseClient();
  const { data, error } = await service
    .from("api_access_tokens")
    .select("id,revoked_at")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    logApiError("token revoke lookup failed", requestId, error);
    return jsonError(requestId, 504, "UPSTREAM_TIMEOUT", "token lookup failed");
  }

  if (!data) {
    return jsonError(requestId, 404, "NOT_FOUND", "token not found");
  }

  if (data.revoked_at) {
    return jsonNoStore({
      status: "ok",
      already_revoked: true,
      token_id: id
    });
  }

  const { error: updateError } = await service
    .from("api_access_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);

  if (updateError) {
    logApiError("token revoke update failed", requestId, updateError);
    return jsonError(requestId, 504, "UPSTREAM_TIMEOUT", "token revoke failed");
  }

  return jsonNoStore({
    status: "ok",
    revoked: true,
    token_id: id
  });
}
