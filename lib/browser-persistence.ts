import type { CookieConsentChoice } from "@/lib/cookie-consent";
import { isConsentGranted } from "@/lib/cookie-consent";
import {
  CLIENT_PERSISTENCE_DEFINITIONS,
  type ConsentCategory,
  type ClientPersistenceDefinition,
  type CookiePersistenceDefinition,
  type LocalStoragePersistenceDefinition
} from "@/lib/persistence-registry";

const splitDocumentCookies = (): string[] => {
  if (typeof document === "undefined") {
    return [];
  }

  return document.cookie
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);
};

const encodeCookieValue = (value: string): string => encodeURIComponent(value);

const decodeCookieValue = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const buildCookieString = (definition: CookiePersistenceDefinition, value: string, maxAgeSeconds?: number): string => {
  const maxAge = typeof maxAgeSeconds === "number" ? maxAgeSeconds : definition.maxAgeSeconds;
  return `${definition.key}=${encodeCookieValue(value)}; Path=${definition.path}; Max-Age=${maxAge}; SameSite=${definition.sameSite}`;
};

const removeCookieString = (definition: CookiePersistenceDefinition): string => {
  return `${definition.key}=; Path=${definition.path}; Max-Age=0; SameSite=${definition.sameSite}`;
};

const isCategoryAllowed = (category: ConsentCategory, consentChoice?: CookieConsentChoice | null): boolean => {
  return isConsentGranted(category, consentChoice);
};

export const readClientCookieValue = (
  definition: CookiePersistenceDefinition,
  consentChoice?: CookieConsentChoice | null
): string | null => {
  if (!isCategoryAllowed(definition.category, consentChoice)) {
    return null;
  }

  const cookieEntry = splitDocumentCookies().find((entry) => entry.startsWith(`${definition.key}=`));
  if (!cookieEntry) {
    return null;
  }

  return decodeCookieValue(cookieEntry.slice(definition.key.length + 1));
};

export const hasClientCookie = (
  definition: CookiePersistenceDefinition,
  consentChoice?: CookieConsentChoice | null
): boolean => {
  return readClientCookieValue(definition, consentChoice) !== null;
};

export const writeClientCookieValue = (
  definition: CookiePersistenceDefinition,
  value: string,
  consentChoice?: CookieConsentChoice | null
): boolean => {
  if (typeof document === "undefined") {
    return false;
  }

  if (!isCategoryAllowed(definition.category, consentChoice)) {
    document.cookie = removeCookieString(definition);
    return false;
  }

  document.cookie = buildCookieString(definition, value);
  return true;
};

export const removeClientCookie = (definition: CookiePersistenceDefinition): void => {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = removeCookieString(definition);
};

export const readClientLocalStorageValue = (
  definition: LocalStoragePersistenceDefinition,
  consentChoice?: CookieConsentChoice | null
): string | null => {
  if (typeof window === "undefined" || !isCategoryAllowed(definition.category, consentChoice)) {
    return null;
  }

  try {
    return window.localStorage.getItem(definition.key);
  } catch {
    return null;
  }
};

export const writeClientLocalStorageValue = (
  definition: LocalStoragePersistenceDefinition,
  value: string,
  consentChoice?: CookieConsentChoice | null
): boolean => {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    if (!isCategoryAllowed(definition.category, consentChoice)) {
      window.localStorage.removeItem(definition.key);
      return false;
    }

    window.localStorage.setItem(definition.key, value);
    return true;
  } catch {
    return false;
  }
};

export const removeClientLocalStorageValue = (definition: LocalStoragePersistenceDefinition): void => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(definition.key);
  } catch {
    // Ignore storage cleanup failures.
  }
};

export const clearDisallowedClientPersistence = (consentChoice?: CookieConsentChoice | null): void => {
  for (const definition of Object.values(CLIENT_PERSISTENCE_DEFINITIONS)) {
    if (isCategoryAllowed(definition.category, consentChoice)) {
      continue;
    }

    if (definition.kind === "cookie") {
      removeClientCookie(definition);
      continue;
    }

    removeClientLocalStorageValue(definition);
  }
};
