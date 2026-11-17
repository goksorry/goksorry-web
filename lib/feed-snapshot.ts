import "server-only";
import { boundedCache } from "./bounded-cache";
import { COLLECTION_RUN_CACHE_TAG } from "./index-cache-policy";
import { fetchRecentFeedRows, type FeedRow } from "./feed-data";
import { buildFeedPage, type FeedSelection, type FeedSnapshot } from "./feed-scope";
import { getServiceSupabaseClient } from "./supabase/service";
import { filterReviewedSourceRows, normalizePolicyPayload } from "./collection-policy-status";
import { buildCollectionStatusFilters, getCachedMarketOverview } from "./overview-data";
import { buildMarketAdjustmentSnapshot } from "./community-market-adjustment";

export const getFeedSnapshot = boundedCache(async (hours: number, asOf: string): Promise<FeedSnapshot> => {
  const now = asOf ? new Date(asOf) : new Date();
  const service = getServiceSupabaseClient({ cache: "no-store" });
  const rows: FeedRow[] = [];
  // Scan every sentiment page, including pages with missing external rows.
  // Never cache partial successes as empty scopes.
  for (let offset = 0; ; offset += 500) {
    const page = await fetchRecentFeedRows(service, { hours, limit: 500, offset, asOf: now });
    if (page.errorMessage) throw new Error(page.errorMessage);
    rows.push(...page.rows);
    if (page.scannedCount < 500) break;
  }
  const [status, market] = await Promise.all([
    service.from("detector_status").select("collector_last_run_at,collector_errors,llm_degraded,collection_policy").eq("singleton", true).maybeSingle(),
    getCachedMarketOverview()
  ]);
  if (status.error || !status.data?.collection_policy) throw new Error("collection policy unavailable");
  const policy = normalizePolicyPayload(status.data.collection_policy);
  const permittedRows = filterReviewedSourceRows(rows, policy);
  const { collectionStatuses, excludedSourceNames } = buildCollectionStatusFilters(policy);
  return {
    aggregateBuckets: policy?.aggregateBuckets ?? [],
    rows: [...new Map(permittedRows.map(row => [row.post_key, row])).values()], generated_at: now.toISOString(),
    market_indicators: market.market_indicators.slice(0, 4),
    marketAdjustmentSnapshot: buildMarketAdjustmentSnapshot(market.generated_at, market.market_indicators), collectionStatuses, excludedSourceNames: [...excludedSourceNames],
    collection: { last_run_at: status.data?.collector_last_run_at ?? null, errors: Number(status.data?.collector_errors ?? 0), degraded: Boolean(status.data?.llm_degraded), unavailable: Boolean(status.error) || !status.data }
  };
}, ["home-feed-snapshot-v2"], { tags: [COLLECTION_RUN_CACHE_TAG] });

export async function getScopedFeed(selection: FeedSelection, { hours = 6, limit = 80, offset = 0, asOf = "" } = {}) {
  return buildFeedPage(await getFeedSnapshot(hours, asOf), selection, { hours, limit, offset });
}
