import type { Metadata } from "next";
import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import Script from "next/script";
import { getServerSession } from "next-auth";
import "@/app/globals.css";
import { AuthControls, HeaderAuthSkeleton } from "@/components/auth-controls";
import { ChatDock } from "@/components/chat-dock";
import { CleanFilterFirstVisit } from "@/components/clean-filter-first-visit";
import { AuthSessionProvider } from "@/components/auth-session-provider";
import { CleanFilterOverlay } from "@/components/clean-filter-overlay";
import { CleanFilterProvider } from "@/components/clean-filter-provider";
import { CleanFilterToggle } from "@/components/clean-filter-toggle";
import { HeaderChatLink } from "@/components/header-chat-link";
import { HeaderNavExtras } from "@/components/header-nav-extras";
import { PolicyChangeBanner } from "@/components/policy-change-banner";
import { ProfileSetupRedirect } from "@/components/profile-setup-redirect";
import { SiteShareButton } from "@/components/site-share-button";
import { SiteFooter } from "@/components/site-footer";
import { ThemeToggle } from "@/components/theme-toggle";
import { authOptions } from "@/lib/auth";
import { getChatServerEnv } from "@/lib/env";

const googleAnalyticsMeasurementId = "G-9X029VJV3K";

export const metadata: Metadata = {
  title: "곡소리닷컴",
  description: "외부 종목 커뮤니티 감성 피드와 커뮤니티",
  metadataBase: new URL("https://goksorry.com")
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const chatEnv = getChatServerEnv();
  const session = await getServerSession(authOptions);

  return (
    <html lang="ko" suppressHydrationWarning>
      <body>
        <Script async strategy="afterInteractive" src={`https://www.googletagmanager.com/gtag/js?id=${googleAnalyticsMeasurementId}`} />
        <Script id="google-analytics-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${googleAnalyticsMeasurementId}');
          `}
        </Script>
        <Script src="/theme-init.js" strategy="beforeInteractive" />
        <AuthSessionProvider session={session}>
          <CleanFilterProvider>
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
                    <HeaderChatLink />
                    <HeaderNavExtras />
                  </nav>
                </div>
                <div className="header-controls">
                  <ThemeToggle />
                  <CleanFilterToggle />
                </div>
                <div className="header-profile">
                  <SiteShareButton />
                  <Suspense fallback={<HeaderAuthSkeleton />}>
                    <AuthControls />
                  </Suspense>
                </div>
              </header>
              <PolicyChangeBanner />
              <main className="main">
                <Suspense fallback={null}>
                  <ProfileSetupRedirect />
                </Suspense>
                {children}
              </main>
              <SiteFooter />
              <ChatDock enabled={chatEnv.enabled} />
            </div>
          </CleanFilterProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
