"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useTheme } from "@/components/theme-provider";
import { WORLD_THEME_ID, getThemeFamilyIcon, getThemeOption, isWorldPath } from "@/lib/theme";

export function ThemeFavicon() {
  const { themeId } = useTheme();
  // The room has no theme, so it keeps the site's own icon.
  const shownThemeId = isWorldPath(usePathname()) ? WORLD_THEME_ID : themeId;

  useEffect(() => {
    const option = getThemeOption(shownThemeId);
    const icon = getThemeFamilyIcon(option.family);
    let link = document.querySelector<HTMLLinkElement>('link[data-theme-favicon="true"]');

    if (!link) {
      link = document.createElement("link");
      link.dataset.themeFavicon = "true";
      document.head.appendChild(link);
    }

    link.rel = "icon";
    link.href = icon.href;
    link.type = icon.mimeType;

    if (icon.mimeType === "image/svg+xml") {
      link.setAttribute("sizes", "any");
    } else {
      link.removeAttribute("sizes");
    }
  }, [shownThemeId]);

  return null;
}
