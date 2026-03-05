import { NextResponse } from "next/server";
import { allowRateLimit } from "@/lib/rate-limit";
import { sanitizePlainText } from "@/lib/plain-text";
import {
  checkAccountAge,
  ensureProfileForUser,
  getUserFromAuthorization,
  MIN_ACCOUNT_AGE_MINUTES
} from "@/lib/auth-server";
import { getServiceSupabaseClient } from "@/lib/supabase/service";

export async function POST(request: Request) {
  const user = await getUserFromAuthorization(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!allowRateLimit(`post:${user.id}`, 3)) {
    return NextResponse.json({ error: "Too many posts. Try again in a minute." }, { status: 429 });
  }

  const ageCheck = checkAccountAge(user, MIN_ACCOUNT_AGE_MINUTES);
  if (!ageCheck.ok) {
    return NextResponse.json(
      { error: `Posting is blocked for new users. Try again in ${ageCheck.waitMinutes} minute(s).` },
      { status: 403 }
    );
  }

  let body: { board_slug?: unknown; title?: unknown; content?: unknown };
  try {
    body = (await request.json()) as { board_slug?: unknown; title?: unknown; content?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  let boardSlug: string;
  let title: string;
  let content: string;
  try {
    boardSlug = sanitizePlainText(body.board_slug, "board_slug", 50).toLowerCase();
    title = sanitizePlainText(body.title, "title", 200);
    content = sanitizePlainText(body.content, "content", 5000);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 400 });
  }

  await ensureProfileForUser(user);

  const service = getServiceSupabaseClient();
  const { data: board } = await service.from("boards").select("id,slug").eq("slug", boardSlug).maybeSingle();
  if (!board) {
    return NextResponse.json({ error: "Board not found" }, { status: 404 });
  }

  const { data, error } = await service
    .from("community_posts")
    .insert({
      board_id: board.id,
      author_id: user.id,
      title,
      content
    })
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Insert failed" }, { status: 500 });
  }

  return NextResponse.json({ id: data.id });
}
