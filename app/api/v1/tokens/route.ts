import { NextResponse } from "next/server";
import { getUserFromAuthorization } from "@/lib/auth-server";
import { getRequestId, jsonError, logApiError, requireSameOriginMutation } from "@/lib/api-auth";
import { allowRateLimit } from "@/lib/rate-limit";
import { sanitizeOptionalPlainText, sanitizePlainText } from "@/lib/plain-text";
import { getServiceSupabaseClient } from "@/lib/supabase/service";

const MAX_ACTIVE_TOKENS_PER_USER = 20;
const TOKEN_SELECT =
  "id,name,token_prefix,scope,approval_status,approval_requested_at,approved_at,rejected_at,approval_note,created_at,last_used_at,expires_at,revoked_at";

const jsonNoStore = (body: Record<string, unknown>, status: number = 200): NextResponse => {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "no-store");
  return response;
};

const serializeTokenRow = (row: Record<string, unknown>) => {
  const approvalStatus = String(row.approval_status ?? "pending");
  const tokenPrefix =
    typeof row.token_prefix === "string" && row.token_prefix.trim() ? String(row.token_prefix) : null;
  const revokedAt = row.revoked_at ? String(row.revoked_at) : null;

  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    token_prefix: tokenPrefix,
    scope: String(row.scope ?? "tradingbot.read"),
    approval_status: approvalStatus,
    approval_requested_at: row.approval_requested_at ? String(row.approval_requested_at) : null,
    approved_at: row.approved_at ? String(row.approved_at) : null,
    rejected_at: row.rejected_at ? String(row.rejected_at) : null,
    approval_note: row.approval_note ? String(row.approval_note) : null,
    created_at: row.created_at ? String(row.created_at) : null,
    last_used_at: row.last_used_at ? String(row.last_used_at) : null,
    expires_at: row.expires_at ? String(row.expires_at) : null,
    revoked_at: revokedAt,
    token_claimed: Boolean(tokenPrefix),
    claim_ready: approvalStatus === "approved" && !tokenPrefix && !revokedAt
  };
};

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  const user = await getUserFromAuthorization(request);
  if (!user) {
    return jsonError(requestId, 401, "UNAUTHORIZED", "login required");
  }

  const service = getServiceSupabaseClient();
  const { data, error } = await service
    .from("api_access_tokens")
    .select(TOKEN_SELECT)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    logApiError("token list lookup failed", requestId, error);
    return jsonError(requestId, 504, "UPSTREAM_TIMEOUT", "token list lookup failed");
  }

  return jsonNoStore({
    status: "ok",
    tokens: (data ?? []).map((row) => serializeTokenRow(row as Record<string, unknown>))
  });
}

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  const sameOriginError = requireSameOriginMutation(request, requestId);
  if (sameOriginError) {
    return sameOriginError;
  }

  const user = await getUserFromAuthorization(request);
  if (!user) {
    return jsonError(requestId, 401, "UNAUTHORIZED", "login required");
  }

  if (!allowRateLimit(`token-issue:${user.id}`, 2)) {
    return jsonError(requestId, 429, "RATE_LIMITED", "too many token creations. try again in a minute");
  }

  let body: { name?: unknown };
  try {
    body = (await request.json()) as { name?: unknown };
  } catch {
    body = {};
  }

  let tokenName: string;
  try {
    tokenName =
      sanitizeOptionalPlainText(body.name, "name", 80) ??
      sanitizePlainText(`tradingbot-${new Date().toISOString().slice(0, 10)}`, "name", 80);
  } catch (error) {
    return jsonError(requestId, 400, "INVALID_QUERY", String(error));
  }

  const service = getServiceSupabaseClient();
  const { count, error: countError } = await service
    .from("api_access_tokens")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .is("revoked_at", null)
    .in("approval_status", ["pending", "approved"]);

  if (countError) {
    logApiError("token count lookup failed", requestId, countError);
    return jsonError(requestId, 504, "UPSTREAM_TIMEOUT", "token count lookup failed");
  }

  if ((count ?? 0) >= MAX_ACTIVE_TOKENS_PER_USER) {
    return jsonError(requestId, 429, "RATE_LIMITED", `max active tokens is ${MAX_ACTIVE_TOKENS_PER_USER}`);
  }

  const { data, error } = await service
    .from("api_access_tokens")
    .insert({
      user_id: user.id,
      name: tokenName,
      scope: "tradingbot.read",
      approval_status: "pending",
      approval_requested_at: new Date().toISOString()
    })
    .select(TOKEN_SELECT)
    .single();

  if (error || !data) {
    logApiError("token create failed", requestId, error ?? "failed to create token");
    return jsonError(requestId, 504, "UPSTREAM_TIMEOUT", "token creation failed");
  }

  return jsonNoStore({
    status: "ok",
    token_request: serializeTokenRow(data as Record<string, unknown>),
    note: "token request submitted. admin approval is required before the token can be revealed"
  }, 202);
}
