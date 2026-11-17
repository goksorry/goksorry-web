import { PolicyChangeBannerClient } from "@/components/policy-change-banner-client";
import { getActivePolicyChanges } from "@/lib/policy-changes";

export async function PolicyChangeBanner() {
  const changes = await getActivePolicyChanges();
  return <>{changes.map((change) => <PolicyChangeBannerClient key={change.id} change={change} />)}</>;
}
