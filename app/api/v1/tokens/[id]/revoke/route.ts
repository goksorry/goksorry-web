import { NextResponse } from "next/server";
import { ensureProfileForUser, getUserFromAuthorization } from "@/lib/auth-server";
import { getRequestId, jsonError } from "@/lib/api-auth";
import { getServiceSupabaseClient } from "@/lib/supabase/service";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const requestId = getRequestId(request);
  const user = await getUserFromAuthorization(request);
  if (!user) {
    return jsonError(requestId, 401, "UNAUTHORIZED", "login required");
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
    return NextResponse.json({
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

  return NextResponse.json({
    status: "ok",
    revoked: true,
    token_id: id
  });
}
