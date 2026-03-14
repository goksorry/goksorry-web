import { PolicyChangeBannerClient } from "@/components/policy-change-banner-client";
import { getActivePolicyChange } from "@/lib/policy-changes";

export async function PolicyChangeBanner() {
  const change = await getActivePolicyChange();

  if (!change) {
    return null;
  }

  return <PolicyChangeBannerClient change={change} />;
}
