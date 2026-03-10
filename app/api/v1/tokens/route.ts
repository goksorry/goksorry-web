import { NextResponse } from "next/server";
import { ensureProfileForUser, getUserFromAuthorization } from "@/lib/auth-server";
import { generateTradingBotApiToken } from "@/lib/api-tokens";
import { getRequestId, jsonError, logApiError, requireSameOriginMutation } from "@/lib/api-auth";
import { allowRateLimit } from "@/lib/rate-limit";
import { sanitizeOptionalPlainText, sanitizePlainText } from "@/lib/plain-text";
import { getServiceSupabaseClient } from "@/lib/supabase/service";

const MAX_ACTIVE_TOKENS_PER_USER = 20;

const jsonNoStore = (body: Record<string, unknown>, status: number = 200): NextResponse => {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "no-store");
  return response;
};

const asIsoOrNull = (value: unknown): string | null => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
};

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  const user = await getUserFromAuthorization(request);
  if (!user) {
    return jsonError(requestId, 401, "UNAUTHORIZED", "login required");
  }

  await ensureProfileForUser(user);

  const service = getServiceSupabaseClient();
  const { data, error } = await service
    .from("api_access_tokens")
    .select("id,name,token_prefix,scope,created_at,last_used_at,expires_at,revoked_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    logApiError("token list lookup failed", requestId, error);
    return jsonError(requestId, 504, "UPSTREAM_TIMEOUT", "token list lookup failed");
  }

  return jsonNoStore({
    status: "ok",
    tokens: data ?? []
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

  await ensureProfileForUser(user);

  let body: { name?: unknown; expires_at?: unknown };
  try {
    body = (await request.json()) as { name?: unknown; expires_at?: unknown };
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

  const expiresAt = asIsoOrNull(body.expires_at);
  if (body.expires_at !== undefined && body.expires_at !== null && body.expires_at !== "" && !expiresAt) {
    return jsonError(requestId, 400, "INVALID_QUERY", "expires_at must be ISO8601 or null");
  }

  if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) {
    return jsonError(requestId, 400, "INVALID_QUERY", "expires_at must be in the future");
  }

  const service = getServiceSupabaseClient();
  const { count, error: countError } = await service
    .from("api_access_tokens")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .is("revoked_at", null);

  if (countError) {
    logApiError("token count lookup failed", requestId, countError);
    return jsonError(requestId, 504, "UPSTREAM_TIMEOUT", "token count lookup failed");
  }

  if ((count ?? 0) >= MAX_ACTIVE_TOKENS_PER_USER) {
    return jsonError(requestId, 429, "RATE_LIMITED", `max active tokens is ${MAX_ACTIVE_TOKENS_PER_USER}`);
  }

  const generated = generateTradingBotApiToken();

  const { data, error } = await service
    .from("api_access_tokens")
    .insert({
      user_id: user.id,
      name: tokenName,
      token_prefix: generated.tokenPrefix,
      token_hash: generated.tokenHash,
      scope: "tradingbot.read",
      expires_at: expiresAt
    })
    .select("id,name,token_prefix,scope,created_at,expires_at")
    .single();

  if (error || !data) {
    logApiError("token create failed", requestId, error ?? "failed to create token");
    return jsonError(requestId, 504, "UPSTREAM_TIMEOUT", "token creation failed");
  }

  return jsonNoStore({
    status: "ok",
    token: {
      id: data.id,
      name: data.name,
      token_prefix: data.token_prefix,
      scope: data.scope,
      created_at: data.created_at,
      expires_at: data.expires_at,
      value: generated.rawToken
    },
    note: "token value is shown only once"
  });
}
