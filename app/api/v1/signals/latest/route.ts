import { NextResponse } from "next/server";
import { jsonError, requireTradingBotReadAuth } from "@/lib/api-auth";
import { getServiceSupabaseClient } from "@/lib/supabase/service";

const SYMBOL_PATTERN = /^[A-Za-z0-9._-]{1,20}$/;

const parseMarket = (value: string | null): "kr" | "us" | "all" | null => {
  if (!value || !value.trim()) {
    return "all";
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "kr" || normalized === "us" || normalized === "all") {
    return normalized;
  }
  return null;
};

const parseSymbols = (value: string | null): string[] | null => {
  if (!value || !value.trim()) {
    return [];
  }

  const parsed = value
    .split(",")
    .map((symbol) => symbol.trim().toUpperCase())
    .filter((symbol) => symbol.length > 0);

  if (parsed.length > 100) {
    return null;
  }

  for (const symbol of parsed) {
    if (!SYMBOL_PATTERN.test(symbol)) {
      return null;
    }
  }

  return [...new Set(parsed)];
};

const parseMaxAge = (value: string | null): number | null => {
  if (!value || !value.trim()) {
    return 1800;
  }
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) {
    return null;
  }
  return Math.min(86400, Math.floor(num));
};

const freshnessSec = (asof: string, nowMs: number): number => {
  const asofMs = new Date(asof).getTime();
  if (Number.isNaN(asofMs)) {
    return 999999999;
  }
  return Math.max(0, Math.floor((nowMs - asofMs) / 1000));
};

export async function GET(request: Request) {
  const auth = await requireTradingBotReadAuth(request);
  if (!auth.ok) {
    return auth.response;
  }

  const url = new URL(request.url);
  const market = parseMarket(url.searchParams.get("market"));
  const symbols = parseSymbols(url.searchParams.get("symbols"));
  const maxAgeSec = parseMaxAge(url.searchParams.get("max_age_sec"));

  if (!market) {
    return jsonError(auth.requestId, 400, "INVALID_QUERY", "market must be kr|us|all");
  }
  if (!symbols) {
    return jsonError(auth.requestId, 400, "INVALID_QUERY", "symbols must be CSV, max 100");
  }
  if (maxAgeSec === null) {
    return jsonError(auth.requestId, 400, "INVALID_QUERY", "max_age_sec must be positive integer");
  }

  const service = getServiceSupabaseClient();
  const { data: statusRow, error: statusError } = await service
    .from("detector_status")
    .select("llm_degraded,detector_mode")
    .eq("singleton", true)
    .maybeSingle();

  if (statusError) {
    return jsonError(auth.requestId, 504, "UPSTREAM_TIMEOUT", statusError.message);
  }

  if (statusRow?.llm_degraded || statusRow?.detector_mode === "degraded") {
    return jsonError(auth.requestId, 503, "DETECTOR_DEGRADED", "llm pipeline delayed");
  }

  let query = service
    .from("detector_symbol_signals_latest")
    .select(
      "symbol,market,asof,mentions,neg_count,pos_count,panic_score,euphoria_score,signal_quality,mention_velocity_z,confidence_grade,source_diversity"
    )
    .order("asof", { ascending: false })
    .limit(500);

  if (market !== "all") {
    query = query.eq("market", market);
  }

  if (symbols.length > 0) {
    query = query.in("symbol", symbols);
  }

  const { data, error } = await query;
  if (error) {
    return jsonError(auth.requestId, 504, "UPSTREAM_TIMEOUT", error.message);
  }

  const nowMs = Date.now();
  const normalized = (data ?? []).map((row) => {
    const fresh = freshnessSec(String(row.asof), nowMs);
    return {
      symbol: String(row.symbol),
      market: String(row.market),
      asof: String(row.asof),
      freshness_sec: fresh,
      mentions: Number(row.mentions ?? 0),
      neg_count: Number(row.neg_count ?? 0),
      pos_count: Number(row.pos_count ?? 0),
      panic_score: Number(row.panic_score ?? 0),
      euphoria_score: Number(row.euphoria_score ?? 0),
      signal_quality: Number(row.signal_quality ?? 0),
      mention_velocity_z: Number(row.mention_velocity_z ?? 0),
      confidence_grade: String(row.confidence_grade ?? "D"),
      source_diversity: Number(row.source_diversity ?? 0)
    };
  });

  const freshSignals = normalized.filter((row) => row.freshness_sec <= maxAgeSec);
  const bySymbol = new Map<string, (typeof freshSignals)[number]>();
  for (const row of freshSignals) {
    if (!bySymbol.has(row.symbol)) {
      bySymbol.set(row.symbol, row);
    }
  }

  const outputSignals = symbols.length > 0 ? symbols.map((symbol) => bySymbol.get(symbol)).filter(Boolean) : [...bySymbol.values()];
  const missingSymbols = symbols.filter((symbol) => !bySymbol.has(symbol));

  return NextResponse.json({
    status: "ok",
    generated_at: new Date().toISOString(),
    detector_mode: statusRow?.detector_mode ?? "normal",
    signals: outputSignals,
    missing_symbols: missingSymbols,
    ttl_sec: 60
  });
}
