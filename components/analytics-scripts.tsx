"use client";

import { useEffect } from "react";
import Script from "next/script";
import { CookieConsentGate } from "@/components/cookie-consent-gate";
import { useCookieConsent } from "@/components/cookie-consent-provider";
import { GOOGLE_ANALYTICS_COOKIE_PREFIXES } from "@/lib/persistence-registry";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
    [key: `ga-disable-${string}`]: boolean | undefined;
  }
}

const clearCookieEverywhere = (name: string) => {
  if (typeof document === "undefined") {
    return;
  }

  const hostname = typeof window === "undefined" ? "" : window.location.hostname;
  const hostParts = hostname.split(".").filter(Boolean);
  const domains = new Set<string>(["", hostname ? `.${hostname}` : "", hostname]);

  for (let index = 0; index < hostParts.length - 1; index += 1) {
    const suffix = hostParts.slice(index).join(".");
    domains.add(suffix);
    domains.add(`.${suffix}`);
  }

  for (const domain of domains) {
    const domainPart = domain ? `; Domain=${domain}` : "";
    document.cookie = `${name}=; Max-Age=0; Path=/${domainPart}; SameSite=Lax`;
  }
};

const clearGoogleAnalyticsCookies = () => {
  if (typeof document === "undefined") {
    return;
  }

  for (const cookieName of document.cookie.split(";").map((part) => part.trim().split("=")[0] ?? "")) {
    if (!cookieName || !GOOGLE_ANALYTICS_COOKIE_PREFIXES.some((prefix) => cookieName === prefix || cookieName.startsWith(`${prefix}_`))) {
      continue;
    }

    clearCookieEverywhere(cookieName);
  }
};

export function AnalyticsScripts({ measurementId }: { measurementId: string }) {
  const { analyticsAllowed } = useCookieConsent();

  useEffect(() => {
    const disableKey = `ga-disable-${measurementId}` as const;
    window[disableKey] = !analyticsAllowed;

    if (!analyticsAllowed) {
      clearGoogleAnalyticsCookies();
      if (typeof window.gtag === "function") {
        window.gtag("consent", "update", { analytics_storage: "denied" });
      }
      return;
    }

    if (typeof window.gtag === "function") {
      window.gtag("consent", "update", { analytics_storage: "granted" });
    }
  }, [analyticsAllowed, measurementId]);

  return (
    <CookieConsentGate category="analytics">
      <>
        <Script async strategy="afterInteractive" src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`} />
        <Script id="google-analytics-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            window.gtag = gtag;
            gtag('js', new Date());
            gtag('consent', 'default', { analytics_storage: 'granted' });
            gtag('config', '${measurementId}');
          `}
        </Script>
      </>
    </CookieConsentGate>
  );
}
