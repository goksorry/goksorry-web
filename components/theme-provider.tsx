"use client";

import { Suspense, createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  readClientCookieValue,
  readClientLocalStorageValue,
  writeClientCookieValue,
  writeClientLocalStorageValue
} from "@/lib/browser-persistence";
import {
  CHANGE_COLOR_MODE_COOKIE_DEFINITION,
  CHANGE_COLOR_MODE_STORAGE_DEFINITION,
  DEFAULT_CHANGE_COLOR_MODE,
  applyChangeColorMode,
  normalizeChangeColorMode,
  type ChangeColorMode
} from "@/lib/change-color-mode";
import {
  DEFAULT_THEME_ID,
  THEME_COOKIE_DEFINITION,
  THEME_PARAM_NAME,
  THEME_STORAGE_DEFINITION,
  applyThemeMode,
  getThemeOption,
  normalizeThemeId,
  readThemeParamFromLocation,
  replaceCurrentUrlThemeParam,
  type ThemeId
} from "@/lib/theme";
import { useCleanFilter } from "@/components/clean-filter-provider";

type ThemeContextValue = {
  themeId: ThemeId;
  changeColorMode: ChangeColorMode;
  showThemePrompt: boolean;
  selectTheme: (themeId: ThemeId) => void;
  selectChangeColorMode: (mode: ChangeColorMode) => void;
  dismissThemePrompt: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const persistThemePreference = (themeId: ThemeId): void => {
  writeClientCookieValue(THEME_COOKIE_DEFINITION, themeId);
  writeClientLocalStorageValue(THEME_STORAGE_DEFINITION, themeId);
};

const persistChangeColorModePreference = (mode: ChangeColorMode): void => {
  writeClientCookieValue(CHANGE_COLOR_MODE_COOKIE_DEFINITION, mode);
  writeClientLocalStorageValue(CHANGE_COLOR_MODE_STORAGE_DEFINITION, mode);
};

const readStoredThemeId = (): { themeId: ThemeId | null; hasStoredPreference: boolean } => {
  const cookie = readClientCookieValue(THEME_COOKIE_DEFINITION);
  if (cookie) {
    const themeId = normalizeThemeId(cookie);
    return {
      themeId: themeId ?? DEFAULT_THEME_ID,
      hasStoredPreference: true
    };
  }

  const stored = readClientLocalStorageValue(THEME_STORAGE_DEFINITION);
  if (!stored) {
    return {
      themeId: null,
      hasStoredPreference: false
    };
  }

  const themeId = normalizeThemeId(stored);
  return {
    themeId: themeId ?? DEFAULT_THEME_ID,
    hasStoredPreference: true
  };
};

const readStoredChangeColorMode = (): ChangeColorMode => {
  const cookie = readClientCookieValue(CHANGE_COLOR_MODE_COOKIE_DEFINITION);
  if (cookie) {
    return normalizeChangeColorMode(cookie) ?? DEFAULT_CHANGE_COLOR_MODE;
  }

  const stored = readClientLocalStorageValue(CHANGE_COLOR_MODE_STORAGE_DEFINITION);
  return normalizeChangeColorMode(stored) ?? DEFAULT_CHANGE_COLOR_MODE;
};

function ThemeUrlSync({ themeId }: { themeId: ThemeId }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamsString = searchParams.toString();

  useEffect(() => {
    replaceCurrentUrlThemeParam(themeId);
  }, [pathname, searchParamsString, themeId]);

  return null;
}

export function ThemeProvider({
  children,
  initialThemeId,
  initialChangeColorMode
}: {
  children: ReactNode;
  initialThemeId: ThemeId;
  initialChangeColorMode: ChangeColorMode;
}) {
  const { showFirstVisitPrompt, isApplying } = useCleanFilter();
  const [themeId, setThemeId] = useState<ThemeId>(initialThemeId);
  const [changeColorMode, setChangeColorMode] = useState<ChangeColorMode>(initialChangeColorMode);
  const [promptPending, setPromptPending] = useState(false);
  const [showThemePrompt, setShowThemePrompt] = useState(false);
  const [urlSyncEnabled, setUrlSyncEnabled] = useState(false);

  useEffect(() => {
    const syncThemeFromLocation = () => {
      const hasThemeParam = new URLSearchParams(window.location.search).has(THEME_PARAM_NAME);
      const paramTheme = readThemeParamFromLocation();
      const stored = readStoredThemeId();
      const nextTheme = paramTheme ?? stored.themeId ?? initialThemeId;
      const shouldSyncUrl = hasThemeParam || stored.hasStoredPreference;

      setThemeId(nextTheme);
      applyThemeMode(nextTheme);
      const nextChangeColorMode = readStoredChangeColorMode();
      setChangeColorMode(nextChangeColorMode);
      applyChangeColorMode(nextChangeColorMode);
      if (!hasThemeParam && stored.hasStoredPreference) {
        persistThemePreference(nextTheme);
      }
      persistChangeColorModePreference(nextChangeColorMode);
      setPromptPending(!hasThemeParam && !stored.hasStoredPreference);
      setShowThemePrompt(false);
      setUrlSyncEnabled(shouldSyncUrl);
      if (shouldSyncUrl) {
        replaceCurrentUrlThemeParam(nextTheme);
      }
    };

    syncThemeFromLocation();
    window.addEventListener("popstate", syncThemeFromLocation);
    return () => {
      window.removeEventListener("popstate", syncThemeFromLocation);
    };
  }, [initialThemeId]);

  useEffect(() => {
    const option = getThemeOption(themeId);
    if (option.tone !== "system" || typeof window === "undefined" || !window.matchMedia) {
      return;
    }

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      applyThemeMode(themeId);
    };

    media.addEventListener("change", handleChange);
    return () => {
      media.removeEventListener("change", handleChange);
    };
  }, [themeId]);

  useEffect(() => {
    if (!promptPending) {
      setShowThemePrompt(false);
      return;
    }

    setShowThemePrompt(!showFirstVisitPrompt && !isApplying);
  }, [isApplying, promptPending, showFirstVisitPrompt]);

  const selectTheme = (nextThemeId: ThemeId) => {
    setThemeId(nextThemeId);
    applyThemeMode(nextThemeId);
    persistThemePreference(nextThemeId);
    replaceCurrentUrlThemeParam(nextThemeId);
    setUrlSyncEnabled(true);
    setPromptPending(false);
    setShowThemePrompt(false);
  };

  const selectChangeColorMode = (mode: ChangeColorMode) => {
    setChangeColorMode(mode);
    applyChangeColorMode(mode);
    persistChangeColorModePreference(mode);
  };

  const dismissThemePrompt = () => {
    selectTheme(themeId);
  };

  return (
    <ThemeContext.Provider
      value={{
        themeId,
        changeColorMode,
        showThemePrompt,
        selectTheme,
        selectChangeColorMode,
        dismissThemePrompt
      }}
    >
      {urlSyncEnabled ? (
        <Suspense fallback={null}>
          <ThemeUrlSync themeId={themeId} />
        </Suspense>
      ) : null}
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }

  return context;
};
