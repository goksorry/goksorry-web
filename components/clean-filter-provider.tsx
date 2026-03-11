"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import {
  CLEAN_FILTER_APPLY_DURATION_MS,
  CLEAN_FILTER_SWITCH_DELAY_MS,
  hasCleanFilterCookieInDocument,
  readCleanFilterFromDocument
} from "@/lib/clean-filter";

type CleanFilterAnimationMode = "pretty" | "grim" | null;

type CleanFilterContextValue = {
  cleanFilterEnabled: boolean;
  isApplying: boolean;
  animationMode: CleanFilterAnimationMode;
  showFirstVisitPrompt: boolean;
  applyCleanFilter: (enabled: boolean) => void;
  dismissFirstVisitPrompt: () => void;
};

const CleanFilterContext = createContext<CleanFilterContextValue | null>(null);

export function CleanFilterProvider({ children }: { children: ReactNode }) {
  const [cleanFilterEnabled, setCleanFilterEnabled] = useState(true);
  const [isApplying, setIsApplying] = useState(false);
  const [animationMode, setAnimationMode] = useState<CleanFilterAnimationMode>(null);
  const [showFirstVisitPrompt, setShowFirstVisitPrompt] = useState(false);
  const switchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
      if (switchTimeoutRef.current) {
        clearTimeout(switchTimeoutRef.current);
      }
      if (finishTimeoutRef.current) {
        clearTimeout(finishTimeoutRef.current);
      }
    };
  }, []);

  const applyCleanFilter = (nextEnabled: boolean) => {
    if (switchTimeoutRef.current) {
      clearTimeout(switchTimeoutRef.current);
    }
    if (finishTimeoutRef.current) {
      clearTimeout(finishTimeoutRef.current);
    }

    setIsApplying(true);
    setAnimationMode(nextEnabled ? "pretty" : "grim");
    switchTimeoutRef.current = setTimeout(() => {
      setCleanFilterEnabled(nextEnabled);
      switchTimeoutRef.current = null;
    }, CLEAN_FILTER_SWITCH_DELAY_MS);
    finishTimeoutRef.current = setTimeout(() => {
      setIsApplying(false);
      setAnimationMode(null);
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
