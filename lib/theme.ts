import { CLIENT_PERSISTENCE_DEFINITIONS } from "@/lib/persistence-registry";

export type ThemeMode = "light" | "dark" | "system";

export const THEME_STORAGE_DEFINITION = CLIENT_PERSISTENCE_DEFINITIONS.themeMode;

export const isThemeMode = (value: string | null): value is ThemeMode => {
  return value === "light" || value === "dark" || value === "system";
};

export const applyThemeMode = (mode: ThemeMode): void => {
  const root = document.documentElement;
  if (mode === "system") {
    root.removeAttribute("data-theme");
    return;
  }

  root.setAttribute("data-theme", mode);
};

export const getThemeInitScript = (): string => {
  return `(() => {
    try {
      const value = window.localStorage.getItem(${JSON.stringify(THEME_STORAGE_DEFINITION.key)});
      const root = document.documentElement;

      if (value === "light" || value === "dark") {
        root.setAttribute("data-theme", value);
        return;
      }

      root.removeAttribute("data-theme");
    } catch {
      document.documentElement.removeAttribute("data-theme");
    }
  })();`;
};
