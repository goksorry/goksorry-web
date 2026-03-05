import { NextResponse } from "next/server";
import { jsonError, requireTradingBotReadAuth } from "@/lib/api-auth";
import { getServiceSupabaseClient } from "@/lib/supabase/service";

export async function GET(request: Request) {
  const auth = requireTradingBotReadAuth(request);
  if (!auth.ok) {
    return auth.response;
  }

  const service = getServiceSupabaseClient();
  const { data, error } = await service
    .from("detector_status")
    .select(
      "collector_last_run_at,collector_errors,llm_provider,llm_last_run_at,llm_degraded,detector_mode,us_cooldown_until,hold_list"
    )
    .eq("singleton", true)
    .maybeSingle();

  if (error) {
    return jsonError(auth.requestId, 504, "UPSTREAM_TIMEOUT", error.message);
  }

  const statusRow = data ?? {
    collector_last_run_at: null,
    collector_errors: 0,
    llm_provider: "gemini",
    llm_last_run_at: null,
    llm_degraded: false,
    detector_mode: "normal",
    us_cooldown_until: null,
    hold_list: []
  };

  return NextResponse.json({
    status: "ok",
    detector_mode: statusRow.detector_mode,
    collector: {
      last_run_at: statusRow.collector_last_run_at,
      errors: statusRow.collector_errors
    },
    llm: {
      provider: statusRow.llm_provider,
      last_run_at: statusRow.llm_last_run_at,
      degraded: statusRow.llm_degraded
    },
    sources: {
      us_cooldown_until: statusRow.us_cooldown_until,
      hold_list: Array.isArray(statusRow.hold_list) ? statusRow.hold_list : []
    }
  });
}
