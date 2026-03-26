import type { Metadata } from "next";
import { Suspense } from "react";
import Image from "next/image";
import { headers } from "next/headers";
import Link from "next/link";
import Script from "next/script";
import { getServerSession } from "next-auth";
import "@/app/globals.css";
import { AuthControls } from "@/components/auth-controls";
import { ChatDock } from "@/components/chat-dock";
import { CleanFilterFirstVisit } from "@/components/clean-filter-first-visit";
import { AuthSessionProvider } from "@/components/auth-session-provider";
import { CleanFilterOverlay } from "@/components/clean-filter-overlay";
import { CleanFilterProvider } from "@/components/clean-filter-provider";
import { CleanFilterToggle } from "@/components/clean-filter-toggle";
import { FeedSelectionProvider } from "@/components/feed-selection-provider";
import { HeaderNavExtras } from "@/components/header-nav-extras";
import { MarketOverviewShell } from "@/components/market-overview-shell";
import { PolicyChangeBanner } from "@/components/policy-change-banner";
import { ProfileSetupRedirect } from "@/components/profile-setup-redirect";
import { SiteFooter } from "@/components/site-footer";
import { ThemeToggle } from "@/components/theme-toggle";
import { getAdsenseAccount, getAdsenseScriptSrc } from "@/lib/adsense";
import { authOptions } from "@/lib/auth";
import { getChatServerEnv } from "@/lib/env";

const adsenseAccount = getAdsenseAccount();
const adsenseScriptSrc = getAdsenseScriptSrc();
const googleAnalyticsMeasurementId = "G-9X029VJV3K";

export const metadata: Metadata = {
  title: "곡소리닷컴",
  description: "외부 종목 커뮤니티 감성 피드와 커뮤니티",
  metadataBase: new URL("https://goksorry.com"),
  other: adsenseAccount
    ? {
        "google-adsense-account": adsenseAccount
      }
    : undefined
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  const chatEnv = getChatServerEnv();
  const nonce = headers().get("x-nonce") ?? undefined;

  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <script
          async
          nonce={nonce}
          src={`https://www.googletagmanager.com/gtag/js?id=${googleAnalyticsMeasurementId}`}
        />
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${googleAnalyticsMeasurementId}');
            `
          }}
        />
      </head>
      <body>
        <Script src="/theme-init.js" strategy="beforeInteractive" />
        {adsenseAccount ? (
          <Script id="googlefc-init" strategy="beforeInteractive">
            {`window.googlefc = window.googlefc || {}; window.googlefc.callbackQueue = window.googlefc.callbackQueue || [];`}
          </Script>
        ) : null}
        {adsenseScriptSrc ? (
          <Script
            id="google-adsense"
            async
            strategy="afterInteractive"
            src={adsenseScriptSrc}
            crossOrigin="anonymous"
          />
        ) : null}
        <AuthSessionProvider session={session}>
          <CleanFilterProvider>
            <FeedSelectionProvider>
              <CleanFilterOverlay />
              <CleanFilterFirstVisit />
              <div id="page-top" className="layout">
              <header className="header">
                <div className="header-main">
                  <Link className="brand" href="/">
                    <Image
                      className="brand-logo"
                      src="/goksorry_logo.png"
                      alt="곡소리닷컴"
                      width={113}
                      height={50}
                      priority
                    />
                  </Link>
                  <nav className="nav">
                    <Link href="/" replace>
                      피드
                    </Link>
                    <Link href="/community" replace>
                      커뮤니티
                    </Link>
                    <Link href="/chat" replace>
                      채팅
                    </Link>
                    <HeaderNavExtras initialSession={session} />
                  </nav>
                </div>
                <div className="header-controls">
                  <ThemeToggle />
                  <CleanFilterToggle />
                </div>
                <div className="header-profile">
                  <Suspense
                    fallback={
                      <button
                        type="button"
                        className="btn header-auth-button header-login-button"
                        disabled
                        aria-label="구글 로그인 준비 중"
                        title="구글계정으로 로그인"
                      >
                        <Image src="/google-mark.svg" alt="" width={16} height={16} aria-hidden="true" />
                        <span className="header-auth-emoji" aria-hidden="true">
                          🔐
                        </span>
                      </button>
                    }
                  >
                    <AuthControls initialSession={session} />
                  </Suspense>
                </div>
              </header>
              <PolicyChangeBanner />
              <main className="main">
                <Suspense
                  fallback={
                    <>
                      <section className="overview-market-block">
                        <div className="overview-section-head">
                          <h3>시장</h3>
                          <p className="overview-section-copy">주요 지수와 환율의 최근 흐름</p>
                        </div>
                        <div className="overview-market-row">
                          {["KOSPI", "KOSDAQ", "NASDAQ", "원/달러 환율"].map((label) => (
                            <article key={label} className="overview-card overview-market-stat overview-tone-flat">
                              <p className="overview-label">{label}</p>
                              <div className="overview-market-main">
                                <strong className="overview-value">로딩중</strong>
                                <p className="overview-delta">로딩중</p>
                              </div>
                              <p className="overview-note">로딩중</p>
                            </article>
                          ))}
                        </div>
                      </section>
                      <section className="overview-panel">
                        <div className="overview-hero">
                          <div className="overview-hero-art" aria-hidden="true" />
                          <div className="overview-heading">
                            <div className="overview-heading-copy">
                              <p className="overview-kicker">커뮤니티 체감</p>
                              <h2>실시간 체감 지수</h2>
                              <p className="overview-timestamp">캐시 지수 준비 중</p>
                            </div>
                            <div className="overview-overall-score">
                              <p className="overview-overall-label">최근 6시간 커뮤니티 평균</p>
                              <strong className="overview-overall-value">
                                --<span>/10</span>
                              </strong>
                              <p className="overview-overall-band">계산 중</p>
                            </div>
                          </div>
                        </div>
                        <section className="overview-section">
                          <div className="overview-section-head">
                            <h3>커뮤니티</h3>
                            <p className="overview-section-copy">최근 6시간 채널별 분위기와 언급 흐름</p>
                          </div>
                          <div className="overview-bottom-row">
                            {[
                              "네이버 주주오픈톡 지수",
                              "토스증권 종목커뮤니티 지수",
                              "블라인드 주식투자 지수",
                              "디시 주갤·국장갤·미장갤·해주갤 지수"
                            ].map((label) => (
                              <article key={label} className="overview-card overview-card-community overview-tone-mixed">
                                <div className="overview-community-head">
                                  <p className="overview-label">{label}</p>
                                  <span className="overview-score-badge">로딩중</span>
                                </div>
                                <p className="overview-delta">로딩중</p>
                              </article>
                            ))}
                          </div>
                        </section>
                      </section>
                    </>
                  }
                >
                  <MarketOverviewShell />
                </Suspense>
                <Suspense fallback={null}>
                  <ProfileSetupRedirect initialSession={session} />
                </Suspense>
                {children}
              </main>
              <SiteFooter />
              <ChatDock enabled={chatEnv.enabled} />
              </div>
            </FeedSelectionProvider>
          </CleanFilterProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
