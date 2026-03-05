import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import { hashApiToken } from "@/lib/api-tokens";
import { getServerEnv } from "@/lib/env";
import { getServiceSupabaseClient } from "@/lib/supabase/service";

export type ApiErrorCode =
  | "INVALID_QUERY"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "RATE_LIMITED"
  | "DETECTOR_DEGRADED"
  | "UPSTREAM_TIMEOUT"
  | "NOT_FOUND";

export const jsonError = (
  requestId: string,
  status: number,
  code: ApiErrorCode,
  message: string
) => {
  return NextResponse.json(
    {
      status: "error",
      code,
      message,
      request_id: requestId
    },
    { status }
  );
};

const parseBearer = (request: Request): string | null => {
  const authHeader = request.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return null;
  }
  const token = authHeader.slice(7).trim();
  return token || null;
};

export const getRequestId = (request: Request): string => {
  const header = request.headers.get("x-request-id");
  if (header && header.trim()) {
    return header.trim();
  }
  return randomUUID();
};

export const requireDetectorWriteAuth = (
  request: Request
): { ok: true; requestId: string } | { ok: false; response: NextResponse } => {
  const requestId = getRequestId(request);
  const token = parseBearer(request);
  const env = getServerEnv();
  if (!token || token !== env.DETECTOR_WRITE_TOKEN) {
    return {
      ok: false,
      response: jsonError(requestId, 401, "UNAUTHORIZED", "invalid detector token")
    };
  }

  return { ok: true, requestId };
};

export const requireTradingBotReadAuth = async (
  request: Request
): Promise<
  | { ok: true; requestId: string; clientId: string; tokenId: string; tokenOwnerUserId: string }
  | { ok: false; response: NextResponse }
> => {
  const requestId = getRequestId(request);
  const token = parseBearer(request);

  if (!token) {
    return {
      ok: false,
      response: jsonError(requestId, 401, "UNAUTHORIZED", "missing trading bot token")
    };
  }

  const clientId = (request.headers.get("x-client-id") ?? "").trim();
  if (!clientId.startsWith("trading-bot-")) {
    return {
      ok: false,
      response: jsonError(requestId, 403, "FORBIDDEN", "x-client-id must start with trading-bot-")
    };
  }

  if (!request.headers.get("x-request-id")) {
    return {
      ok: false,
      response: jsonError(requestId, 400, "INVALID_QUERY", "x-request-id is required")
    };
  }

  const tokenHash = hashApiToken(token);
  const service = getServiceSupabaseClient();
  const { data, error } = await service
    .from("api_access_tokens")
    .select("id,user_id,scope,revoked_at,expires_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      response: jsonError(requestId, 504, "UPSTREAM_TIMEOUT", error.message)
    };
  }

  if (!data) {
    return {
      ok: false,
      response: jsonError(requestId, 401, "UNAUTHORIZED", "invalid trading bot token")
    };
  }

  if (data.revoked_at) {
    return {
      ok: false,
      response: jsonError(requestId, 403, "FORBIDDEN", "token revoked")
    };
  }

  if (data.expires_at) {
    const expiresAtMs = new Date(String(data.expires_at)).getTime();
    if (!Number.isNaN(expiresAtMs) && Date.now() >= expiresAtMs) {
      return {
        ok: false,
        response: jsonError(requestId, 403, "FORBIDDEN", "token expired")
      };
    }
  }

  if (String(data.scope) !== "tradingbot.read") {
    return {
      ok: false,
      response: jsonError(requestId, 403, "FORBIDDEN", "token scope forbidden")
    };
  }

  await service
    .from("api_access_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id)
    .then(() => undefined)
    .catch(() => undefined);

  return {
    ok: true,
    requestId,
    clientId,
    tokenId: String(data.id),
    tokenOwnerUserId: String(data.user_id)
  };
};
