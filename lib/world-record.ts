import type { WorldCommunity, WorldFrame, WorldStock, WorldSummary } from "./world";

/**
 * What the theater keeps of a WorldFrame (`world_snapshots.frame`, still version 1): index data only. Counts, ratios,
 * 곡소리 지수, mood, names and ids, timestamps and collection status; never a post (title, URL, author, text).
 * Fields are copied by name, so a field later added to the live frame is not stored until it is listed here.
 */
export type RecordSummary = Omit<WorldSummary, "evidence">;
export type WorldRecord = Omit<WorldFrame, "overall" | "communities" | "stocks"> & {
  overall: RecordSummary;
  communities: (Omit<WorldCommunity, "evidence">)[];
  stocks: (Omit<WorldStock, "evidence">)[];
};

const summaryOf = (s: WorldSummary | RecordSummary): RecordSummary => ({
  total: s.total, bullish: s.bullish, bearish: s.bearish, neutral: s.neutral,
  hope_ratio: s.hope_ratio, fear_ratio: s.fear_ratio, mood: s.mood, index: s.index
});

/** The stored form of a frame: the frame without its evidence posts. */
export function worldRecord(frame: WorldFrame): WorldRecord {
  return {
    version: 1, generated_at: frame.generated_at, data_at: frame.data_at, window_hours: frame.window_hours,
    overall: summaryOf(frame.overall),
    communities: frame.communities.map((c) => ({
      ...summaryOf(c), id: c.id, name: c.name, collection_problem: c.collection_problem, collection_disabled: c.collection_disabled,
      collection_reason: c.collection_reason, top_stock: c.top_stock
    })),
    stocks: frame.stocks.map((s) => ({ ...summaryOf(s), symbol: s.symbol, name: s.name })),
    collection: { last_run_at: frame.collection.last_run_at, errors: frame.collection.errors, degraded: frame.collection.degraded, unavailable: frame.collection.unavailable }
  };
}

const noEvidence = (): WorldSummary["evidence"] => ({ bullish: [], bearish: [], neutral: [] });

/**
 * A stored row back as a frame, or null when it is not a version 1 record. Rows written before records went
 * index-only still carry evidence posts; they are dropped here too, so a replay never serves stored posts and the
 * theater always reads its evidence from the feed as of the recorded time.
 */
export function frameFromRecord(raw: unknown): WorldFrame | null {
  const value = raw as Partial<WorldRecord> | null;
  if (!value || value.version !== 1 || !value.overall || !Array.isArray(value.communities) || !Array.isArray(value.stocks)) return null;
  const record = worldRecord({ ...value, overall: value.overall, communities: value.communities, stocks: value.stocks,
    collection: value.collection ?? { last_run_at: null, errors: 0, degraded: false, unavailable: false } } as WorldFrame);
  return {
    ...record,
    overall: { ...record.overall, evidence: noEvidence() },
    communities: record.communities.map((c) => ({ ...c, evidence: noEvidence() })),
    stocks: record.stocks.map((s) => ({ ...s, evidence: noEvidence() }))
  };
}
