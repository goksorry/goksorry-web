import { NextResponse } from "next/server";
import { getRequestId, jsonMessage, logApiError } from "@/lib/api-auth";
import { ensureProfileForUser, getUserFromAuthorization, isAdminEmail } from "@/lib/auth-server";
import { getServiceSupabaseClient } from "@/lib/supabase/service";

const maskEmail = (value: string | null): string | null => {
  if (!value) {
    return null;
  }

  const normalized = value.trim();
  const atIndex = normalized.indexOf("@");
  if (atIndex <= 0 || atIndex === normalized.length - 1) {
    return null;
  }

  const local = normalized.slice(0, atIndex);
  const domain = normalized.slice(atIndex + 1);
  const visibleLocal = local.slice(0, Math.min(2, local.length));
  const visibleDomain = domain.slice(0, Math.min(2, domain.length));
  return `${visibleLocal}${"*".repeat(Math.max(1, local.length - visibleLocal.length))}@${visibleDomain}${"*".repeat(
    Math.max(1, domain.length - visibleDomain.length)
  )}`;
};

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  const user = await getUserFromAuthorization(request);
  if (!user) {
    return jsonMessage(requestId, 401, "Unauthorized");
  }

  const role = await ensureProfileForUser(user);
  if (role !== "admin" && !isAdminEmail(user.email)) {
    return jsonMessage(requestId, 403, "Forbidden");
  }

  const service = getServiceSupabaseClient();
  const { data: reports, error } = await service
    .from("reports")
    .select("id,reporter_id,target_type,target_id,reason,status,created_at")
    .order("created_at", { ascending: false })
    .limit(300);

  if (error) {
    logApiError("admin reports lookup failed", requestId, error);
    return jsonMessage(requestId, 500, "신고 목록을 불러오지 못했습니다.");
  }

  const reporterIds = [...new Set((reports ?? []).map((report) => report.reporter_id).filter(Boolean))];
  let profileMap = new Map<string, { nickname: string; email: string }>();

  if (reporterIds.length > 0) {
    const { data: profiles } = await service
      .from("profiles")
      .select("id,nickname,email")
      .in("id", reporterIds);

    profileMap = new Map(
      (profiles ?? []).map((profile) => [
        String(profile.id),
        {
          nickname: String(profile.nickname ?? ""),
          email: String(profile.email ?? "")
        }
      ])
    );
  }

  const normalized = (reports ?? []).map((report) => {
    const profile = profileMap.get(String(report.reporter_id));
    return {
      id: report.id,
      target_type: report.target_type,
      target_id: report.target_id,
      reason: report.reason,
      status: report.status,
      created_at: report.created_at,
      reporter_id: report.reporter_id,
      reporter_nickname: profile?.nickname ?? null,
      reporter_email: maskEmail(profile?.email ?? null)
    };
  });

  return NextResponse.json({ reports: normalized });
}
