import "server-only";
import { unstable_cache } from "next/cache";
import { fetchRecentFeedRows, type FeedRow } from "@/lib/feed-data";
import { normalizePolicyPayload } from "@/lib/collection-policy-status";
import { buildCollectionStatusFilters, getCachedMarketOverview } from "@/lib/overview-data";
import { buildMarketAdjustmentSnapshot } from "@/lib/community-market-adjustment";
import { getServiceSupabaseClient } from "@/lib/supabase/service";
import { buildWorldFrame, buildWorldReplay, worldDayBounds, type WorldFrame, type WorldSlot } from "@/lib/world";

export const WORLD_CACHE_TAG = "world-frame";
export async function loadWorldFrame(service = getServiceSupabaseClient({ cache: "no-store" })): Promise<WorldFrame> {
  const now = new Date();
  const rows: FeedRow[] = [];
  // Scan the entire six-hour window. A joined page may contain fewer rows than
  // its sentiment page, so pagination follows scannedCount, not rows.length.
  for (let offset = 0; ; offset += 500) {
    const page = await fetchRecentFeedRows(service, { hours: 6, limit: 500, offset, asOf: now });
    if (page.errorMessage) throw new Error(page.errorMessage);
    rows.push(...page.rows);
    if (page.scannedCount < 500) break;
  }
  const [{ data: status, error }, market] = await Promise.all([
    service.from("detector_status").select("collector_last_run_at,collector_errors,llm_degraded,collection_policy")
      .eq("singleton", true).maybeSingle(),
    getCachedMarketOverview()
  ]);
  const policy = normalizePolicyPayload(status?.collection_policy);
  return buildWorldFrame(rows, {
    now,
    ...buildCollectionStatusFilters(policy),
    marketAdjustmentSnapshot: buildMarketAdjustmentSnapshot(market.generated_at, market.market_indicators),
    collection: {
      last_run_at: status?.collector_last_run_at ?? null,
      errors: Number(status?.collector_errors ?? 0), degraded: Boolean(status?.llm_degraded), unavailable: Boolean(error) || !status
    }
  });
}
export const getWorldFrame = unstable_cache(loadWorldFrame, ["world-frame-v1"], {
  revalidate: 60, tags: [WORLD_CACHE_TAG]
});

export async function loadWorldReplay(date: string) {
  const bounds = worldDayBounds(date);
  if (!bounds) throw new Error("Invalid replay date");
  const service = getServiceSupabaseClient({ cache: "no-store" });
  const { data, error } = await service.from("world_snapshots").select("bucket_at,frame")
    .gte("bucket_at", bounds.start).lt("bucket_at", bounds.end).order("bucket_at", { ascending: true });
  if (error) throw new Error("극장 기록을 불러오지 못했습니다. 기록은 기능 도입 후 수집 완료 시점부터 쌓입니다.");
  const snapshots: WorldSlot[] = (data ?? []).filter((row) => row.frame?.version === 1);
  return buildWorldReplay(date, snapshots);
}
