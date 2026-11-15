"use client";
import { useEffect, useState } from "react";
import { MarketOverview } from "@/components/market-overview";
import type { OverviewPayload } from "@/lib/overview-data";
import type { SourceGroupId } from "@/lib/feed-source-groups";
export default function WorldIndex({ selectedGroupIds }: { selectedGroupIds: SourceGroupId[] }) {
  const [payload, setPayload] = useState<OverviewPayload | null>(null);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      if (document.hidden) return;
      try {
        const response = await fetch("/api/internal/overview", { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error("overview");
        setPayload(await response.json()); setFailed(false);
      } catch { if (!controller.signal.aborted) setFailed(true); }
    };
    void load();
    const visibility = () => { if (!document.hidden && !payload) void load(); };
    document.addEventListener("visibilitychange", visibility);
    return () => { controller.abort(); document.removeEventListener("visibilitychange", visibility); };
  }, [retry]); // MarketOverview owns refresh once loaded.
  if (!payload) return <p className="world-note">{failed ? "지수를 불러오지 못했습니다." : "지수 확인 중…"} {failed && <button onClick={() => setRetry((n) => n + 1)}>다시 시도</button>}</p>;
  return <MarketOverview marketOverview={payload} initialCommunityIndicators={payload} initialSelectedGroupIds={selectedGroupIds} />;
}
