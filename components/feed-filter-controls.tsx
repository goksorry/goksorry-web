"use client";

import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useFeedSelection } from "@/components/feed-selection-provider";
import {
  SOURCE_GROUPS,
  SOURCE_GROUP_IDS,
  type SourceGroupId
} from "@/lib/feed-source-groups";
import { serializeSourceGroupSelection } from "@/lib/feed-source-groups";

const buildFeedHref = ({ groupIds, baseSearch, pathname }: { groupIds: SourceGroupId[]; baseSearch: string; pathname: string }): string => {
  const params = new URLSearchParams(baseSearch);
  const serializedGroups = serializeSourceGroupSelection(groupIds);
  if (serializedGroups) {
    params.set("channels", serializedGroups);
  } else {
    params.delete("channels");
  }
  params.delete("channel");
  params.delete("source");
  const query = params.toString();
  // Stay on the current home (개미인생 "/" or 웹 "/classic").
  const base = pathname === "/classic" ? "/classic" : "/";
  return query ? `${base}?${query}` : base;
};

const arraysEqual = (left: SourceGroupId[], right: SourceGroupId[]): boolean => {
  return left.length === right.length && left.every((item, index) => right[index] === item);
};

/** `grid`: just the four source toggles in one row (the world feed dialog); `toolbar` adds 전체/전체해제. */
export function FeedFilterControls({ selectedGroupIds, variant = "toolbar" }: { selectedGroupIds: SourceGroupId[]; variant?: "toolbar" | "grid" }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { activeGroupIds, setOptimisticGroupIds } = useFeedSelection();
  const [pendingGroupIds, setPendingGroupIds] = useState<SourceGroupId[]>(selectedGroupIds);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingApply = useRef<(() => void) | null>(null);

  const selectedKey = useMemo(() => activeGroupIds.join(","), [activeGroupIds]);

  useEffect(() => {
    setPendingGroupIds(activeGroupIds);
  }, [selectedKey, activeGroupIds]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      // Closing the surrounding dialog right after a change must still apply it.
      pendingApply.current?.();
      pendingApply.current = null;
    };
  }, []);

  const scheduleApply = (nextGroupIds: SourceGroupId[]) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    setOptimisticGroupIds(nextGroupIds);
    const apply = () => {
      pendingApply.current = null;
      startTransition(() => {
        router.push(buildFeedHref({ groupIds: nextGroupIds, baseSearch: searchParams.toString(), pathname }), { scroll: false });
      });
    };
    pendingApply.current = apply;
    debounceRef.current = setTimeout(apply, 500);
  };

  const onToggleGroup = (groupId: SourceGroupId) => {
    const nextGroupIds = pendingGroupIds.includes(groupId)
      ? pendingGroupIds.filter((item) => item !== groupId)
      : SOURCE_GROUP_IDS.filter((item) => item === groupId || pendingGroupIds.includes(item));

    setPendingGroupIds(nextGroupIds);
    scheduleApply(nextGroupIds);
  };

  const onSelectAll = () => {
    setPendingGroupIds(SOURCE_GROUP_IDS);
    scheduleApply(SOURCE_GROUP_IDS);
  };

  const onClearAll = () => {
    setPendingGroupIds([]);
    scheduleApply([]);
  };

  const allSelected = arraysEqual(pendingGroupIds, SOURCE_GROUP_IDS);
  const noneSelected = pendingGroupIds.length === 0;

  const groupButtons = SOURCE_GROUPS.map((group) => (
    <button
      key={group.id}
      type="button"
      className={`filter-chip ${pendingGroupIds.includes(group.id) ? "filter-chip-active" : ""}`}
      aria-pressed={pendingGroupIds.includes(group.id)}
      onClick={() => onToggleGroup(group.id)}
    >
      {group.shortLabel}
    </button>
  ));

  if (variant === "grid") {
    return <div className="feed-channel-buttons feed-source-grid" role="group" aria-label="출처 선택">{groupButtons}</div>;
  }

  return (
    <div className="feed-filter-toolbar">
      <div className="feed-selection-actions" aria-label="전체 선택">
        <button
          type="button"
          className={`filter-chip ${allSelected ? "filter-chip-active" : ""}`}
          onClick={onSelectAll}
        >
          전체
        </button>
        <button
          type="button"
          className={`filter-chip ${noneSelected ? "filter-chip-active" : ""}`}
          onClick={onClearAll}
        >
          전체해제
        </button>
      </div>

      <div className="feed-channel-buttons" aria-label="커뮤니티 묶음">
        {groupButtons}
      </div>
    </div>
  );
}
