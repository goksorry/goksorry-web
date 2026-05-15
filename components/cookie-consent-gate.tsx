"use client";

import type { ReactNode } from "react";
import type { ConsentCategory } from "@/lib/persistence-registry";
import { useCookieConsent } from "@/components/cookie-consent-provider";

type CookieConsentGateProps = {
  category: ConsentCategory;
  children: ReactNode;
  fallback?: ReactNode;
};

export function CookieConsentGate({ category, children, fallback = null }: CookieConsentGateProps) {
  const { isReady, isConsentGranted } = useCookieConsent();

  if (!isReady || !isConsentGranted(category)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
