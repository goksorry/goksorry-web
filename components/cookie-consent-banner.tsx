"use client";

import Link from "next/link";
import { useCookieConsent } from "@/components/cookie-consent-provider";

export function CookieConsentBanner() {
  const { bannerVisible, closeConsentSettings, consentChoice, setConsentChoice } = useCookieConsent();

  if (!bannerVisible) {
    return null;
  }

  return (
    <section className="cookie-consent-banner" role="dialog" aria-modal="false" aria-labelledby="cookie-consent-title">
      <div className="cookie-consent-copy">
        <p className="cookie-consent-kicker">쿠키 안내</p>
        <h2 id="cookie-consent-title">필수 쿠키와 선택 쿠키를 구분해서 사용합니다.</h2>
        <p className="muted">
          필수 쿠키는 로그인 상태 유지, 보안, 테마, 예쁜말 필터, 시장 보정, 비회원 채팅 세션과 닉네임 같은 서비스 동작에 사용합니다. 선택
          쿠키는 방문 통계와 서비스 개선에만 사용합니다.
        </p>
        <p className="muted">
          자세한 내용은 <Link href="/privacy">개인정보처리방침</Link>에서 확인할 수 있습니다.
        </p>
        {consentChoice ? (
          <p className="muted">현재 선택: {consentChoice === "all" ? "필수 + 선택 쿠키 허용" : "필수 쿠키만 사용"}</p>
        ) : null}
      </div>
      <div className="cookie-consent-actions">
        <button type="button" className="btn btn-secondary" onClick={() => setConsentChoice("essential")}>
          필수만 사용
        </button>
        <button type="button" className="btn" onClick={() => setConsentChoice("all")}>
          모두 허용
        </button>
        {consentChoice ? (
          <button type="button" className="btn btn-secondary" onClick={closeConsentSettings}>
            닫기
          </button>
        ) : null}
      </div>
    </section>
  );
}
