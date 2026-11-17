import { buildFeedScoreOverview, buildOverallFromSourceGroupSummaries, buildSourceGroupSummaries, type FeedRow, type SourceGroupCollectionStatus } from "./feed-data";
import { SOURCE_GROUP_IDS, getSourceGroupId, matchesSourceName, parseSourceGroupSelection, type SourceGroupId } from "./feed-source-groups";
import { worldSummary, type WorldFrame, type WorldSummary } from "./world";
import type { MarketAdjustmentSnapshot } from "./community-market-adjustment";
import type { MarketIndicator } from "./overview-data";

export type FeedSelection = { symbol: string; channels: SourceGroupId[]; sentiment: "all" | FeedRow["label"] };
export type FeedSnapshot = {
  rows: FeedRow[]; generated_at: string; market_indicators: MarketIndicator[];
  marketAdjustmentSnapshot: MarketAdjustmentSnapshot | null;
  collectionStatuses: Partial<Record<SourceGroupId, SourceGroupCollectionStatus>>;
  excludedSourceNames?: string[];
  collection: WorldFrame["collection"];
};
export type ScopeSummary = Omit<WorldSummary, "evidence"> & { data_at: string | null };
export type FeedPage = {
  rows: FeedRow[]; nextOffset: number | null; hasMore: boolean; errorMessage: string;
  summary: ScopeSummary; generated_at: string; window_hours: number;
  stocks: { symbol: string; name: string; total: number }[];
  communities: { id: SourceGroupId; name: string; summary: ScopeSummary; problem: boolean; disabled: boolean }[];
  market_indicators: MarketIndicator[]; collection: WorldFrame["collection"];
};

export function readFeedSelection(params: URLSearchParams): FeedSelection {
  const raw = params.get("sentiment");
  return {
    symbol: (params.get("symbol") ?? params.get("stock") ?? "").trim().toUpperCase().slice(0, 40),
    channels: parseSourceGroupSelection(params.get("channels") ?? params.get("channel") ?? ""),
    sentiment: raw === "bullish" || raw === "bearish" || raw === "neutral" ? raw : "all"
  };
}

export function buildFeedPage(snapshot: FeedSnapshot, selection: FeedSelection, { limit = 80, offset = 0, hours = 6 } = {}): FeedPage {
  const options = { asOf: new Date(snapshot.generated_at), marketAdjustmentSnapshot: snapshot.marketAdjustmentSnapshot, collectionStatuses: snapshot.collectionStatuses, excludedSourceNames: new Set(snapshot.excludedSourceNames) };
  const permittedRows = snapshot.rows.filter(row => ![...options.excludedSourceNames].some(name => matchesSourceName(row.source, name)));
  const summarize = (rows: FeedRow[], channels = selection.channels): ScopeSummary => {
    const { evidence: _, ...summary } = worldSummary(rows);
    summary.index = selection.symbol
      ? buildFeedScoreOverview(rows).goksorry_index
      : buildOverallFromSourceGroupSummaries(buildSourceGroupSummaries(rows, options).filter(group => channels.includes(group.id))).overall_goksorry_index;
    return { ...summary, data_at: rows[0]?.analyzed_at ?? null };
  };
  // Scope first, pagination last. Sentiment never changes the scope's ratios.
  const byChannel = permittedRows.filter(row => {
    const group = getSourceGroupId(row.source);
    return group ? selection.channels.includes(group) : selection.channels.length === SOURCE_GROUP_IDS.length;
  });
  const scoped = byChannel.filter(row => !selection.symbol || row.symbol === selection.symbol);
  const filtered = scoped.filter(row => selection.sentiment === "all" || row.label === selection.sentiment);
  const stocks = new Map<string, { symbol: string; name: string; total: number }>();
  for (const row of byChannel) if (row.symbol) {
    const entry = stocks.get(row.symbol) ?? { symbol: row.symbol, name: row.symbol_name || row.symbol, total: 0 };
    entry.total++; stocks.set(row.symbol, entry);
  }
  const hasMore = offset + limit < filtered.length;
  return {
    rows: filtered.slice(offset, offset + limit), nextOffset: hasMore ? offset + limit : null, hasMore, errorMessage: "",
    summary: summarize(scoped), generated_at: snapshot.generated_at, window_hours: hours,
    stocks: [...stocks.values()].sort((a, b) => b.total - a.total || a.symbol.localeCompare(b.symbol)),
    communities: buildSourceGroupSummaries(permittedRows, options).map(group => ({
      id: group.id, name: group.shortLabel, problem: group.collection_problem, disabled: group.collection_disabled,
      summary: summarize(permittedRows.filter(row => getSourceGroupId(row.source) === group.id && (!selection.symbol || row.symbol === selection.symbol)), [group.id])
    })),
    market_indicators: snapshot.market_indicators, collection: snapshot.collection
  };
}

export function emptyFeedPage(errorMessage: string): FeedPage {
  const { evidence: _, ...summary } = worldSummary([]);
  return { rows: [], nextOffset: null, hasMore: false, errorMessage, summary: { ...summary, data_at: null }, generated_at: "", window_hours: 6, stocks: [], communities: [], market_indicators: [], collection: { last_run_at: null, errors: 0, degraded: false, unavailable: true } };
}
