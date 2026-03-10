"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { readCleanFilterFromDocument } from "@/lib/clean-filter";

type CleanFilterContextValue = {
  cleanFilterEnabled: boolean;
  setCleanFilterEnabled: (enabled: boolean) => void;
};

const CleanFilterContext = createContext<CleanFilterContextValue | null>(null);

export function CleanFilterProvider({ children }: { children: ReactNode }) {
  const [cleanFilterEnabled, setCleanFilterEnabled] = useState(false);

  useEffect(() => {
    setCleanFilterEnabled(readCleanFilterFromDocument());
  }, []);

  return (
    <CleanFilterContext.Provider
      value={{
        cleanFilterEnabled,
        setCleanFilterEnabled
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
