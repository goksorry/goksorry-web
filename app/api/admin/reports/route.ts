import { NextResponse } from "next/server";
import { ensureProfileForUser, getUserFromAuthorization, isAdminEmail } from "@/lib/auth-server";
import { getServiceSupabaseClient } from "@/lib/supabase/service";

export async function GET(request: Request) {
  const user = await getUserFromAuthorization(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = await ensureProfileForUser(user);
  if (role !== "admin" && !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const service = getServiceSupabaseClient();
  const { data: reports, error } = await service
    .from("reports")
    .select("id,reporter_id,target_type,target_id,reason,status,created_at")
    .order("created_at", { ascending: false })
    .limit(300);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
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
      reporter_email: profile?.email ?? null
    };
  });

  return NextResponse.json({ reports: normalized });
}
