import { CLIENT_PERSISTENCE_DEFINITIONS, type ConsentCategory } from "@/lib/persistence-registry";

export const COOKIE_CONSENT_COOKIE = CLIENT_PERSISTENCE_DEFINITIONS.cookieConsent.key;

export type CookieConsentChoice = "essential" | "all";

const COOKIE_CONSENT_VERSION = "v1";

export const isConsentGranted = (
  category: ConsentCategory,
  choice: CookieConsentChoice | null | undefined
): boolean => {
  return category === "essential" || choice === "all";
};

export const parseCookieConsentValue = (value: string | null | undefined): CookieConsentChoice | null => {
  if (!value) {
    return null;
  }

  const [version, choice] = value.split(":");

  if (version !== COOKIE_CONSENT_VERSION) {
    return null;
  }

  return choice === "essential" || choice === "all" ? choice : null;
};

export const serializeCookieConsentValue = (choice: CookieConsentChoice): string => {
  return `${COOKIE_CONSENT_VERSION}:${choice}`;
};

const decodeCookieValue = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const findCookieConsentCookie = (): string | null => {
  if (typeof document === "undefined") {
    return null;
  }

  return (
    document.cookie
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${COOKIE_CONSENT_COOKIE}=`)) ?? null
  );
};

export const readCookieConsentFromDocument = (): CookieConsentChoice | null => {
  const cookie = findCookieConsentCookie();

  if (!cookie) {
    return null;
  }

  return parseCookieConsentValue(decodeCookieValue(cookie.split("=").slice(1).join("=")));
};

export const isAnalyticsConsentGranted = (choice: CookieConsentChoice | null | undefined): boolean => {
  return isConsentGranted("analytics", choice);
};
