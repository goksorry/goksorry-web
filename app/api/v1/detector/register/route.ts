import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { jsonError, logApiError, requireDetectorWriteAuth } from "@/lib/api-auth";
import { COLLECTION_POLICY_CACHE_TAG } from "@/lib/collection-policy-status";
import { getServiceSupabaseClient } from "@/lib/supabase/service";

const SYMBOL_PATTERN = /^[A-Za-z0-9._-]{1,20}$/;

const asIso = (value: unknown): string => {
  const date = new Date(String(value ?? ""));
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString();
  }
  return date.toISOString();
};

const toNumber = (value: unknown, min: number, max: number, fallback: number): number => {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, num));
};

type SignalRow = {
  symbol: unknown;
  market: unknown;
  asof: unknown;
  mentions: unknown;
  neg_count: unknown;
  pos_count: unknown;
  panic_score: unknown;
  euphoria_score: unknown;
  signal_quality: unknown;
  mention_velocity_z: unknown;
  confidence_grade: unknown;
  source_diversity: unknown;
  detector_mode?: unknown;
  extra?: unknown;
};

type MarketRow = {
  market: unknown;
  asof: unknown;
  regime: unknown;
  fear_index: unknown;
  payload?: unknown;
};

type CollectionPolicySourceRow = {
  source_name?: unknown;
  site_key?: unknown;
  checked_at?: unknown;
  allow_fetch?: unknown;
  allow_detail?: unknown;
  postponed?: unknown;
  reason?: unknown;
  robots_url?: unknown;
  terms_url?: unknown;
};

type CollectionPolicyPayload = {
  checked_at?: unknown;
  refresh_hours?: unknown;
  sources?: CollectionPolicySourceRow[];
};

const sanitizeStatusText = (value: unknown, maxLength: number): string | null => {
  const text = String(value ?? "").replace(/[<>]/g, "").trim();
  if (!text) {
    return null;
  }
  return text.slice(0, maxLength);
};

const asOptionalIso = (value: unknown): string | null => {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return null;
  }

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
};

const normalizeCollectionPolicy = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const payload = value as CollectionPolicyPayload;
  const sources = Array.isArray(payload.sources) ? payload.sources : [];
  const normalizedSources = sources.slice(0, 80).flatMap((source) => {
    const sourceName = sanitizeStatusText(source.source_name, 120);
    if (!sourceName) {
      return [];
    }

    return [
      {
        source_name: sourceName,
        site_key: sanitizeStatusText(source.site_key, 80),
        checked_at: asOptionalIso(source.checked_at),
        allow_fetch: Boolean(source.allow_fetch),
        allow_detail: Boolean(source.allow_detail),
        postponed: Boolean(source.postponed),
        reason: sanitizeStatusText(source.reason, 120),
        robots_url: sanitizeStatusText(source.robots_url, 500),
        terms_url: sanitizeStatusText(source.terms_url, 500)
      }
    ];
  });

  const checkedAt = asOptionalIso(payload.checked_at);
  const sourceCheckedAtValues = normalizedSources
    .map((source) => asOptionalIso(source.checked_at))
    .filter((value): value is string => Boolean(value))
    .sort();
  return {
    checked_at: checkedAt ?? sourceCheckedAtValues[sourceCheckedAtValues.length - 1] ?? null,
    refresh_hours: Math.floor(toNumber(payload.refresh_hours, 1, 24 * 14, 24)),
    sources: normalizedSources
  };
};

export async function POST(request: Request) {
  const auth = requireDetectorWriteAuth(request);
  if (!auth.ok) {
    return auth.response;
  }

  let body: {
    signals?: SignalRow[];
    market_state?: MarketRow[];
    status?: Record<string, unknown>;
  };
  try {
    body = (await request.json()) as {
      signals?: SignalRow[];
      market_state?: MarketRow[];
      status?: Record<string, unknown>;
    };
  } catch {
    return jsonError(auth.requestId, 400, "INVALID_QUERY", "invalid json body");
  }

  const signalRowsRaw = Array.isArray(body.signals) ? body.signals : [];
  const marketRowsRaw = Array.isArray(body.market_state) ? body.market_state : [];

  const signalRows = signalRowsRaw.flatMap((row) => {
    const symbol = String(row.symbol ?? "").trim().toUpperCase();
    const market = String(row.market ?? "").trim().toLowerCase();
    const confidence = String(row.confidence_grade ?? "").trim().toUpperCase();

    if (!SYMBOL_PATTERN.test(symbol)) {
      return [];
    }
    if (market !== "kr" && market !== "us") {
      return [];
    }
    if (!["A", "B", "C", "D"].includes(confidence)) {
      return [];
    }

    return [
      {
        symbol,
        market,
        asof: asIso(row.asof),
        mentions: Math.floor(toNumber(row.mentions, 0, 1_000_000, 0)),
        neg_count: Math.floor(toNumber(row.neg_count, 0, 1_000_000, 0)),
        pos_count: Math.floor(toNumber(row.pos_count, 0, 1_000_000, 0)),
        panic_score: toNumber(row.panic_score, 0, 100, 0),
        euphoria_score: toNumber(row.euphoria_score, 0, 100, 0),
        signal_quality: toNumber(row.signal_quality, 0, 1, 0),
        mention_velocity_z: toNumber(row.mention_velocity_z, -100, 100, 0),
        confidence_grade: confidence,
        source_diversity: Math.floor(toNumber(row.source_diversity, 0, 1000, 0)),
        detector_mode: String(row.detector_mode ?? "normal").slice(0, 40),
        extra: typeof row.extra === "object" && row.extra ? row.extra : {}
      }
    ];
  });

  const marketRows = marketRowsRaw.flatMap((row) => {
    const market = String(row.market ?? "").trim().toLowerCase();
    if (market !== "kr" && market !== "us") {
      return [];
    }

    return [
      {
        market,
        asof: asIso(row.asof),
        regime: String(row.regime ?? "neutral").slice(0, 40),
        fear_index: toNumber(row.fear_index, 0, 100, 50),
        payload: typeof row.payload === "object" && row.payload ? row.payload : {}
      }
    ];
  });

  const service = getServiceSupabaseClient();
  if (signalRows.length > 0) {
    const { error } = await service
      .from("detector_symbol_signals_latest")
      .upsert(signalRows, { onConflict: "symbol" });

    if (error) {
      logApiError("detector signal upsert failed", auth.requestId, error);
      return jsonError(auth.requestId, 504, "UPSTREAM_TIMEOUT", "signal upsert failed");
    }
  }

  if (marketRows.length > 0) {
    const { error } = await service
      .from("detector_market_state_latest")
      .upsert(marketRows, { onConflict: "market" });

    if (error) {
      logApiError("detector market state upsert failed", auth.requestId, error);
      return jsonError(auth.requestId, 504, "UPSTREAM_TIMEOUT", "market state upsert failed");
    }
  }

  let statusUpdated = false;
  if (body.status && typeof body.status === "object") {
    const payload = body.status;
    const collectionPolicy = normalizeCollectionPolicy(payload.collection_policy);

    const row: Record<string, unknown> = {
      singleton: true,
      collector_last_run_at: asIso(payload.collector_last_run_at),
      collector_errors: Math.floor(toNumber(payload.collector_errors, 0, 1_000_000, 0)),
      llm_provider: String(payload.llm_provider ?? "gemini").slice(0, 40),
      llm_last_run_at: asIso(payload.llm_last_run_at),
      llm_degraded: Boolean(payload.llm_degraded),
      detector_mode: String(payload.detector_mode ?? "normal").slice(0, 40),
      us_cooldown_until: payload.us_cooldown_until ? asIso(payload.us_cooldown_until) : null,
      hold_list: Array.isArray(payload.hold_list) ? payload.hold_list.slice(0, 200) : []
    };

    if (collectionPolicy) {
      row.collection_policy = collectionPolicy;
    }

    const { error } = await service.from("detector_status").upsert(row, { onConflict: "singleton" });
    if (error) {
      logApiError("detector status upsert failed", auth.requestId, error);
      return jsonError(auth.requestId, 504, "UPSTREAM_TIMEOUT", "status upsert failed");
    }
    if (collectionPolicy) {
      revalidateTag(COLLECTION_POLICY_CACHE_TAG);
    }
    statusUpdated = true;
  }

  return NextResponse.json({
    status: "ok",
    request_id: auth.requestId,
    upserted_signals: signalRows.length,
    upserted_market_state: marketRows.length,
    status_updated: statusUpdated
  });
}
