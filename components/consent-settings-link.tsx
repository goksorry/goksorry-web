"use client";

import { useEffect, useState } from "react";

type ConsentSettingsLinkProps = {
  className?: string;
  label?: string;
};

declare global {
  interface Window {
    googlefc?: {
      callbackQueue?: Array<(() => void) | { CONSENT_API_READY?: () => void }>;
      showRevocationMessage?: () => void;
    };
  }
}

export function ConsentSettingsLink({
  className,
  label = "개인정보 및 쿠키 설정"
}: ConsentSettingsLinkProps) {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.googlefc = window.googlefc ?? {};
    window.googlefc.callbackQueue = window.googlefc.callbackQueue ?? [];
    window.googlefc.callbackQueue.push({
      CONSENT_API_READY: () => {
        setIsReady(true);
      }
    });
  }, []);

  const handleClick = () => {
    if (typeof window === "undefined") {
      return;
    }

    window.googlefc = window.googlefc ?? {};
    window.googlefc.callbackQueue = window.googlefc.callbackQueue ?? [];

    if (window.googlefc.showRevocationMessage) {
      window.googlefc.showRevocationMessage();
      return;
    }

    window.googlefc.callbackQueue.push({
      CONSENT_API_READY: () => {
        window.googlefc?.showRevocationMessage?.();
      }
    });
  };

  if (!isReady) {
    return null;
  }

  return (
    <button type="button" className={className} onClick={handleClick}>
      {label}
    </button>
  );
}
