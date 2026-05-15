"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  isConsentGranted,
  isAnalyticsConsentGranted,
  readCookieConsentFromDocument,
  serializeCookieConsentValue,
  type CookieConsentChoice
} from "@/lib/cookie-consent";
import { clearDisallowedClientPersistence, writeClientCookieValue } from "@/lib/browser-persistence";
import { CLIENT_PERSISTENCE_DEFINITIONS, type ConsentCategory } from "@/lib/persistence-registry";

type CookieConsentContextValue = {
  consentChoice: CookieConsentChoice | null;
  analyticsAllowed: boolean;
  isReady: boolean;
  bannerVisible: boolean;
  isConsentGranted: (category: ConsentCategory) => boolean;
  openConsentSettings: () => void;
  closeConsentSettings: () => void;
  setConsentChoice: (choice: CookieConsentChoice) => void;
};

const CookieConsentContext = createContext<CookieConsentContextValue | null>(null);

export function CookieConsentProvider({ children }: { children: ReactNode }) {
  const [consentChoice, setConsentChoiceState] = useState<CookieConsentChoice | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [bannerOpen, setBannerOpen] = useState(false);

  useEffect(() => {
    setConsentChoiceState(readCookieConsentFromDocument());
    setIsReady(true);
  }, []);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    clearDisallowedClientPersistence(consentChoice);
  }, [consentChoice, isReady]);

  const setConsentChoice = (choice: CookieConsentChoice) => {
    writeClientCookieValue(CLIENT_PERSISTENCE_DEFINITIONS.cookieConsent, serializeCookieConsentValue(choice), choice);
    setConsentChoiceState(choice);
    setBannerOpen(false);
  };

  const value: CookieConsentContextValue = {
    consentChoice,
    analyticsAllowed: isAnalyticsConsentGranted(consentChoice),
    isReady,
    bannerVisible: isReady && (bannerOpen || consentChoice === null),
    isConsentGranted: (category) => isConsentGranted(category, consentChoice),
    openConsentSettings: () => setBannerOpen(true),
    closeConsentSettings: () => setBannerOpen(false),
    setConsentChoice
  };

  return <CookieConsentContext.Provider value={value}>{children}</CookieConsentContext.Provider>;
}

export const useCookieConsent = (): CookieConsentContextValue => {
  const context = useContext(CookieConsentContext);

  if (!context) {
    throw new Error("useCookieConsent must be used within CookieConsentProvider");
  }

  return context;
};
