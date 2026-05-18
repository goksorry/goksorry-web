import { getCachedCommunityIndicators, getCachedMarketOverview } from "@/lib/overview-data";
import { MarketOverview } from "@/components/market-overview";
import type { SourceGroupId } from "@/lib/feed-source-groups";

export async function MarketOverviewShell({
  marketAdjustmentEnabled = true,
  selectedGroupIds
}: {
  marketAdjustmentEnabled?: boolean;
  selectedGroupIds: SourceGroupId[];
}) {
  const [marketOverview, initialCommunityIndicators] = await Promise.all([
    getCachedMarketOverview(),
    getCachedCommunityIndicators(marketAdjustmentEnabled)
  ]);

  return (
    <MarketOverview
      marketOverview={marketOverview}
      initialCommunityIndicators={initialCommunityIndicators}
      initialMarketAdjustmentEnabled={marketAdjustmentEnabled}
      initialSelectedGroupIds={selectedGroupIds}
    />
  );
}
