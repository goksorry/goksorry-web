import { NextResponse } from "next/server";
import { getRequestId, logApiError } from "@/lib/api-auth";
import { getServiceSupabaseClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

type HealthLevel = "ok" | "degraded" | "stale";

const WARN_AFTER_SEC = 25 * 60;
const STALE_AFTER_SEC = 45 * 60;

const statusRank: Record<HealthLevel, number> = {
  ok: 0,
  degraded: 1,
  stale: 2
};

const parseTimestamp = (value: unknown): string | null => {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return null;
  }

  const ms = new Date(raw).getTime();
  if (Number.isNaN(ms)) {
    return null;
  }

  return new Date(ms).toISOString();
};

const ageSecFromIso = (iso: string | null, nowMs: number): number | null => {
  if (!iso) {
    return null;
  }

  const ms = new Date(iso).getTime();
  if (Number.isNaN(ms)) {
    return null;
  }

  return Math.max(0, Math.floor((nowMs - ms) / 1000));
};

const freshnessStatus = (ageSec: number | null): HealthLevel => {
  if (ageSec === null) {
    return "stale";
  }
  if (ageSec > STALE_AFTER_SEC) {
    return "stale";
  }
  if (ageSec > WARN_AFTER_SEC) {
    return "degraded";
  }
  return "ok";
};

const worstStatus = (...statuses: HealthLevel[]): HealthLevel =>
  statuses.reduce((worst, current) => (statusRank[current] > statusRank[worst] ? current : worst), "ok" as HealthLevel);

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  const service = getServiceSupabaseClient();

  const [statusResult, feedResult, signalResult] = await Promise.all([
    service
      .from("detector_status")
      .select("collector_last_run_at,collector_errors,llm_last_run_at,llm_degraded,detector_mode,updated_at")
      .eq("singleton", true)
      .maybeSingle(),
    service
      .from("sentiment_results")
      .select("analyzed_at")
      .order("analyzed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    service
      .from("detector_symbol_signals_latest")
      .select("asof")
      .order("asof", { ascending: false })
      .limit(1)
      .maybeSingle()
  ]);

  const failedResult = [statusResult, feedResult, signalResult].find((result) => result.error);
  if (failedResult?.error) {
    logApiError("detector health lookup failed", requestId, failedResult.error);
    return NextResponse.json(
      {
        status: "error",
        request_id: requestId,
        message: "detector health lookup failed"
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  }

  const now = new Date();
  const nowMs = now.getTime();

  const collectorLastRunAt = parseTimestamp(statusResult.data?.collector_last_run_at);
  const llmLastRunAt = parseTimestamp(statusResult.data?.llm_last_run_at);
  const detectorUpdatedAt = parseTimestamp(statusResult.data?.updated_at);
  const latestFeedAt = parseTimestamp(feedResult.data?.analyzed_at);
  const latestSignalAt = parseTimestamp(signalResult.data?.asof);

  const collectorAgeSec = ageSecFromIso(collectorLastRunAt, nowMs);
  const llmAgeSec = ageSecFromIso(llmLastRunAt, nowMs);
  const feedAgeSec = ageSecFromIso(latestFeedAt, nowMs);
  const signalAgeSec = ageSecFromIso(latestSignalAt, nowMs);

  const detectorBaseStatus = worstStatus(
    freshnessStatus(collectorAgeSec),
    freshnessStatus(llmAgeSec),
    freshnessStatus(detectorUpdatedAt ? ageSecFromIso(detectorUpdatedAt, nowMs) : null)
  );
  const detectorStatus =
    statusResult.data?.llm_degraded || String(statusResult.data?.detector_mode ?? "normal") !== "normal"
      ? worstStatus(detectorBaseStatus, "degraded")
      : detectorBaseStatus;
  const feedStatus = freshnessStatus(feedAgeSec);
  const signalStatus = freshnessStatus(signalAgeSec);
  const overallStatus = worstStatus(detectorStatus, feedStatus, signalStatus);

  const response = NextResponse.json(
    {
      status: overallStatus,
      request_id: requestId,
      checked_at: now.toISOString(),
      thresholds: {
        warn_after_sec: WARN_AFTER_SEC,
        stale_after_sec: STALE_AFTER_SEC
      },
      detector: {
        status: detectorStatus,
        collector_last_run_at: collectorLastRunAt,
        collector_age_sec: collectorAgeSec,
        collector_errors: Number(statusResult.data?.collector_errors ?? 0),
        llm_last_run_at: llmLastRunAt,
        llm_age_sec: llmAgeSec,
        llm_degraded: Boolean(statusResult.data?.llm_degraded),
        detector_mode: String(statusResult.data?.detector_mode ?? "normal"),
        updated_at: detectorUpdatedAt
      },
      feed: {
        status: feedStatus,
        latest_analyzed_at: latestFeedAt,
        age_sec: feedAgeSec
      },
      signals: {
        status: signalStatus,
        latest_asof: latestSignalAt,
        age_sec: signalAgeSec
      }
    },
    {
      status: overallStatus === "ok" ? 200 : 503,
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );

  response.headers.set("X-Health-Status", overallStatus);
  return response;
}
