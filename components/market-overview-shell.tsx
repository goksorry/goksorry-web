import { getCachedCommunityIndicators, getCachedMarketOverview } from "@/lib/overview-data";
import { MarketOverview } from "@/components/market-overview";
import type { SourceGroupId } from "@/lib/feed-source-groups";

export async function MarketOverviewShell({
  selectedGroupIds
}: {
  selectedGroupIds: SourceGroupId[];
}) {
  const [marketOverview, initialCommunityIndicators] = await Promise.all([
    getCachedMarketOverview(),
    getCachedCommunityIndicators()
  ]);

  return (
    <MarketOverview
      marketOverview={marketOverview}
      initialCommunityIndicators={initialCommunityIndicators}
      initialSelectedGroupIds={selectedGroupIds}
    />
  );
}
