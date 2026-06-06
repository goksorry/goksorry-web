import { NextResponse } from "next/server";
import { jsonError, logApiError, requireDetectorWriteAuth } from "@/lib/api-auth";
import { normalizeAnalysisPayload, type AnalysisReportStatus } from "@/lib/analysis-data";
import { getServiceSupabaseClient } from "@/lib/supabase/service";

const ANALYSIS_BRIEF_LIMIT = 2500;

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

const clipText = (value: unknown, fallback = "", maxLength = 1000): string => {
  const text = typeof value === "string" ? value : value === null || value === undefined ? "" : String(value);
  const normalized = text.replace(/\s+/g, " ").trim();
  return (normalized || fallback).slice(0, maxLength);
};

const parseAsOf = (value: unknown): string => {
  const date = new Date(String(value ?? ""));
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString();
  }
  return date.toISOString();
};

const parseStatus = (value: unknown): AnalysisReportStatus => {
  const status = clipText(value, "ok", 20).toLowerCase();
  if (status === "partial" || status === "error") {
    return status;
  }
  return "ok";
};

const parseErrors = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => clipText(item, "", 240)).filter(Boolean).slice(0, 20);
};

export async function POST(request: Request) {
  const auth = requireDetectorWriteAuth(request);
  if (!auth.ok) {
    return auth.response;
  }

  let body: Record<string, unknown>;
  try {
    const parsed = await request.json();
    const record = asRecord(parsed);
    if (!record) {
      return jsonError(auth.requestId, 400, "INVALID_QUERY", "request body must be an object");
    }
    body = record;
  } catch {
    return jsonError(auth.requestId, 400, "INVALID_QUERY", "invalid json body");
  }

  const rawPayload = asRecord(body.payload);
  if (!rawPayload) {
    return jsonError(auth.requestId, 400, "INVALID_QUERY", "payload must be an object");
  }

  const payload = normalizeAnalysisPayload(rawPayload);
  const row = {
    asof: parseAsOf(body.asof ?? rawPayload.asof),
    status: parseStatus(body.status),
    summary: clipText(body.summary, payload.brief, ANALYSIS_BRIEF_LIMIT),
    payload,
    errors: parseErrors(body.errors)
  };

  const service = getServiceSupabaseClient();
  const { data, error } = await service
    .from("analysis_reports")
    .insert(row)
    .select("id,asof,status")
    .single();

  if (error) {
    logApiError("analysis report insert failed", auth.requestId, error);
    return jsonError(auth.requestId, 504, "UPSTREAM_TIMEOUT", "analysis report insert failed");
  }

  return NextResponse.json({
    status: "ok",
    request_id: auth.requestId,
    report: data
  });
}
