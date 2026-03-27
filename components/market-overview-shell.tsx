import { getCachedCommunityIndicators, getCachedMarketOverview } from "@/lib/overview-data";
import { MarketOverview } from "@/components/market-overview";

export async function MarketOverviewShell() {
  const [marketOverview, initialCommunityIndicators] = await Promise.all([
    getCachedMarketOverview(),
    getCachedCommunityIndicators()
  ]);

  return <MarketOverview marketOverview={marketOverview} initialCommunityIndicators={initialCommunityIndicators} />;
}
