"use client";

import { useEffect } from "react";
import { useTheme } from "@/components/theme-provider";
import { getThemeFamilyIcon, getThemeOption } from "@/lib/theme";

export function ThemeFavicon() {
  const { themeId } = useTheme();

  useEffect(() => {
    const option = getThemeOption(themeId);
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
  }, [themeId]);

  return null;
}
