import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { ensureProfileForUser, getUserFromAuthorization } from "@/lib/auth-server";
import { sanitizePlainText } from "@/lib/plain-text";
import { getNicknamePolicy } from "@/lib/profile-sync";
import { getServiceSupabaseClient } from "@/lib/supabase/service";

export async function PATCH(request: Request) {
  const user = await getUserFromAuthorization(request);
  if (!user || !user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensureProfileForUser(user);

  let body: { nickname?: unknown };
  try {
    body = (await request.json()) as { nickname?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  let nickname: string;
  try {
    nickname = sanitizePlainText(body.nickname, "nickname", 30);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 400 });
  }

  const service = getServiceSupabaseClient();
  const { data: profile, error: profileError } = await service
    .from("profiles")
    .select("id,nickname,role,nickname_confirmed_at,nickname_changed_at")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return NextResponse.json({ error: profileError?.message ?? "Profile not found" }, { status: 404 });
  }

  const nextRole = profile.role === "admin" ? "admin" : "user";
  const nicknamePolicy = getNicknamePolicy({
    role: nextRole,
    nickname_confirmed_at: profile.nickname_confirmed_at ? String(profile.nickname_confirmed_at) : null,
    nickname_changed_at: profile.nickname_changed_at ? String(profile.nickname_changed_at) : null
  });

  const currentNickname = String(profile.nickname ?? "").trim();
  const changed = currentNickname.localeCompare(nickname, undefined, { sensitivity: "accent" }) !== 0;

  if (changed && !nicknamePolicy.can_change) {
    return NextResponse.json(
      { error: "닉네임은 7일에 한 번만 변경할 수 있습니다. 관리자만 제한 없이 변경할 수 있습니다." },
      { status: 403 }
    );
  }

  const nowIso = new Date().toISOString();
  const updates = {
    nickname,
    nickname_confirmed_at: profile.nickname_confirmed_at ?? nowIso,
    nickname_changed_at: changed || !profile.nickname_changed_at ? nowIso : profile.nickname_changed_at
  };

  const { error: updateError } = await service.from("profiles").update(updates).eq("id", user.id);

  if (updateError) {
    if (updateError.code === "23505") {
      return NextResponse.json({ error: "이미 사용 중인 닉네임입니다." }, { status: 409 });
    }
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  revalidatePath("/profile");
  revalidatePath("/");
  revalidatePath("/community");

  return NextResponse.json({
    ok: true,
    nickname,
    nickname_needs_setup: false
  });
}
