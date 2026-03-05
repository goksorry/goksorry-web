import { NextResponse } from "next/server";
import { ensureProfileForUser, getUserFromAuthorization } from "@/lib/auth-server";
import { getRequestId, jsonError } from "@/lib/api-auth";
import { allowRateLimit } from "@/lib/rate-limit";
import { getServiceSupabaseClient } from "@/lib/supabase/service";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const requireSameOrigin = (request: Request, requestId: string): NextResponse | null => {
  const origin = (request.headers.get("origin") ?? "").trim();
  if (!origin) {
    return jsonError(requestId, 403, "FORBIDDEN", "origin header required");
  }

  let expectedOrigin = "";
  try {
    expectedOrigin = new URL(request.url).origin;
  } catch {
    return jsonError(requestId, 400, "INVALID_QUERY", "invalid request url");
  }

  if (origin !== expectedOrigin) {
    return jsonError(requestId, 403, "FORBIDDEN", "cross-origin revoke is blocked");
  }

  const secFetchSite = (request.headers.get("sec-fetch-site") ?? "").toLowerCase();
  if (secFetchSite && secFetchSite !== "same-origin" && secFetchSite !== "same-site" && secFetchSite !== "none") {
    return jsonError(requestId, 403, "FORBIDDEN", "untrusted fetch site");
  }

  return null;
};

const jsonNoStore = (body: Record<string, unknown>, status: number = 200): NextResponse => {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "no-store");
  return response;
};

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const requestId = getRequestId(request);
  const sameOriginError = requireSameOrigin(request, requestId);
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
    return jsonError(requestId, 504, "UPSTREAM_TIMEOUT", error.message);
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
    return jsonError(requestId, 504, "UPSTREAM_TIMEOUT", updateError.message);
  }

  return jsonNoStore({
    status: "ok",
    revoked: true,
    token_id: id
  });
}
