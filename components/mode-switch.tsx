"use client";
import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useTheme } from "@/components/theme-provider";
import { THEME_PARAM_NAME } from "@/lib/theme";

function Links({ search }: { search: URLSearchParams | null }) {
  const metaverse = usePathname() === "/";
  const { themeId, themeInUrl } = useTheme();
  // Keep only the feed scope when switching layouts; the room has no theme, so only the classic link carries a chosen one.
  const scope = new URLSearchParams();
  for (const key of ["channels", "channel", "stock"]) { const value = search?.get(key); if (value) scope.set(key, value); }
  const query = scope.size ? `?${scope}` : "";
  const classic = new URLSearchParams(scope); if (themeInUrl) classic.set(THEME_PARAM_NAME, themeId);
  return <nav className="mode-switch" aria-label="화면 모드">
    <Link href={`/classic${classic.size ? `?${classic}` : ""}`} aria-current={metaverse ? undefined : "page"}>일반<span>모드</span></Link>
    <Link href={`/${query}`} aria-current={metaverse ? "page" : undefined}>메타버스<span>모드</span></Link>
  </nav>;
}
function ScopedLinks() { return <Links search={useSearchParams()} />; }

/** Header toggle between the classic page layout ("/classic") and the metaverse room ("/"). */
export function ModeSwitch() {
  return <Suspense fallback={<Links search={null} />}><ScopedLinks /></Suspense>;
}
