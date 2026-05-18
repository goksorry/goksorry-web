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
  showThemePrompt: boolean;
  selectTheme: (themeId: ThemeId) => void;
  dismissThemePrompt: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const persistThemePreference = (themeId: ThemeId): void => {
  writeClientCookieValue(THEME_COOKIE_DEFINITION, themeId);
  writeClientLocalStorageValue(THEME_STORAGE_DEFINITION, themeId);
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

function ThemeUrlSync({ themeId }: { themeId: ThemeId }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamsString = searchParams.toString();

  useEffect(() => {
    replaceCurrentUrlThemeParam(themeId);
  }, [pathname, searchParamsString, themeId]);

  return null;
}

export function ThemeProvider({ children, initialThemeId }: { children: ReactNode; initialThemeId: ThemeId }) {
  const { showFirstVisitPrompt, isApplying } = useCleanFilter();
  const [themeId, setThemeId] = useState<ThemeId>(initialThemeId);
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
      if (!hasThemeParam && stored.hasStoredPreference) {
        persistThemePreference(nextTheme);
      }
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

  const dismissThemePrompt = () => {
    selectTheme(themeId);
  };

  return (
    <ThemeContext.Provider
      value={{
        themeId,
        showThemePrompt,
        selectTheme,
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
