import type { Metadata } from "next";
import { Suspense } from "react";
import Image from "next/image";
import { Gowun_Batang } from "next/font/google";
import Link from "next/link";
import Script from "next/script";
import { getServerSession } from "next-auth";
import "@/app/globals.css";
import { AnalyticsScripts } from "@/components/analytics-scripts";
import { AuthControls, HeaderAuthSkeleton } from "@/components/auth-controls";
import { ChatDock } from "@/components/chat-dock";
import { CookieConsentBanner } from "@/components/cookie-consent-banner";
import { CookieConsentProvider } from "@/components/cookie-consent-provider";
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
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/seo";
import { getThemeInitScript } from "@/lib/theme";

const googleAnalyticsMeasurementId = "G-9X029VJV3K";

// next/font metadata for Gowun Batang does not expose a korean preload subset.
const gowunBatang = Gowun_Batang({
  weight: ["400", "700"],
  display: "swap",
  preload: false,
  variable: "--font-gowun-batang"
});

export const metadata: Metadata = {
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`
  },
  description: SITE_DESCRIPTION,
  metadataBase: new URL(SITE_URL),
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "ko_KR",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    images: [
      {
        url: "/goksorry_logo.png",
        alt: `${SITE_NAME} 로고`
      }
    ]
  },
  twitter: {
    card: "summary",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: ["/goksorry_logo.png"]
  }
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const chatEnv = getChatServerEnv();
  const session = await getServerSession(authOptions);

  return (
    <html lang="ko" suppressHydrationWarning>
      <body className={gowunBatang.variable}>
        <Script id="theme-init" strategy="beforeInteractive">
          {getThemeInitScript()}
        </Script>
        <AuthSessionProvider session={session}>
          <CookieConsentProvider>
            <AnalyticsScripts measurementId={googleAnalyticsMeasurementId} />
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
                        게시판
                      </Link>
                      <Link href="/goksorry-room" replace>
                        곡소리방
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
              <CookieConsentBanner />
            </CleanFilterProvider>
          </CookieConsentProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
