"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import {
  CLEAN_FILTER_APPLY_DURATION_MS,
  hasCleanFilterCookieInDocument,
  readCleanFilterFromDocument
} from "@/lib/clean-filter";

type CleanFilterAnimationMode = "pretty" | "grim" | null;
type CleanFilterAnimationOrigin = {
  x: number;
  y: number;
};

type CleanFilterContextValue = {
  cleanFilterEnabled: boolean;
  isApplying: boolean;
  animationMode: CleanFilterAnimationMode;
  animationOrigin: CleanFilterAnimationOrigin | null;
  showFirstVisitPrompt: boolean;
  applyCleanFilter: (enabled: boolean, origin?: CleanFilterAnimationOrigin) => void;
  dismissFirstVisitPrompt: () => void;
};

const CleanFilterContext = createContext<CleanFilterContextValue | null>(null);

const getFallbackAnimationOrigin = (): CleanFilterAnimationOrigin => {
  if (typeof window === "undefined") {
    return { x: 0, y: 0 };
  }

  return {
    x: window.innerWidth / 2,
    y: window.innerHeight / 2
  };
};

export function CleanFilterProvider({ children }: { children: ReactNode }) {
  const [cleanFilterEnabled, setCleanFilterEnabled] = useState(true);
  const [isApplying, setIsApplying] = useState(false);
  const [animationMode, setAnimationMode] = useState<CleanFilterAnimationMode>(null);
  const [animationOrigin, setAnimationOrigin] = useState<CleanFilterAnimationOrigin | null>(null);
  const [showFirstVisitPrompt, setShowFirstVisitPrompt] = useState(false);
  const finishTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!hasCleanFilterCookieInDocument()) {
      setShowFirstVisitPrompt(true);
      return;
    }

    setCleanFilterEnabled(readCleanFilterFromDocument());
  }, []);

  useEffect(() => {
    return () => {
      if (finishTimeoutRef.current) {
        clearTimeout(finishTimeoutRef.current);
      }
    };
  }, []);

  const applyCleanFilter = (nextEnabled: boolean, origin?: CleanFilterAnimationOrigin) => {
    if (finishTimeoutRef.current) {
      clearTimeout(finishTimeoutRef.current);
    }

    setCleanFilterEnabled(nextEnabled);
    setIsApplying(true);
    setAnimationMode(nextEnabled ? "pretty" : "grim");
    setAnimationOrigin(origin ?? getFallbackAnimationOrigin());
    finishTimeoutRef.current = setTimeout(() => {
      setIsApplying(false);
      setAnimationMode(null);
      setAnimationOrigin(null);
      finishTimeoutRef.current = null;
    }, CLEAN_FILTER_APPLY_DURATION_MS);
  };

  const dismissFirstVisitPrompt = () => {
    setShowFirstVisitPrompt(false);
  };

  return (
    <CleanFilterContext.Provider
      value={{
        cleanFilterEnabled,
        isApplying,
        animationMode,
        animationOrigin,
        showFirstVisitPrompt,
        applyCleanFilter,
        dismissFirstVisitPrompt
      }}
    >
      {children}
    </CleanFilterContext.Provider>
  );
}

export const useCleanFilter = (): CleanFilterContextValue => {
  const context = useContext(CleanFilterContext);
  if (!context) {
    throw new Error("useCleanFilter must be used within CleanFilterProvider");
  }
  return context;
};
