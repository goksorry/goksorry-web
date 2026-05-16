"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { readClientLocalStorageValue, writeClientLocalStorageValue } from "@/lib/browser-persistence";
import {
  DEFAULT_THEME_ID,
  THEME_PARAM_NAME,
  THEME_STORAGE_DEFINITION,
  applyThemeMode,
  getThemeOption,
  normalizeThemeId,
  readThemeParamFromLocation,
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

const readStoredThemeId = (): { themeId: ThemeId | null; hasStoredPreference: boolean } => {
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

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { showFirstVisitPrompt, isApplying } = useCleanFilter();
  const [themeId, setThemeId] = useState<ThemeId>(DEFAULT_THEME_ID);
  const [promptPending, setPromptPending] = useState(false);
  const [showThemePrompt, setShowThemePrompt] = useState(false);

  useEffect(() => {
    const syncThemeFromLocation = () => {
      const hasThemeParam = new URLSearchParams(window.location.search).has(THEME_PARAM_NAME);
      const paramTheme = readThemeParamFromLocation();
      const stored = readStoredThemeId();
      const nextTheme = paramTheme ?? stored.themeId ?? DEFAULT_THEME_ID;

      setThemeId(nextTheme);
      applyThemeMode(nextTheme);
      setPromptPending(!hasThemeParam && !stored.hasStoredPreference);
      setShowThemePrompt(false);
    };

    syncThemeFromLocation();
    window.addEventListener("popstate", syncThemeFromLocation);
    return () => {
      window.removeEventListener("popstate", syncThemeFromLocation);
    };
  }, []);

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
    writeClientLocalStorageValue(THEME_STORAGE_DEFINITION, nextThemeId);
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
