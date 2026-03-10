export const CLEAN_FILTER_COOKIE = "goksorry-clean-filter";

export const isCleanFilterEnabled = (value: string | null | undefined): boolean => {
  return value === "on";
};

export const buildCleanFilterCookie = (enabled: boolean): string => {
  return `${CLEAN_FILTER_COOKIE}=${enabled ? "on" : "off"}; Path=/; Max-Age=31536000; SameSite=Lax`;
};

export const readCleanFilterFromDocument = (): boolean => {
  if (typeof document === "undefined") {
    return false;
  }

  const cookie = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${CLEAN_FILTER_COOKIE}=`));

  if (!cookie) {
    return false;
  }

  return isCleanFilterEnabled(cookie.split("=").slice(1).join("="));
};

export const pickDisplayTitle = ({
  title,
  cleanTitle,
  cleanFilterEnabled
}: {
  title: string;
  cleanTitle?: string | null;
  cleanFilterEnabled: boolean;
}): string => {
  if (cleanFilterEnabled && cleanTitle) {
    return cleanTitle;
  }

  return title;
};
