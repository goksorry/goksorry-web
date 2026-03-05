import { NextResponse } from "next/server";
import { getServerEnv } from "@/lib/env";
import { sanitizeOptionalPlainText, sanitizePlainText } from "@/lib/plain-text";
import { getServiceSupabaseClient } from "@/lib/supabase/service";

const LABELS = new Set(["bullish", "bearish", "neutral"]);

type IngestPayloadItem = {
  source: unknown;
  post_key: unknown;
  title: unknown;
  url: unknown;
  preview?: unknown;
  fetched_at?: unknown;
  created_at_from_source?: unknown;
  analysis?: {
    label?: unknown;
    confidence?: unknown;
  };
};

const chunk = <T,>(items: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
};

const parseBearer = (request: Request): string | null => {
  const value = request.headers.get("authorization") ?? "";
  if (!value.startsWith("Bearer ")) {
    return null;
  }
  const token = value.slice(7).trim();
  return token || null;
};

export async function POST(request: Request) {
  const env = getServerEnv();
  const token = parseBearer(request);

  if (!token || token !== env.INGEST_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { items?: IngestPayloadItem[] };
  try {
    body = (await request.json()) as { items?: IngestPayloadItem[] };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const incomingItems = Array.isArray(body.items) ? body.items : [];
  if (incomingItems.length === 0) {
    return NextResponse.json({ upserted: 0, skipped: 0 });
  }

  const externalRows: Record<string, unknown>[] = [];
  const sentimentRows: Record<string, unknown>[] = [];
  let skipped = 0;

  for (const item of incomingItems) {
    try {
      const source = sanitizePlainText(item.source, "source", 120);
      const postKey = sanitizePlainText(item.post_key, "post_key", 1024);
      const title = sanitizePlainText(item.title, "title", 500);
      const url = String(item.url ?? "").trim();
      if (!/^https?:\/\//i.test(url)) {
        skipped += 1;
        continue;
      }

      const label = String(item.analysis?.label ?? "").trim().toLowerCase();
      if (!LABELS.has(label)) {
        skipped += 1;
        continue;
      }

      const confidenceNum = Number(item.analysis?.confidence ?? 0);
      const confidence = Number.isFinite(confidenceNum) ? Math.min(1, Math.max(0, confidenceNum)) : 0;

      const fetchedAtValue = item.fetched_at ? new Date(String(item.fetched_at)) : new Date();
      const fetchedAt = Number.isNaN(fetchedAtValue.getTime()) ? new Date().toISOString() : fetchedAtValue.toISOString();

      const sourceCreated = item.created_at_from_source
        ? new Date(String(item.created_at_from_source))
        : null;
      const createdAtFromSource = sourceCreated && !Number.isNaN(sourceCreated.getTime()) ? sourceCreated.toISOString() : null;

      externalRows.push({
        source,
        post_key: postKey,
        title,
        url,
        preview: sanitizeOptionalPlainText(item.preview, "preview", 4000),
        fetched_at: fetchedAt,
        created_at_from_source: createdAtFromSource
      });

      sentimentRows.push({
        post_key: postKey,
        label,
        confidence,
        model: "gemini-2.5-flash-lite",
        analyzed_at: new Date().toISOString()
      });
    } catch {
      skipped += 1;
    }
  }

  if (externalRows.length === 0) {
    return NextResponse.json({ upserted: 0, skipped });
  }

  const service = getServiceSupabaseClient();
  for (const part of chunk(externalRows, 200)) {
    const { error } = await service.from("external_posts").upsert(part, { onConflict: "post_key" });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  for (const part of chunk(sentimentRows, 200)) {
    const { error } = await service.from("sentiment_results").upsert(part, { onConflict: "post_key" });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ upserted: sentimentRows.length, skipped });
}
