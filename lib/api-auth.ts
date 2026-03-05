import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import { getServerEnv } from "@/lib/env";

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

const requestIdFrom = (request: Request): string => {
  const header = request.headers.get("x-request-id");
  if (header && header.trim()) {
    return header.trim();
  }
  return randomUUID();
};

export const requireDetectorWriteAuth = (
  request: Request
): { ok: true; requestId: string } | { ok: false; response: NextResponse } => {
  const requestId = requestIdFrom(request);
  const token = parseBearer(request);
  const env = getServerEnv();
  if (!token || token !== env.INGEST_TOKEN) {
    return {
      ok: false,
      response: jsonError(requestId, 401, "UNAUTHORIZED", "invalid detector token")
    };
  }

  return { ok: true, requestId };
};

export const requireTradingBotReadAuth = (
  request: Request
):
  | { ok: true; requestId: string; clientId: string }
  | { ok: false; response: NextResponse } => {
  const requestId = requestIdFrom(request);
  const token = parseBearer(request);
  const env = getServerEnv();
  const expectedToken = env.TRADINGBOT_API_TOKEN || env.INGEST_TOKEN;

  if (!token || token !== expectedToken) {
    return {
      ok: false,
      response: jsonError(requestId, 401, "UNAUTHORIZED", "invalid trading bot token")
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

  return {
    ok: true,
    requestId,
    clientId
  };
};
