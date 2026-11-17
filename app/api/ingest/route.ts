import { NextResponse } from "next/server";
import { jsonMessage, logApiError, requireDetectorWriteAuth } from "@/lib/api-auth";
import { sanitizeOptionalPlainText, sanitizePlainText } from "@/lib/plain-text";
import { resolveSentimentScore, sentimentLabelFromScore } from "@/lib/sentiment-score";
import { extractSymbolFromSource, syncSymbolMetadata } from "@/lib/symbol-metadata";
import { getServiceSupabaseClient } from "@/lib/supabase/service";

import { getSourceGroupId } from "@/lib/feed-source-groups";

const LABELS = new Set(["bullish", "bearish", "neutral"]);

type IngestPayloadItem = {
  source: unknown;
  post_key: unknown;
  title: unknown;
  clean_title?: unknown;
  url: unknown;
  preview?: unknown;
  fetched_at?: unknown;
  created_at_from_source?: unknown;
  analysis?: {
    label?: unknown;
    sentiment_score?: unknown;
    confidence?: unknown;
    model?: unknown;
  };
};

const chunk = <T,>(items: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
};

export async function POST(request: Request) {
  const auth = requireDetectorWriteAuth(request);
  if (!auth.ok) {
    return auth.response;
  }

  let body: { items?: IngestPayloadItem[] };
  try {
    body = (await request.json()) as { items?: IngestPayloadItem[] };
  } catch {
    return jsonMessage(auth.requestId, 400, "Invalid JSON body");
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
      if (!getSourceGroupId(source)) { skipped += 1; continue; }
      const receivedAt = Date.parse(String(item.fetched_at ?? ""));
      if (!Number.isFinite(receivedAt) || receivedAt < Date.now() - 6 * 3600000 || receivedAt > Date.now() || receivedAt < Date.parse("2026-11-17T04:58:42Z") || item.preview) { skipped += 1; continue; }
      const postKey = sanitizePlainText(item.post_key, "post_key", 1024);
      const title = sanitizePlainText(item.title, "title", 500);
      const symbol = extractSymbolFromSource(source);
      const cleanTitle = null;
      const url = String(item.url ?? "").trim();
      const hostname = new URL(url).hostname;
      const group = getSourceGroupId(source);
      const hosts: Record<string, string[]> = { toss: ["www.tossinvest.com", "tossinvest.com"], dc: ["gall.dcinside.com"], blind: ["www.teamblind.com", "teamblind.com", "kr.teamblind.com"], ppomppu: ["www.ppomppu.co.kr", "ppomppu.co.kr"] };
      if (!/^https:\/\//i.test(url) || !group || !hosts[group].includes(hostname)) {
        skipped += 1;
        continue;
      }

      const rawLabel = String(item.analysis?.label ?? "").trim().toLowerCase();
      if (rawLabel && !LABELS.has(rawLabel)) {
        skipped += 1;
        continue;
      }
      const sentimentScore = resolveSentimentScore(item.analysis?.sentiment_score, rawLabel);
      const label = sentimentLabelFromScore(sentimentScore);

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
        symbol,
        post_key: postKey,
        title,
        clean_title: cleanTitle,
        url,
        // Store only title/link metadata; never retain source bodies from retries.
        preview: null,
        fetched_at: fetchedAt,
        created_at_from_source: createdAtFromSource
      });

      sentimentRows.push({
        post_key: postKey,
        label,
        sentiment_score: sentimentScore,
        confidence,
        model: sanitizeOptionalPlainText(item.analysis?.model, "model", 120) ?? "gemini-2.5-flash-lite",
        analyzed_at: fetchedAt
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
      logApiError("external posts upsert failed", auth.requestId, error);
      return jsonMessage(auth.requestId, 500, "external post upsert failed");
    }
  }

  for (const part of chunk(sentimentRows, 200)) {
    const { error } = await service.from("sentiment_results").upsert(part, { onConflict: "post_key" });
    if (error) {
      logApiError("sentiment results upsert failed", auth.requestId, error);
      return jsonMessage(auth.requestId, 500, "sentiment upsert failed");
    }
  }

  const symbols = [...new Set(externalRows.map((row) => String(row.symbol ?? "").trim().toUpperCase()).filter(Boolean))];
  if (symbols.length > 0) {
    try {
      await syncSymbolMetadata(service, symbols);
    } catch (error) {
      logApiError("symbol metadata sync failed", auth.requestId, error);
    }
  }

  return NextResponse.json({ upserted: sentimentRows.length, skipped });
}
