"use client";

import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useFeedSelection } from "@/components/feed-selection-provider";
import {
  SOURCE_GROUPS,
  SOURCE_GROUP_IDS,
  type SourceGroupId
} from "@/lib/feed-source-groups";
import { serializeSourceGroupSelection } from "@/lib/feed-source-groups";

const buildFeedHref = ({ groupIds }: { groupIds: SourceGroupId[] }): string => {
  const params = new URLSearchParams();
  const serializedGroups = serializeSourceGroupSelection(groupIds);
  if (serializedGroups) {
    params.set("channels", serializedGroups);
  }
  const query = params.toString();
  return query ? `/?${query}` : "/";
};

const arraysEqual = (left: SourceGroupId[], right: SourceGroupId[]): boolean => {
  return left.length === right.length && left.every((item, index) => right[index] === item);
};

export function FeedFilterControls({ selectedGroupIds }: { selectedGroupIds: SourceGroupId[] }) {
  const router = useRouter();
  const { activeGroupIds, setOptimisticGroupIds } = useFeedSelection();
  const [pendingGroupIds, setPendingGroupIds] = useState<SourceGroupId[]>(selectedGroupIds);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedKey = useMemo(() => activeGroupIds.join(","), [activeGroupIds]);

  useEffect(() => {
    setPendingGroupIds(activeGroupIds);
  }, [selectedKey, activeGroupIds]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const scheduleApply = (nextGroupIds: SourceGroupId[]) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    setOptimisticGroupIds(nextGroupIds);
    debounceRef.current = setTimeout(() => {
      startTransition(() => {
        router.replace(buildFeedHref({ groupIds: nextGroupIds }), { scroll: false });
      });
    }, 500);
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
        {SOURCE_GROUPS.map((group) => (
          <button
            key={group.id}
            type="button"
            className={`filter-chip ${pendingGroupIds.includes(group.id) ? "filter-chip-active" : ""}`}
            onClick={() => onToggleGroup(group.id)}
          >
            {group.shortLabel}
          </button>
        ))}
      </div>
    </div>
  );
}
