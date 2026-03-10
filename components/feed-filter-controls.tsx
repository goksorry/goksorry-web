"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  SOURCE_GROUPS,
  SOURCE_GROUP_IDS,
  serializeSourceGroupSelection,
  type SourceGroupId
} from "@/lib/feed-source-groups";

const buildFeedHref = ({
  groupIds,
  range
}: {
  groupIds: SourceGroupId[];
  range: string;
}): string => {
  const params = new URLSearchParams();
  const serializedGroups = serializeSourceGroupSelection(groupIds);
  if (serializedGroups) {
    params.set("channels", serializedGroups);
  }
  if (range && range !== "24h") {
    params.set("range", range);
  }
  const query = params.toString();
  return query ? `/?${query}` : "/";
};

const arraysEqual = (left: SourceGroupId[], right: SourceGroupId[]): boolean => {
  return left.length === right.length && left.every((item, index) => right[index] === item);
};

export function FeedFilterControls({
  selectedGroupIds,
  selectedRange
}: {
  selectedGroupIds: SourceGroupId[];
  selectedRange: string;
}) {
  const router = useRouter();
  const [pendingGroupIds, setPendingGroupIds] = useState<SourceGroupId[]>(selectedGroupIds);
  const [range, setRange] = useState(selectedRange);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedKey = useMemo(() => selectedGroupIds.join(","), [selectedGroupIds]);

  useEffect(() => {
    setPendingGroupIds(selectedGroupIds);
  }, [selectedKey, selectedGroupIds]);

  useEffect(() => {
    setRange(selectedRange);
  }, [selectedRange]);

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

    debounceRef.current = setTimeout(() => {
      router.replace(buildFeedHref({ groupIds: nextGroupIds, range }));
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

  const onApplyRange = () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    router.push(buildFeedHref({ groupIds: pendingGroupIds, range }));
  };

  const allSelected = arraysEqual(pendingGroupIds, SOURCE_GROUP_IDS);
  const noneSelected = pendingGroupIds.length === 0;

  return (
    <div className="feed-filter-toolbar">
      <div className="feed-channel-buttons" aria-label="커뮤니티 묶음">
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

      <div className="actions feed-range-actions">
        <label className="inline">
          <span>범위</span>
          <select value={range} onChange={(event) => setRange(event.target.value)}>
            <option value="1h">1h</option>
            <option value="6h">6h</option>
            <option value="24h">24h</option>
          </select>
        </label>

        <button type="button" onClick={onApplyRange}>
          적용
        </button>
        <Link className="btn btn-secondary" href="/">
          초기화
        </Link>
      </div>
    </div>
  );
}
