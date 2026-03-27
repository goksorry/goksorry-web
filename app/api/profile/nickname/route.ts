import { NextResponse } from "next/server";
import { getRequestId, jsonMessage, logApiError } from "@/lib/api-auth";
import { getUserFromAuthorization } from "@/lib/auth-server";
import { sanitizePlainText } from "@/lib/plain-text";
import { getServiceSupabaseClient } from "@/lib/supabase/service";

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  const user = await getUserFromAuthorization(request);

  if (!user || !user.email) {
    return jsonMessage(requestId, 401, "Unauthorized");
  }

  const url = new URL(request.url);
  let nickname: string;
  try {
    nickname = sanitizePlainText(url.searchParams.get("nickname"), "nickname", 30);
  } catch (error) {
    return jsonMessage(requestId, 400, String(error));
  }

  const service = getServiceSupabaseClient();
  const { data, error } = await service.rpc("is_nickname_available", {
    candidate: nickname,
    current_user_id: user.id
  });

  if (error) {
    logApiError("nickname availability lookup failed", requestId, error);
    return jsonMessage(requestId, 500, "닉네임 중복확인을 처리하지 못했습니다.");
  }

  return NextResponse.json({
    nickname,
    available: Boolean(data)
  });
}
