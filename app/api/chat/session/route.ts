import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getRequestId, jsonMessage, requireSameOriginMutation } from "@/lib/api-auth";
import { authOptions } from "@/lib/auth";
import {
  buildGuestChatDisplayName,
  createChatSessionToken,
  createGuestChatCookie,
  readGuestChatCookie
} from "@/lib/chat-token";
import { normalizeGuestChatNickname } from "@/lib/chat-guest-nickname";
import { CHAT_DEFAULT_FILTER, CHAT_GUEST_NICKNAME_MAX_LENGTH, type ChatSessionViewer } from "@/lib/chat-types";
import { getChatServerEnv } from "@/lib/env";
import { CLIENT_PERSISTENCE_DEFINITIONS, SERVER_COOKIE_DEFINITIONS } from "@/lib/persistence-registry";

type SessionViewer = ChatSessionViewer & {
  id: string;
};

const createWsUrl = (baseUrl: string, token: string): string => {
  const separator = baseUrl.includes("?") ? "&" : "?";
  return `${baseUrl}${separator}token=${encodeURIComponent(token)}`;
};

const safeDecodeCookieValue = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return "";
  }
};

const readCookieValue = (cookieHeader: string, name: string): string => {
  const cookieMatch = cookieHeader.match(new RegExp(`(?:^|; )${name}=([^;]+)`));
  return cookieMatch?.[1] ? safeDecodeCookieValue(cookieMatch[1]) : "";
};

const readRequestBody = async (request: Request): Promise<{ guest_nickname?: unknown }> => {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return {};
  }

  return (await request.json().catch(() => ({}))) as { guest_nickname?: unknown };
};

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  const sameOriginError = requireSameOriginMutation(request, requestId);
  if (sameOriginError) {
    return sameOriginError;
  }

  const chatEnv = getChatServerEnv();
  if (!chatEnv.enabled) {
    return jsonMessage(requestId, 503, "채팅 설정이 아직 배포되지 않았습니다.");
  }

  const session = await getServerSession(authOptions);
  const memberId = String(session?.user?.id ?? "").trim();
  const memberNickname = String(session?.user?.nickname ?? "").trim();
  const profileSetupRequired = Boolean(session?.user?.profile_setup_required);
  let viewer: SessionViewer;
  let guestCookie: { value: string; expiresAt: string } | null = null;
  let guestNicknameCookieValue: string | null = null;

  if (memberId) {
    if (profileSetupRequired) {
      return jsonMessage(requestId, 403, "채팅에 참여하려면 먼저 가입 설정을 완료해야 합니다.");
    }
    if (!memberNickname) {
      return jsonMessage(requestId, 403, "채팅에 참여하려면 먼저 닉네임 설정을 완료해야 합니다.");
    }

    viewer = {
      id: memberId,
      kind: "member",
      display_name: memberNickname,
      can_filter_guests: true,
      can_send: true,
      default_filter: CHAT_DEFAULT_FILTER
    };
  } else {
    const cookieHeader = request.headers.get("cookie") ?? "";
    const body = await readRequestBody(request);
    const bodyGuestNickname = normalizeGuestChatNickname(body.guest_nickname);
    if (typeof body.guest_nickname === "string" && body.guest_nickname.trim() && !bodyGuestNickname) {
      return jsonMessage(requestId, 400, `비회원 닉네임은 ${CHAT_GUEST_NICKNAME_MAX_LENGTH}자 이하의 평문만 사용할 수 있습니다.`);
    }

    const cookieGuestNickname = normalizeGuestChatNickname(
      readCookieValue(cookieHeader, CLIENT_PERSISTENCE_DEFINITIONS.guestChatNickname.key)
    );
    const requestedDisplayName = bodyGuestNickname ?? cookieGuestNickname;
    guestNicknameCookieValue = requestedDisplayName;

    const cookieValue = readCookieValue(cookieHeader, SERVER_COOKIE_DEFINITIONS.guestChat.key);
    const guestIdentity = await readGuestChatCookie(cookieValue, chatEnv.CHAT_TOKEN_SECRET);

    if (guestIdentity) {
      viewer = {
        id: guestIdentity.guestId,
        kind: "guest",
        display_name: requestedDisplayName ?? guestIdentity.displayName,
        can_filter_guests: false,
        can_send: true,
        default_filter: CHAT_DEFAULT_FILTER
      };
    } else {
      const nextGuestCookie = await createGuestChatCookie(chatEnv.CHAT_TOKEN_SECRET);
      guestCookie = {
        value: nextGuestCookie.value,
        expiresAt: nextGuestCookie.expiresAt
      };

      viewer = {
        id: nextGuestCookie.guestId,
        kind: "guest",
        display_name: requestedDisplayName ?? buildGuestChatDisplayName(nextGuestCookie.guestId),
        can_filter_guests: false,
        can_send: true,
        default_filter: CHAT_DEFAULT_FILTER
      };
    }
  }

  const sessionToken = await createChatSessionToken(
    {
      subject: viewer.id,
      kind: viewer.kind,
      displayName: viewer.display_name,
      canFilterGuests: viewer.can_filter_guests,
      canSend: viewer.can_send
    },
    chatEnv.CHAT_TOKEN_SECRET
  );

  const response = NextResponse.json({
    ws_url: createWsUrl(chatEnv.CHAT_WS_BASE_URL, sessionToken.token),
    viewer: {
      kind: viewer.kind,
      display_name: viewer.display_name,
      can_filter_guests: viewer.can_filter_guests,
      can_send: viewer.can_send,
      default_filter: viewer.default_filter
    },
    expires_at: sessionToken.expiresAt
  });

  if (guestCookie) {
    response.cookies.set({
      name: SERVER_COOKIE_DEFINITIONS.guestChat.key,
      value: guestCookie.value,
      httpOnly: SERVER_COOKIE_DEFINITIONS.guestChat.httpOnly,
      sameSite: SERVER_COOKIE_DEFINITIONS.guestChat.sameSite.toLowerCase() as "lax",
      secure: process.env.NODE_ENV === "production",
      path: SERVER_COOKIE_DEFINITIONS.guestChat.path,
      expires: new Date(guestCookie.expiresAt)
    });
  }

  if (guestNicknameCookieValue) {
    response.cookies.set({
      name: CLIENT_PERSISTENCE_DEFINITIONS.guestChatNickname.key,
      value: guestNicknameCookieValue,
      httpOnly: false,
      sameSite: CLIENT_PERSISTENCE_DEFINITIONS.guestChatNickname.sameSite.toLowerCase() as "lax",
      secure: process.env.NODE_ENV === "production",
      path: CLIENT_PERSISTENCE_DEFINITIONS.guestChatNickname.path,
      maxAge: CLIENT_PERSISTENCE_DEFINITIONS.guestChatNickname.maxAgeSeconds
    });
  }

  return response;
}
