"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { SourceGroupId } from "@/lib/feed-source-groups";

type FeedSelectionContextValue = {
  activeGroupIds: SourceGroupId[];
  setOptimisticGroupIds: (groupIds: SourceGroupId[] | null) => void;
};

const FeedSelectionContext = createContext<FeedSelectionContextValue | null>(null);

export function FeedSelectionProvider({
  children,
  initialGroupIds
}: {
  children: ReactNode;
  initialGroupIds: SourceGroupId[];
}) {
  const [optimisticGroupIds, setOptimisticGroupIds] = useState<SourceGroupId[] | null>(null);

  useEffect(() => {
    setOptimisticGroupIds(null);
  }, [initialGroupIds]);

  return (
    <FeedSelectionContext.Provider
      value={{
        activeGroupIds: optimisticGroupIds ?? initialGroupIds,
        setOptimisticGroupIds
      }}
    >
      {children}
    </FeedSelectionContext.Provider>
  );
}

export const useFeedSelection = (): FeedSelectionContextValue => {
  const context = useContext(FeedSelectionContext);
  if (!context) {
    throw new Error("useFeedSelection must be used within FeedSelectionProvider");
  }
  return context;
};
