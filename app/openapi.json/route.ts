import { NextResponse } from "next/server";
import { getCompletedProfileForUser, getUserFromAuthorization } from "@/lib/auth-server";
import { buildOpenApiSpecForRole } from "@/lib/api-docs";

export async function GET(request: Request) {
  const user = await getUserFromAuthorization(request);
  const profile = user ? await getCompletedProfileForUser(user) : null;
  const isAdmin = profile?.role === "admin";

  return NextResponse.json(buildOpenApiSpecForRole(isAdmin), {
    headers: {
      "Cache-Control": "private, no-store"
    }
  });
}
