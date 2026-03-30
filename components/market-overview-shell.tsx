import { getCachedCommunityIndicators, getCachedMarketOverview } from "@/lib/overview-data";
import { MarketOverview } from "@/components/market-overview";

export async function MarketOverviewShell({ marketAdjustmentEnabled = true }: { marketAdjustmentEnabled?: boolean }) {
  const [marketOverview, initialCommunityIndicators] = await Promise.all([
    getCachedMarketOverview(),
    getCachedCommunityIndicators(marketAdjustmentEnabled)
  ]);

  return <MarketOverview marketOverview={marketOverview} initialCommunityIndicators={initialCommunityIndicators} />;
}
