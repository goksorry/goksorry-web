import { NextResponse } from "next/server";
import { getRequestId, jsonMessage, requireSameOriginMutation } from "@/lib/api-auth";
import { getCompletedProfileForUser, getUserFromAuthorization, isAdminEmail } from "@/lib/auth-server";
import { createChatModerationToken } from "@/lib/chat-token";
import { getChatServerEnv } from "@/lib/env";

async function moderate(request: Request, action: "list" | "delete") {
  const requestId = getRequestId(request);
  if (action === "delete") {
    const sameOriginError = requireSameOriginMutation(request, requestId);
    if (sameOriginError) return sameOriginError;
  }
  const user = await getUserFromAuthorization(request);
  if (!user) return jsonMessage(requestId, 401, "Unauthorized");
  const profile = await getCompletedProfileForUser(user);
  if (!profile || (profile.role !== "admin" && !isAdminEmail(user.email))) return jsonMessage(requestId, 403, "Forbidden");
  const env = getChatServerEnv();
  if (!env.enabled) return jsonMessage(requestId, 503, "채팅이 설정되지 않았습니다.");
  let messageId = "";
  if (action === "delete") {
    const body = await request.json().catch(() => null);
    messageId = String(body?.id ?? "");
    if (!/^[a-zA-Z0-9-]{1,100}$/.test(messageId)) return jsonMessage(requestId, 400, "Invalid message id");
  }
  try {
    const url = new URL(env.CHAT_WS_BASE_URL);
    url.protocol = url.protocol === "wss:" ? "https:" : url.protocol === "ws:" ? "http:" : url.protocol;
    url.pathname = `/admin/messages${messageId ? `/${encodeURIComponent(messageId)}` : ""}`;
    url.search = "";
    url.hash = "";
    const token = await createChatModerationToken(profile.id, action, messageId, env.CHAT_TOKEN_SECRET);
    const response = await fetch(url, {
      method: action === "list" ? "GET" : "DELETE", cache: "no-store", redirect: "error",
      headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(5000)
    });
    if (!response.ok) return jsonMessage(requestId, 502, "채팅 관리 요청에 실패했습니다.");
    return NextResponse.json(await response.json(), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return jsonMessage(requestId, 502, "채팅 서버에 연결하지 못했습니다.");
  }
}

export const GET = (request: Request) => moderate(request, "list");
export const DELETE = (request: Request) => moderate(request, "delete");
