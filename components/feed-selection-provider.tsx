"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname, useSearchParams, type ReadonlyURLSearchParams } from "next/navigation";
import { isSourceGroupId, parseSourceGroupSelection, type SourceGroupId } from "@/lib/feed-source-groups";

type FeedSelectionContextValue = {
  activeGroupIds: SourceGroupId[];
  setOptimisticGroupIds: (groupIds: SourceGroupId[] | null) => void;
};

const FeedSelectionContext = createContext<FeedSelectionContextValue | null>(null);

const getGroupIdsFromSearchParams = (searchParams: ReadonlyURLSearchParams): SourceGroupId[] => {
  const channels = searchParams.get("channels") ?? "";
  const legacyChannel = searchParams.get("channel") ?? "";

  if (channels.length > 0) {
    return parseSourceGroupSelection(channels);
  }

  if (isSourceGroupId(legacyChannel)) {
    return [legacyChannel];
  }

  return parseSourceGroupSelection("");
};

export function FeedSelectionProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();
  const currentGroupIds = getGroupIdsFromSearchParams(searchParams);
  const [optimisticGroupIds, setOptimisticGroupIds] = useState<SourceGroupId[] | null>(null);

  useEffect(() => {
    setOptimisticGroupIds(null);
  }, [pathname, searchKey]);

  return (
    <FeedSelectionContext.Provider
      value={{
        activeGroupIds: optimisticGroupIds ?? currentGroupIds,
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
