import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import Script from "next/script";
import "@/app/globals.css";
import { AuthControls } from "@/components/auth-controls";
import { AuthSessionProvider } from "@/components/auth-session-provider";
import { CleanFilterOverlay } from "@/components/clean-filter-overlay";
import { CleanFilterProvider } from "@/components/clean-filter-provider";
import { CleanFilterToggle } from "@/components/clean-filter-toggle";
import { HeaderNavExtras } from "@/components/header-nav-extras";
import { MarketOverviewShell } from "@/components/market-overview-shell";
import { ProfileSetupRedirect } from "@/components/profile-setup-redirect";
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata: Metadata = {
  title: "곡소리닷컴",
  description: "외부 종목 커뮤니티 감성 피드와 커뮤니티"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body>
        <Script src="/theme-init.js" strategy="beforeInteractive" />
        <AuthSessionProvider>
          <CleanFilterProvider>
            <CleanFilterOverlay />
            <div id="page-top" className="layout">
              <header className="header">
                <nav className="nav">
                  <Link className="brand" href="/">
                    곡소리닷컴
                  </Link>
                  <Link href="/" replace>
                    피드
                  </Link>
                  <Link href="/community" replace>
                    커뮤니티
                  </Link>
                  <HeaderNavExtras />
                </nav>
                <div className="auth">
                  <ThemeToggle />
                  <CleanFilterToggle />
                  <Suspense fallback={<button type="button" disabled>구글계정으로 로그인</button>}>
                    <AuthControls />
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
                          "디시 주갤·국장갤·미장갤 지수"
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
                  <ProfileSetupRedirect />
                </Suspense>
                {children}
              </main>
            </div>
          </CleanFilterProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
