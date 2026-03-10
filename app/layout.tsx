import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import "@/app/globals.css";
import { AuthControls } from "@/components/auth-controls";
import { AuthSessionProvider } from "@/components/auth-session-provider";
import { HeaderNavExtras } from "@/components/header-nav-extras";
import { MarketOverviewShell } from "@/components/market-overview-shell";
import { ProfileSetupRedirect } from "@/components/profile-setup-redirect";

export const metadata: Metadata = {
  title: "곡소리닷컴",
  description: "외부 종목 커뮤니티 감성 피드와 커뮤니티"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <AuthSessionProvider>
          <div id="page-top" className="layout">
            <header className="header">
              <nav className="nav">
                <Link className="brand" href="/">
                  곡소리닷컴
                </Link>
                <Link href="/">피드</Link>
                <Link href="/community">커뮤니티</Link>
                <HeaderNavExtras />
              </nav>
              <div className="auth">
                <Suspense fallback={<button type="button" disabled>구글 로그인</button>}>
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
        </AuthSessionProvider>
      </body>
    </html>
  );
}
