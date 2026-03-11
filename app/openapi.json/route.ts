import { NextResponse } from "next/server";
import { getUserFromAuthorization, isAdminEmail } from "@/lib/auth-server";
import { buildOpenApiSpecForRole } from "@/lib/api-docs";

export async function GET(request: Request) {
  const user = await getUserFromAuthorization(request);
  const isAdmin = Boolean(user && (user.role === "admin" || isAdminEmail(user.email)));

  return NextResponse.json(buildOpenApiSpecForRole(isAdmin), {
    headers: {
      "Cache-Control": "private, no-store"
    }
  });
}
