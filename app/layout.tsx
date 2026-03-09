import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import "@/app/globals.css";
import { AuthControls } from "@/components/auth-controls";
import { MarketOverview } from "@/components/market-overview";

export const metadata: Metadata = {
  title: "goksorry.com MVP",
  description: "Sentiment feed + community MVP"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="layout">
          <header className="header">
            <nav className="nav">
              <Link className="brand" href="/">
                goksorry.com
              </Link>
              <Link href="/">Feed</Link>
              <Link href="/community">Community</Link>
              <Link href="/admin/reports">Admin Reports</Link>
            </nav>
            <div className="auth">
              <Suspense fallback={<button type="button" disabled>Google Login</button>}>
                <AuthControls />
              </Suspense>
            </div>
          </header>
          <main className="main">
            <Suspense
              fallback={
                <section className="overview-panel">
                  <div className="overview-heading">
                    <div>
                      <p className="overview-kicker">Market & Community Pulse</p>
                      <h2>실시간 체감 지수</h2>
                    </div>
                    <p className="muted">상단 지수를 불러오는 중</p>
                  </div>
                </section>
              }
            >
              <MarketOverview />
            </Suspense>
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
