import Image from "next/image";
import Link from "next/link";
import { HeaderAccount } from "@/components/auth-controls";
import { CleanFilterToggle } from "@/components/clean-filter-toggle";
import { HeaderNavExtras } from "@/components/header-nav-extras";
import { ModeSwitch } from "@/components/mode-switch";
import { SiteShareButton } from "@/components/site-share-button";
import { ThemeToggle } from "@/components/theme-toggle";

/** The ant room's menu copy passes `theme={false} account={false}`: the room has no theme and shows the account in its own top bar. */
export function SiteHeader({ theme = true, account = true }: { theme?: boolean; account?: boolean }) {
  return (
    <header className="header">
      <div className="header-main">
        <Link className="brand" href="/">
          <Image className="brand-logo" src="/goksorry_logo.png" alt="곡소리닷컴" width={113} height={50} priority />
        </Link>
        <nav className="nav">
          <Link href="/">홈</Link>
          <Link href="/community" replace>
            게시판
          </Link>
          <Link href="/goksorry-room" replace>
            곡소리방
          </Link>
          <HeaderNavExtras />
        </nav>
        <ModeSwitch />
      </div>
      <div className="header-controls">
        {theme && <ThemeToggle />}
        <CleanFilterToggle />
      </div>
      <div className="header-profile">
        <SiteShareButton />
        {account && <HeaderAccount />}
      </div>
    </header>
  );
}
