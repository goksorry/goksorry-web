import type { Metadata } from "next";
import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import Script from "next/script";
import { getServerSession } from "next-auth";
import "@/app/globals.css";
import { AuthControls } from "@/components/auth-controls";
import { CleanFilterFirstVisit } from "@/components/clean-filter-first-visit";
import { AuthSessionProvider } from "@/components/auth-session-provider";
import { CleanFilterOverlay } from "@/components/clean-filter-overlay";
import { CleanFilterProvider } from "@/components/clean-filter-provider";
import { CleanFilterToggle } from "@/components/clean-filter-toggle";
import { FeedSelectionProvider } from "@/components/feed-selection-provider";
import { HeaderNavExtras } from "@/components/header-nav-extras";
import { MarketOverviewShell } from "@/components/market-overview-shell";
import { ProfileSetupRedirect } from "@/components/profile-setup-redirect";
import { SiteFooter } from "@/components/site-footer";
import { ThemeToggle } from "@/components/theme-toggle";
import { authOptions } from "@/lib/auth";

export const metadata: Metadata = {
  title: "곡소리닷컴",
  description: "외부 종목 커뮤니티 감성 피드와 커뮤니티"
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  return (
    <html lang="ko" suppressHydrationWarning>
      <body>
        <Script src="/theme-init.js" strategy="beforeInteractive" />
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
                    <HeaderNavExtras initialSession={session} />
                  </nav>
                </div>
                <div className="header-controls">
                  <ThemeToggle />
                  <CleanFilterToggle />
                </div>
                <div className="header-profile">
                  <Suspense fallback={<button type="button" className="btn header-auth-button" disabled>구글계정으로 로그인</button>}>
                    <AuthControls initialSession={session} />
                  </Suspense>
                </div>
              </header>
              <main className="main">
                <Suspense
                  fallback={
                    <section className="overview-panel">
                      <div className="overview-heading">
                        <div className="overview-heading-copy">
                          <p className="overview-kicker">시장 · 커뮤니티 체감</p>
                          <h2>실시간 체감 지수</h2>
                        </div>
                        <p className="overview-timestamp">캐시 지수 준비 중</p>
                      </div>
                      <div className="overview-top-row">
                        {["KOSPI", "KOSDAQ", "NASDAQ", "원/달러 환율"].map((label) => (
                          <article key={label} className="overview-card overview-card-market overview-tone-flat">
                            <p className="overview-label">{label}</p>
                            <div className="overview-market-main">
                              <strong className="overview-value">로딩중</strong>
                              <p className="overview-delta">로딩중</p>
                            </div>
                            <p className="overview-note">로딩중</p>
                          </article>
                        ))}
                      </div>
                      <div className="overview-bottom-row">
                        {[
                          "네이버종토방 지수",
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
              </div>
            </FeedSelectionProvider>
          </CleanFilterProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
