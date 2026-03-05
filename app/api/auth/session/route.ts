import { NextResponse } from "next/server";
import { ensureProfileForUser, getUserFromAccessToken, SESSION_COOKIE_NAME } from "@/lib/auth-server";

const parseBearer = (request: Request): string | null => {
  const authHeader = request.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return null;
  }
  const token = authHeader.slice(7).trim();
  return token || null;
};

const requireSameOrigin = (request: Request): boolean => {
  const origin = (request.headers.get("origin") ?? "").trim();
  if (!origin) {
    return false;
  }

  try {
    return origin === new URL(request.url).origin;
  } catch {
    return false;
  }
};

export async function POST(request: Request) {
  if (!requireSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const accessToken = parseBearer(request);
  if (!accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await getUserFromAccessToken(accessToken);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensureProfileForUser(user);

  const response = NextResponse.json({ ok: true, user_id: user.id });
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: encodeURIComponent(accessToken),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
