import { NextResponse } from "next/server";
import { ensureProfileForUser, getUserFromAuthorization } from "@/lib/auth-server";

export async function GET(request: Request) {
  const user = await getUserFromAuthorization(request);
  if (!user) {
    const response = NextResponse.json({ authenticated: false });
    response.headers.set("Cache-Control", "no-store");
    return response;
  }

  const role = await ensureProfileForUser(user);

  const response = NextResponse.json({
    authenticated: true,
    user: {
      id: user.id,
      email: user.email ?? null,
      role
    }
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
