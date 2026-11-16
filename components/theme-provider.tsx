"use client";

import { Suspense, createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
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
  THEME_STORAGE_DEFINITION,
  applyThemeMode,
  getThemeOption,
  isWorldPath,
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
  /** A theme came from the URL or a stored choice, so classic pages carry it as ?theme=. */
  themeInUrl: boolean;
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
  // The metaverse room has no theme (see WORLD_THEME_ID): no theme prompt there, and its root switches with the route.
  const pathname = usePathname(), world = isWorldPath(pathname);
  const [themeId, setThemeId] = useState<ThemeId>(initialThemeId);
  const [changeColorMode, setChangeColorMode] = useState<ChangeColorMode>(initialChangeColorMode);
  const [promptPending, setPromptPending] = useState(false);
  const [showThemePrompt, setShowThemePrompt] = useState(false);
  const [urlSyncEnabled, setUrlSyncEnabled] = useState(false);
  // The room drops ?theme= from its URL, so the theme it arrived with is held here: for the classic pages, for a later
  // popstate back into the room and for the effect's own re-run (which would otherwise fall back to the stored theme).
  const roomTheme = useRef<ThemeId | null>(null);

  // Entering or leaving the room swaps the root between the fixed world look and the chosen theme, before paint so the
  // new page never shows a frame in the other one's colours. Runs before the location sync, whose choice wins on mount.
  useLayoutEffect(() => {
    applyThemeMode(themeId, pathname);
  }, [world]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const syncThemeFromLocation = () => {
      const inRoom = isWorldPath(window.location.pathname), urlTheme = readThemeParamFromLocation();
      if (inRoom && urlTheme) roomTheme.current = urlTheme;
      const paramTheme = urlTheme ?? (inRoom ? roomTheme.current : null);
      const hasThemeParam = paramTheme !== null;
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

    setShowThemePrompt(!showFirstVisitPrompt && !isApplying && !world);
  }, [isApplying, promptPending, showFirstVisitPrompt, world]);

  const selectTheme = (nextThemeId: ThemeId) => {
    roomTheme.current = null;
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
        themeInUrl: urlSyncEnabled,
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
