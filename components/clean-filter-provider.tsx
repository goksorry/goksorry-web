"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { readCleanFilterFromDocument } from "@/lib/clean-filter";

type CleanFilterAnimationMode = "pretty" | "grim" | null;

type CleanFilterContextValue = {
  cleanFilterEnabled: boolean;
  setCleanFilterEnabled: (enabled: boolean) => void;
  isApplying: boolean;
  animationMode: CleanFilterAnimationMode;
  beginApply: (nextEnabled: boolean) => void;
  finishApply: () => void;
};

const CleanFilterContext = createContext<CleanFilterContextValue | null>(null);

export function CleanFilterProvider({ children }: { children: ReactNode }) {
  const [cleanFilterEnabled, setCleanFilterEnabled] = useState(true);
  const [isApplying, setIsApplying] = useState(false);
  const [animationMode, setAnimationMode] = useState<CleanFilterAnimationMode>(null);
  const animationTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    setCleanFilterEnabled(readCleanFilterFromDocument());
  }, []);

  useEffect(() => {
    return () => {
      if (animationTimeoutRef.current !== null) {
        window.clearTimeout(animationTimeoutRef.current);
      }
    };
  }, []);

  const beginApply = (nextEnabled: boolean) => {
    setCleanFilterEnabled(nextEnabled);
    setIsApplying(true);
    setAnimationMode(nextEnabled ? "pretty" : "grim");

    if (animationTimeoutRef.current !== null) {
      window.clearTimeout(animationTimeoutRef.current);
    }

    animationTimeoutRef.current = window.setTimeout(() => {
      setAnimationMode(null);
      animationTimeoutRef.current = null;
    }, 1000);
  };

  const finishApply = () => {
    setIsApplying(false);
  };

  return (
    <CleanFilterContext.Provider
      value={{
        cleanFilterEnabled,
        setCleanFilterEnabled,
        isApplying,
        animationMode,
        beginApply,
        finishApply
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
