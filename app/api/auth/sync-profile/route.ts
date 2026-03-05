import { NextResponse } from "next/server";
import { ensureProfileForUser, getUserFromAuthorization } from "@/lib/auth-server";

export async function POST(request: Request) {
  const user = await getUserFromAuthorization(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = await ensureProfileForUser(user);
  return NextResponse.json({ ok: true, role });
}
