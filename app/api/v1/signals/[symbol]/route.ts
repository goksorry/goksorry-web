import { NextResponse } from "next/server";
import { jsonError, requireTradingBotReadAuth } from "@/lib/api-auth";
import { getServiceSupabaseClient } from "@/lib/supabase/service";

const SYMBOL_PATTERN = /^[A-Za-z0-9._-]{1,20}$/;

export async function GET(request: Request, { params }: { params: { symbol: string } }) {
  const auth = requireTradingBotReadAuth(request);
  if (!auth.ok) {
    return auth.response;
  }

  const symbol = String(params.symbol ?? "").trim().toUpperCase();
  if (!SYMBOL_PATTERN.test(symbol)) {
    return jsonError(auth.requestId, 400, "INVALID_QUERY", "invalid symbol format");
  }

  const service = getServiceSupabaseClient();
  const { data, error } = await service
    .from("detector_symbol_signals_latest")
    .select(
      "symbol,market,asof,mentions,neg_count,pos_count,panic_score,euphoria_score,signal_quality,mention_velocity_z,confidence_grade,source_diversity"
    )
    .eq("symbol", symbol)
    .maybeSingle();

  if (error) {
    return jsonError(auth.requestId, 504, "UPSTREAM_TIMEOUT", error.message);
  }

  if (!data) {
    return jsonError(auth.requestId, 404, "NOT_FOUND", "symbol not found");
  }

  const nowMs = Date.now();
  const asofMs = new Date(String(data.asof)).getTime();
  const fresh = Number.isNaN(asofMs) ? 999999999 : Math.max(0, Math.floor((nowMs - asofMs) / 1000));

  return NextResponse.json({
    symbol: String(data.symbol),
    market: String(data.market),
    latest: {
      symbol: String(data.symbol),
      market: String(data.market),
      asof: String(data.asof),
      freshness_sec: fresh,
      mentions: Number(data.mentions ?? 0),
      neg_count: Number(data.neg_count ?? 0),
      pos_count: Number(data.pos_count ?? 0),
      panic_score: Number(data.panic_score ?? 0),
      euphoria_score: Number(data.euphoria_score ?? 0),
      signal_quality: Number(data.signal_quality ?? 0),
      mention_velocity_z: Number(data.mention_velocity_z ?? 0),
      confidence_grade: String(data.confidence_grade ?? "D"),
      source_diversity: Number(data.source_diversity ?? 0)
    },
    window: {
      long_min: 120,
      short_min: 20
    }
  });
}
