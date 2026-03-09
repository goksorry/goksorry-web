import { getCachedMarketOverview } from "@/lib/overview-data";
import { MarketOverview } from "@/components/market-overview";

export async function MarketOverviewShell() {
  const marketOverview = await getCachedMarketOverview();
  return <MarketOverview marketOverview={marketOverview} />;
}
