"use client";

import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AuthControls, HeaderAuthSkeleton } from "@/components/auth-controls";
import { CleanFilterToggle } from "@/components/clean-filter-toggle";
import { HeaderNavExtras } from "@/components/header-nav-extras";
import { SiteShareButton } from "@/components/site-share-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { useCleanFilter } from "@/components/clean-filter-provider";
import { useSessionSnapshot } from "@/components/use-session-snapshot";
import { getThemeFamilyIcon, type ThemeFamily, type ThemeOption, type ThemeShellType } from "@/lib/theme";

export type ShellRoute = {
  href: string;
  label: string;
  fileName: string;
  cell: string;
  formula: string;
};

export type ThemeShellProps = {
  children: ReactNode;
  option: ThemeOption;
  chatSidebar: ReactNode;
};

export const SHELL_ROUTES: ShellRoute[] = [
  { href: "/", label: "피드", fileName: "feed.goksorry", cell: "A1", formula: "GOKSORRY.FEED()" },
  { href: "/community", label: "게시판", fileName: "board.goksorry", cell: "B2", formula: "GOKSORRY.BOARD()" },
  { href: "/goksorry-room", label: "곡소리방", fileName: "room.goksorry", cell: "C3", formula: "GOKSORRY.ROOM()" },
  { href: "/docs", label: "문서", fileName: "api.docs", cell: "D4", formula: "GOKSORRY.DOCS()" },
  { href: "/terms", label: "약관", fileName: "terms.md", cell: "E5", formula: "GOKSORRY.POLICY(\"terms\")" },
  { href: "/privacy", label: "개인정보", fileName: "privacy.md", cell: "F6", formula: "GOKSORRY.POLICY(\"privacy\")" }
];

type IconName =
  | "archive"
  | "bold"
  | "chart"
  | "clipboard"
  | "code"
  | "copy"
  | "database"
  | "debug"
  | "document"
  | "file"
  | "find"
  | "grid"
  | "layout"
  | "play"
  | "search"
  | "settings"
  | "spark"
  | "table";

export const normalizePath = (pathname: string): string => {
  if (pathname !== "/" && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }

  return pathname;
};

export const isRouteActive = (pathname: string, href: string): boolean => {
  const path = normalizePath(pathname);
  if (href === "/") {
    return path === "/";
  }

  return path === href || path.startsWith(`${href}/`);
};

export const getCurrentRoute = (pathname: string): ShellRoute => {
  return SHELL_ROUTES.find((route) => isRouteActive(pathname, route.href)) ?? SHELL_ROUTES[0];
};

export const useShellRoute = () => {
  const pathname = usePathname();

  return {
    pathname,
    currentRoute: getCurrentRoute(pathname)
  };
};

export function ShellIcon({ name }: { name: IconName }) {
  const commonProps = {
    className: "theme-shell-icon",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    "aria-hidden": true
  };

  if (name === "bold") {
    return (
      <svg {...commonProps}>
        <path d="M8 4h5.4a3.2 3.2 0 0 1 0 6.4H8z" />
        <path d="M8 10.4h6a3.8 3.8 0 1 1 0 7.6H8z" />
      </svg>
    );
  }

  if (name === "chart") {
    return (
      <svg {...commonProps}>
        <path d="M5 19V5" />
        <path d="M5 19h14" />
        <path d="m7 15 3-4 3 2 4-6" />
      </svg>
    );
  }

  if (name === "clipboard") {
    return (
      <svg {...commonProps}>
        <path d="M9 5h6l1 2h2v12H6V7h2z" />
        <path d="M9 5a3 3 0 0 1 6 0" />
      </svg>
    );
  }

  if (name === "code") {
    return (
      <svg {...commonProps}>
        <path d="m9 7-4 5 4 5" />
        <path d="m15 7 4 5-4 5" />
      </svg>
    );
  }

  if (name === "database") {
    return (
      <svg {...commonProps}>
        <ellipse cx="12" cy="6" rx="6" ry="3" />
        <path d="M6 6v6c0 1.7 2.7 3 6 3s6-1.3 6-3V6" />
        <path d="M6 12v6c0 1.7 2.7 3 6 3s6-1.3 6-3v-6" />
      </svg>
    );
  }

  if (name === "debug") {
    return (
      <svg {...commonProps}>
        <path d="M8 8h8v6a4 4 0 0 1-8 0z" />
        <path d="M9 4l2 2" />
        <path d="m15 4-2 2" />
        <path d="M4 13h4" />
        <path d="M16 13h4" />
      </svg>
    );
  }

  if (name === "document") {
    return (
      <svg {...commonProps}>
        <path d="M7 3h7l4 4v14H7z" />
        <path d="M14 3v5h4" />
        <path d="M9 12h6" />
        <path d="M9 16h6" />
      </svg>
    );
  }

  if (name === "find" || name === "search") {
    return (
      <svg {...commonProps}>
        <circle cx="10.5" cy="10.5" r="5.5" />
        <path d="m15 15 4 4" />
      </svg>
    );
  }

  if (name === "grid" || name === "table") {
    return (
      <svg {...commonProps}>
        <rect x="4" y="5" width="16" height="14" rx="1" />
        <path d="M4 10h16" />
        <path d="M4 15h16" />
        <path d="M9 5v14" />
        <path d="M15 5v14" />
      </svg>
    );
  }

  if (name === "layout") {
    return (
      <svg {...commonProps}>
        <rect x="4" y="5" width="16" height="14" rx="1" />
        <path d="M9 5v14" />
        <path d="M9 10h11" />
      </svg>
    );
  }

  if (name === "play") {
    return (
      <svg {...commonProps}>
        <path d="M8 5v14l11-7z" />
      </svg>
    );
  }

  if (name === "settings") {
    return (
      <svg {...commonProps}>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 3v3" />
        <path d="M12 18v3" />
        <path d="m4.2 7.5 2.6 1.5" />
        <path d="m17.2 15 2.6 1.5" />
        <path d="m19.8 7.5-2.6 1.5" />
        <path d="m6.8 15-2.6 1.5" />
      </svg>
    );
  }

  if (name === "spark") {
    return (
      <svg {...commonProps}>
        <path d="M12 3 9.8 9.8 3 12l6.8 2.2L12 21l2.2-6.8L21 12l-6.8-2.2z" />
      </svg>
    );
  }

  if (name === "archive") {
    return (
      <svg {...commonProps}>
        <path d="M5 7h14v13H5z" />
        <path d="M4 4h16v3H4z" />
        <path d="M9 11h6" />
      </svg>
    );
  }

  if (name === "copy") {
    return (
      <svg {...commonProps}>
        <rect x="8" y="8" width="10" height="12" rx="1.5" />
        <path d="M6 16H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" />
      </svg>
    );
  }

  return (
    <svg {...commonProps}>
      <path d="M7 3h7l4 4v14H7z" />
      <path d="M14 3v5h4" />
    </svg>
  );
}

export function ShellBrand({ family, productName }: { family: ThemeFamily; productName: string }) {
  const icon = family === "default" ? null : getThemeFamilyIcon(family);

  return (
    <div className="theme-shell-brand-wrap">
      {icon ? (
        <img
          className="theme-shell-brand-icon"
          src={icon.href}
          alt={`${icon.label} 컨셉 아이콘`}
          width={20}
          height={20}
          data-testid="theme-shell-brand-icon"
        />
      ) : null}
      <Link className="theme-shell-brand" href="/" aria-label="곡소리닷컴 홈">
        곡소리닷컴
      </Link>
      <span className="theme-shell-product-name">{productName}</span>
    </div>
  );
}

export function ShellNavLinks({ className = "theme-shell-nav" }: { className?: string }) {
  return (
    <nav className={className} aria-label="사이트 메뉴">
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
  );
}

export function ShellHeaderActions() {
  return (
    <div className="theme-shell-actions" data-testid="concept-header-actions">
      <ThemeToggle />
      <CleanFilterToggle />
      <SiteShareButton />
      <Suspense fallback={<HeaderAuthSkeleton />}>
        <AuthControls />
      </Suspense>
    </div>
  );
}

export function ShellCommandButton({
  label,
  icon = "file",
  active = false
}: {
  label: string;
  icon?: IconName;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      className={`theme-shell-command${active ? " theme-shell-command-active" : ""}`}
      aria-label={`${label} mock command`}
    >
      <ShellIcon name={icon} />
      <span>{label}</span>
    </button>
  );
}

export function RouteLinks({
  pathname,
  className,
  fileNames = false,
  numbered = false
}: {
  pathname: string;
  className: string;
  fileNames?: boolean;
  numbered?: boolean;
}) {
  return (
    <nav className={className} aria-label="컨셉 테마 경로">
      {SHELL_ROUTES.map((route, index) => (
        <Link key={route.href} href={route.href} className={isRouteActive(pathname, route.href) ? "theme-shell-active" : ""}>
          {numbered ? `${index + 1}. ` : null}
          {fileNames ? route.fileName : route.label}
        </Link>
      ))}
    </nav>
  );
}

export function ShellStatusBar({ option, shellType, currentRoute }: { option: ThemeOption; shellType: ThemeShellType; currentRoute: ShellRoute }) {
  const { cleanFilterEnabled } = useCleanFilter();
  const { authenticated, user } = useSessionSnapshot();
  const loginLabel = authenticated ? user?.nickname ?? user?.email ?? "member" : "guest";

  return (
    <div className="theme-shell-status" data-testid="program-status-bar">
      <span>{shellType}</span>
      <span>{currentRoute.label}</span>
      <span>{option.label}</span>
      <span>예쁜말 {cleanFilterEnabled ? "ON" : "OFF"}</span>
      <span>{loginLabel}</span>
    </div>
  );
}

export function WindowDots() {
  return (
    <div className="theme-shell-window-dots" aria-hidden="true">
      <span />
      <span />
      <span />
    </div>
  );
}
