import { NextResponse } from "next/server";
import { jsonError, logApiError, requireTradingBotReadAuth } from "@/lib/api-auth";
import { getServiceSupabaseClient } from "@/lib/supabase/service";

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

export async function GET(request: Request) {
  const auth = await requireTradingBotReadAuth(request);
  if (!auth.ok) {
    return auth.response;
  }

  const url = new URL(request.url);
  const market = parseMarket(url.searchParams.get("market"));
  if (!market) {
    return jsonError(auth.requestId, 400, "INVALID_QUERY", "market must be kr|us|all");
  }

  const service = getServiceSupabaseClient();
  let query = service
    .from("detector_market_state_latest")
    .select("market,asof,regime,fear_index,payload")
    .order("market", { ascending: true });

  if (market !== "all") {
    query = query.eq("market", market);
  }

  const { data, error } = await query;
  if (error) {
    logApiError("market latest lookup failed", auth.requestId, error);
    return jsonError(auth.requestId, 504, "UPSTREAM_TIMEOUT", "market state lookup failed");
  }

  return NextResponse.json({
    status: "ok",
    generated_at: new Date().toISOString(),
    markets: (data ?? []).map((row) => ({
      market: row.market,
      asof: row.asof,
      regime: row.regime,
      fear_index: row.fear_index,
      payload: row.payload
    })),
    ttl_sec: 60
  });
}
