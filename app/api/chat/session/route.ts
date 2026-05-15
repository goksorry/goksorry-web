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
import { CHAT_DEFAULT_FILTER, type ChatSessionViewer } from "@/lib/chat-types";
import { getChatServerEnv } from "@/lib/env";
import { SERVER_COOKIE_DEFINITIONS } from "@/lib/persistence-registry";

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
    const cookieMatch = cookieHeader.match(new RegExp(`(?:^|; )${SERVER_COOKIE_DEFINITIONS.guestChat.key}=([^;]+)`));
    const cookieValue = cookieMatch?.[1] ? safeDecodeCookieValue(cookieMatch[1]) : "";
    const guestIdentity = await readGuestChatCookie(cookieValue, chatEnv.CHAT_TOKEN_SECRET);

    if (guestIdentity) {
      viewer = {
        id: guestIdentity.guestId,
        kind: "guest",
        display_name: guestIdentity.displayName,
        can_filter_guests: false,
        can_send: false,
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
        display_name: buildGuestChatDisplayName(nextGuestCookie.guestId),
        can_filter_guests: false,
        can_send: false,
        default_filter: CHAT_DEFAULT_FILTER
      };
    }
  }

  const sessionToken = await createChatSessionToken(
    {
      subject: viewer.id,
      kind: viewer.kind,
      displayName: viewer.display_name,
      canFilterGuests: viewer.can_filter_guests
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

  return response;
}
