import type { Metadata } from "next";
import { Suspense } from "react";
import { Gowun_Batang } from "next/font/google";
import Script from "next/script";
import { getServerSession } from "next-auth";
import "@/app/globals.css";
import "@/app/theme-tokens.css";
import "@/app/theme-shells.css";
import "@/app/theme-excel.css";
import "@/app/theme-powerpoint.css";
import "@/app/theme-docs.css";
import "@/app/theme-vscode.css";
import "@/app/theme-jetbrains.css";
import "@/app/theme-visual-studio.css";
import { AnalyticsScripts } from "@/components/analytics-scripts";
import { ChatDock } from "@/components/chat-dock";
import { CookieConsentBanner } from "@/components/cookie-consent-banner";
import { CookieConsentProvider } from "@/components/cookie-consent-provider";
import { CleanFilterFirstVisit } from "@/components/clean-filter-first-visit";
import { AuthSessionProvider } from "@/components/auth-session-provider";
import { CleanFilterOverlay } from "@/components/clean-filter-overlay";
import { CleanFilterProvider } from "@/components/clean-filter-provider";
import { PolicyChangeBanner } from "@/components/policy-change-banner";
import { ProfileSetupRedirect } from "@/components/profile-setup-redirect";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ThemeChrome } from "@/components/theme-shells";
import { ThemeFirstVisit } from "@/components/theme-first-visit";
import { ThemeProvider } from "@/components/theme-provider";
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
              <ThemeProvider>
                <CleanFilterOverlay />
                <CleanFilterFirstVisit />
                <ThemeFirstVisit />
                <ThemeChrome
                  defaultHeader={<SiteHeader />}
                  policyBanner={<PolicyChangeBanner />}
                  footer={<SiteFooter />}
                  chatDock={<ChatDock enabled={chatEnv.enabled} />}
                >
                  <main className="main">
                    <Suspense fallback={null}>
                      <ProfileSetupRedirect />
                    </Suspense>
                    {children}
                  </main>
                </ThemeChrome>
                <CookieConsentBanner />
              </ThemeProvider>
            </CleanFilterProvider>
          </CookieConsentProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
