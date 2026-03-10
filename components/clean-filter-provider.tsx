"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { hasCleanFilterCookieInDocument, readCleanFilterFromDocument } from "@/lib/clean-filter";

type CleanFilterAnimationMode = "pretty" | "grim" | null;

type CleanFilterContextValue = {
  cleanFilterEnabled: boolean;
  setCleanFilterEnabled: (enabled: boolean) => void;
  isApplying: boolean;
  animationMode: CleanFilterAnimationMode;
  showFirstVisitPrompt: boolean;
  beginApply: (nextEnabled: boolean) => void;
  finishApply: () => void;
  dismissFirstVisitPrompt: () => void;
};

const CleanFilterContext = createContext<CleanFilterContextValue | null>(null);

export function CleanFilterProvider({ children }: { children: ReactNode }) {
  const [cleanFilterEnabled, setCleanFilterEnabled] = useState(true);
  const [isApplying, setIsApplying] = useState(false);
  const [animationMode, setAnimationMode] = useState<CleanFilterAnimationMode>(null);
  const [showFirstVisitPrompt, setShowFirstVisitPrompt] = useState(false);

  useEffect(() => {
    if (!hasCleanFilterCookieInDocument()) {
      setShowFirstVisitPrompt(true);
      return;
    }

    setCleanFilterEnabled(readCleanFilterFromDocument());
  }, []);

  const beginApply = (nextEnabled: boolean) => {
    setCleanFilterEnabled(nextEnabled);
    setIsApplying(true);
    setAnimationMode(nextEnabled ? "pretty" : "grim");
  };

  const finishApply = () => {
    setIsApplying(false);
    setAnimationMode(null);
  };

  const dismissFirstVisitPrompt = () => {
    setShowFirstVisitPrompt(false);
  };

  return (
    <CleanFilterContext.Provider
      value={{
        cleanFilterEnabled,
        setCleanFilterEnabled,
        isApplying,
        animationMode,
        showFirstVisitPrompt,
        beginApply,
        finishApply,
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
