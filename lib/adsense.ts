const DEFAULT_ADSENSE_ACCOUNT = "ca-pub-0419198986672065";
const GOOGLE_ADSENSE_SELLER_ID = "f08c47fec0942fa0";

export const getAdsenseAccount = (): string | null => {
  const account = process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_ACCOUNT?.trim() ?? "";
  return account || DEFAULT_ADSENSE_ACCOUNT;
};

export const getAdsensePublisherId = (): string | null => {
  const account = getAdsenseAccount();
  if (!account) {
    return null;
  }

  return account.startsWith("ca-") ? account.slice(3) : account;
};

export const getAdsenseAdsTxt = (): string | null => {
  const customAdsTxt = process.env.GOOGLE_ADSENSE_ADS_TXT?.trim() ?? "";
  if (customAdsTxt) {
    return customAdsTxt;
  }

  const publisherId = getAdsensePublisherId();
  if (!publisherId) {
    return null;
  }

  return `google.com, ${publisherId}, DIRECT, ${GOOGLE_ADSENSE_SELLER_ID}`;
};
