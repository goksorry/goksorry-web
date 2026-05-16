import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { AuthControls, HeaderAuthSkeleton } from "@/components/auth-controls";
import { CleanFilterToggle } from "@/components/clean-filter-toggle";
import { HeaderNavExtras } from "@/components/header-nav-extras";
import { SiteShareButton } from "@/components/site-share-button";
import { ThemeToggle } from "@/components/theme-toggle";

export function SiteHeader() {
  return (
    <header className="header">
      <div className="header-main">
        <Link className="brand" href="/">
          <Image className="brand-logo" src="/goksorry_logo.png" alt="곡소리닷컴" width={113} height={50} priority />
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
  );
}
