import { NextResponse } from "next/server";
import { buildOpenApiSpec } from "@/lib/api-docs";

export async function GET() {
  return NextResponse.json(buildOpenApiSpec(), {
    headers: {
      "Cache-Control": "public, max-age=300"
    }
  });
}
