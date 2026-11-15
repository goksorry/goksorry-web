import {
  buildFeedScoreOverview,
  buildOverallFromSourceGroupSummaries,
  buildSourceGroupSummaries,
  type FeedRow,
  type SourceGroupCollectionStatus
} from "@/lib/feed-data";
import { getSourceGroupId, matchesSourceName, type SourceGroupId } from "@/lib/feed-source-groups";
import type { MarketAdjustmentSnapshot } from "@/lib/community-market-adjustment";

export const WORLD_BUCKET_MS = 10 * 60_000;
export const WORLD_RETENTION_MS = 7 * 24 * 60 * 60_000;
export const WORLD_DAY_MS = 24 * 60 * 60_000;
export const WORLD_SCENES = ["plaza", "ecosystem", "battle", "broadcast", "theater"] as const;
export type WorldScene = (typeof WORLD_SCENES)[number];
export type WorldMood = "hope" | "fear" | "mixed" | "neutral" | "watching";
export type WorldSide = "bullish" | "bearish" | "neutral";
export type WorldSummary = {
  total: number;
  bullish: number;
  bearish: number;
  neutral: number;
  hope_ratio: number | null;
  fear_ratio: number | null;
  mood: WorldMood;
  index: number;
  evidence: Record<WorldSide, FeedRow[]>;
};
export type WorldStock = WorldSummary & { symbol: string; name: string };
export type WorldCommunity = WorldSummary & {
  id: SourceGroupId;
  name: string;
  collection_problem: boolean;
  collection_disabled: boolean;
  collection_reason: string | null;
  top_stock: string | null;
};
export type WorldFrame = {
  version: 1;
  generated_at: string;
  data_at: string | null;
  window_hours: 6;
  overall: WorldSummary;
  communities: WorldCommunity[];
  stocks: WorldStock[];
  collection: { last_run_at: string | null; errors: number; degraded: boolean; unavailable: boolean };
};
export type WorldSlot = { bucket_at: string; frame: WorldFrame | null };
export type WorldReplay = { date: string; timezone: "Asia/Seoul"; slots: WorldSlot[]; error?: string };

export function worldSummary(rows: FeedRow[]): WorldSummary {
  const bullish = rows.filter((row) => row.label === "bullish").length;
  const bearish = rows.filter((row) => row.label === "bearish").length;
  const neutral = rows.length - bullish - bearish;
  const directional = bullish + bearish;
  const hope = directional ? bullish / directional : null;
  const fear = directional ? bearish / directional : null;
  const mood: WorldMood = rows.length < 3 ? "watching" : !directional ? "neutral"
    : hope! >= 0.65 ? "hope" : fear! >= 0.65 ? "fear" : "mixed";
  return {
    total: rows.length, bullish, bearish, neutral, hope_ratio: hope, fear_ratio: fear, mood,
    index: buildFeedScoreOverview(rows).goksorry_index,
    evidence: {
      bullish: rows.filter((row) => row.label === "bullish").slice(0, 3),
      bearish: rows.filter((row) => row.label === "bearish").slice(0, 3),
      neutral: rows.filter((row) => row.label === "neutral").slice(0, 3)
    }
  };
}

export function buildWorldFrame(rows: FeedRow[], options: {
  now?: Date;
  marketAdjustmentSnapshot?: MarketAdjustmentSnapshot | null;
  excludedSourceNames?: ReadonlySet<string>;
  collectionStatuses?: Partial<Record<SourceGroupId, SourceGroupCollectionStatus>>;
  collection?: WorldFrame["collection"];
} = {}): WorldFrame {
  const now = options.now ?? new Date();
  const cutoff = now.getTime() - 6 * 60 * 60_000;
  const unique = new Map<string, FeedRow>();
  for (const row of rows) {
    const at = Date.parse(row.analyzed_at);
    if (at < cutoff || at > now.getTime() || !Number.isFinite(at) || !getSourceGroupId(row.source)) continue;
    if ([...(options.excludedSourceNames ?? [])].some((name) => matchesSourceName(row.source, name))) continue;
    unique.set(row.post_key, row);
  }
  const valid = [...unique.values()].sort((a, b) => b.analyzed_at.localeCompare(a.analyzed_at) || a.post_key.localeCompare(b.post_key));
  const stocksFor = (items: FeedRow[]): WorldStock[] => {
    const groups = new Map<string, FeedRow[]>();
    for (const row of items) {
      if (row.symbol) groups.set(row.symbol, [...(groups.get(row.symbol) ?? []), row]);
    }
    return [...groups].map(([symbol, stockRows]) => ({
      ...worldSummary(stockRows), symbol, name: stockRows[0].symbol_name || symbol
    })).sort((a, b) => b.total - a.total || a.symbol.localeCompare(b.symbol));
  };
  const summaries = buildSourceGroupSummaries(valid, { ...options, asOf: now });
  const overall = worldSummary(valid);
  overall.index = buildOverallFromSourceGroupSummaries(summaries).overall_goksorry_index;
  return {
    version: 1, generated_at: now.toISOString(), data_at: valid[0]?.analyzed_at ?? null, window_hours: 6,
    overall,
    communities: summaries.map((group) => {
      const groupRows = valid.filter((row) => getSourceGroupId(row.source) === group.id);
      return {
        ...worldSummary(groupRows), id: group.id, name: group.shortLabel, index: group.goksorry_index,
        collection_problem: group.collection_problem, collection_disabled: group.collection_disabled,
        collection_reason: group.collection_reason, top_stock: stocksFor(groupRows)[0]?.name ?? null
      };
    }),
    stocks: stocksFor(valid).slice(0, 12),
    collection: options.collection ?? { last_run_at: null, errors: 0, degraded: false, unavailable: false }
  };
}

export function worldHealth(frame: WorldFrame, now = Date.now()): "waiting" | "delayed" | "watching" | "ready" {
  if (!frame.data_at || frame.overall.total === 0) return "waiting";
  if (now - Date.parse(frame.data_at) >= 30 * 60_000) return "delayed";
  return frame.overall.total < 3 ? "watching" : "ready";
}

export const worldBucket = (at: Date): string => new Date(Math.floor(at.getTime() / WORLD_BUCKET_MS) * WORLD_BUCKET_MS).toISOString();
export const worldDate = (at = new Date()): string => new Date(at.getTime() + 9 * 60 * 60_000).toISOString().slice(0, 10);
export function worldDayBounds(date: string): { start: string; end: string } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const start = new Date(`${date}T00:00:00+09:00`);
  if (!Number.isFinite(start.getTime()) || worldDate(start) !== date) return null;
  return { start: start.toISOString(), end: new Date(start.getTime() + WORLD_DAY_MS).toISOString() };
}

export function buildWorldReplay(date: string, snapshots: WorldSlot[]): WorldReplay {
  const bounds = worldDayBounds(date);
  if (!bounds) throw new Error("Invalid replay date");
  // PostgREST returns +00:00 while generated slots use .000Z. Compare instants,
  // not timestamp spellings; otherwise real DB records silently become gaps.
  const byBucket = new Map(snapshots.map((slot) => [Date.parse(slot.bucket_at), slot.frame]));
  return {
    date, timezone: "Asia/Seoul",
    slots: Array.from({ length: 144 }, (_, i) => {
      const bucket_at = new Date(Date.parse(bounds.start) + i * WORLD_BUCKET_MS).toISOString();
      return { bucket_at, frame: byBucket.get(Date.parse(bucket_at)) ?? null };
    })
  };
}

export const MOOD_COPY: Record<WorldMood, string> = {
  hope: "희망 우세", fear: "공포 우세", mixed: "혼조",
  neutral: "중립", watching: "표본 부족 · 3건 미만"
};
export const percent = (ratio: number | null): string => ratio === null ? "—" : `${Math.round(ratio * 100)}%`;
