import type { Metadata } from "next";
import { headers } from "next/headers";
import { Suspense } from "react";
import { Gowun_Batang } from "next/font/google";
import Script from "next/script";
import "@/app/globals.css";
import "@/app/theme-tokens.css";
import "@/app/theme-shells.css";
import "@/app/theme-excel.css";
import "@/app/theme-powerpoint.css";
import "@/app/theme-docs.css";
import "@/app/theme-vscode.css";
import "@/app/theme-jetbrains.css";
import { AnalyticsScripts } from "@/components/analytics-scripts";
import { ChatDock } from "@/components/chat-dock";
import { ChatSidebar } from "@/components/chat-sidebar";
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
import { ThemeFavicon } from "@/components/theme-favicon";
import { ThemeFirstVisit } from "@/components/theme-first-visit";
import { ThemeProvider } from "@/components/theme-provider";
import { getChatServerEnv } from "@/lib/env";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/seo";
import { DEFAULT_THEME_ID, THEME_REQUEST_HEADER, getThemeAttributeValues, getThemeInitScript, normalizeThemeId } from "@/lib/theme";

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const chatEnv = getChatServerEnv();
  const requestHeaders = headers();
  const initialThemeId = normalizeThemeId(requestHeaders.get(THEME_REQUEST_HEADER)) ?? DEFAULT_THEME_ID;
  const initialThemeAttributes = getThemeAttributeValues(initialThemeId, "light");

  return (
    <html
      lang="ko"
      suppressHydrationWarning
      data-theme-id={initialThemeAttributes.themeId}
      data-theme={initialThemeAttributes.theme}
      data-theme-shell={initialThemeAttributes.shell}
      data-theme-family={initialThemeAttributes.family}
      data-theme-tone={initialThemeAttributes.tone}
      data-theme-effective-tone={initialThemeAttributes.effectiveTone}
    >
      <body className={gowunBatang.variable}>
        <Script id="theme-init" strategy="beforeInteractive">
          {getThemeInitScript()}
        </Script>
        <AuthSessionProvider>
          <CookieConsentProvider>
            <AnalyticsScripts measurementId={googleAnalyticsMeasurementId} />
            <CleanFilterProvider>
              <ThemeProvider initialThemeId={initialThemeId}>
                <ThemeFavicon />
                <CleanFilterOverlay />
                <CleanFilterFirstVisit />
                <ThemeFirstVisit />
                <ThemeChrome
                  defaultHeader={<SiteHeader />}
                  policyBanner={
                    <Suspense fallback={null}>
                      <PolicyChangeBanner />
                    </Suspense>
                  }
                  footer={<SiteFooter />}
                  mobileChatDock={<ChatDock enabled={chatEnv.enabled} />}
                  desktopChatSidebar={<ChatSidebar enabled={chatEnv.enabled} />}
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
