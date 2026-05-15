"use client";

import { useCookieConsent } from "@/components/cookie-consent-provider";

type CookieConsentButtonProps = {
  className?: string;
};

export function CookieConsentButton({ className = "site-footer-link-button" }: CookieConsentButtonProps) {
  const { openConsentSettings } = useCookieConsent();

  return (
    <button type="button" className={className} onClick={openConsentSettings}>
      쿠키 설정
    </button>
  );
}
