import { NextResponse } from "next/server";
import { getServerEnv } from "@/lib/env";
import { getServiceSupabaseClient } from "@/lib/supabase/service";

const parseBearer = (request: Request): string | null => {
  const value = request.headers.get("authorization") ?? "";
  if (!value.startsWith("Bearer ")) {
    return null;
  }
  return value.slice(7).trim() || null;
};

const chunk = <T,>(items: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
};

export async function POST(request: Request) {
  const env = getServerEnv();
  const token = parseBearer(request);

  if (!token || token !== env.INGEST_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { post_keys?: unknown[] };
  try {
    body = (await request.json()) as { post_keys?: unknown[] };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const postKeys = Array.isArray(body.post_keys)
    ? body.post_keys
        .map((key) => String(key ?? "").trim())
        .filter((key) => key.length > 0)
        .slice(0, 5000)
    : [];

  if (postKeys.length === 0) {
    return NextResponse.json({ existing_post_keys: [] });
  }

  const service = getServiceSupabaseClient();
  const existing = new Set<string>();

  for (const part of chunk(postKeys, 300)) {
    const { data, error } = await service.from("sentiment_results").select("post_key").in("post_key", part);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    for (const row of data ?? []) {
      if (row.post_key) {
        existing.add(String(row.post_key));
      }
    }
  }

  return NextResponse.json({ existing_post_keys: [...existing] });
}
