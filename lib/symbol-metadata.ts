import type { SupabaseClient } from "@supabase/supabase-js";

const SYMBOL_METADATA_RETRY_INTERVAL_MS = 24 * 60 * 60 * 1000;
const UPSTREAM_TIMEOUT_MS = 3500;
const SYMBOL_METADATA_BATCH_SIZE = 200;
const SYMBOL_METADATA_SYNC_CONCURRENCY = 8;

export type SymbolMetadataStatus = "pending" | "ready" | "failed";

export type SymbolMetadataRow = {
  symbol: string;
  display_name: string | null;
  market: "kr" | "us" | null;
  status: SymbolMetadataStatus;
  last_fetched_at: string | null;
};

const chunk = <T,>(items: T[], size: number): T[][] => {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
};

const mapWithConcurrency = async <T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>
): Promise<R[]> => {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;

      if (currentIndex >= items.length) {
        return;
      }

      results[currentIndex] = await mapper(items[currentIndex] as T, currentIndex);
    }
  });

  await Promise.all(workers);
  return results;
};

const normalizeSymbols = (symbols: Iterable<string>): string[] => {
  return [...new Set([...symbols].map((symbol) => symbol.trim().toUpperCase()).filter(Boolean))];
};

const parseMarket = (value: unknown): "kr" | "us" | null => {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();

  if (!normalized) {
    return null;
  }

  if (
    normalized === "kr" ||
    normalized === "kor" ||
    normalized === "korea" ||
    normalized === "krx" ||
    normalized === "kospi" ||
    normalized === "kosdaq"
  ) {
    return "kr";
  }

  if (
    normalized === "us" ||
    normalized === "usa" ||
    normalized === "nasdaq" ||
    normalized === "nyse" ||
    normalized === "amex"
  ) {
    return "us";
  }

  return null;
};

const inferMarketFromSymbol = (symbol: string): "kr" | "us" | null => {
  if (/^\d{6}$/.test(symbol)) {
    return "kr";
  }

  if (/^[A-Z.\-]{1,10}$/.test(symbol)) {
    return "us";
  }

  return null;
};

const fetchFromUpstream = async (
  symbol: string
): Promise<{ display_name: string | null; market: "kr" | "us" | null; status: SymbolMetadataStatus }> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const response = await fetch(
      `https://wts-info-api.tossinvest.com/api/v2/stock-infos/code-or-symbol/${encodeURIComponent(symbol)}`,
      {
        headers: {
          "User-Agent": "goksorry-web/1.0",
          Accept: "application/json"
        },
        signal: controller.signal
      }
    );

    if (!response.ok) {
      throw new Error(`upstream ${response.status}`);
    }

    const payload = (await response.json()) as {
      result?: {
        name?: unknown;
        detailName?: unknown;
        companyName?: unknown;
        market?: unknown;
        marketType?: unknown;
        exchangeCode?: unknown;
        nationCode?: unknown;
      };
    };

    const displayName =
      String(payload.result?.name ?? payload.result?.detailName ?? payload.result?.companyName ?? "").trim() || null;

    return {
      display_name: displayName,
      market:
        parseMarket(payload.result?.market) ??
        parseMarket(payload.result?.marketType) ??
        parseMarket(payload.result?.exchangeCode) ??
        parseMarket(payload.result?.nationCode) ??
        inferMarketFromSymbol(symbol),
      status: displayName ? "ready" : "failed"
    };
  } catch {
    return {
      display_name: null,
      market: inferMarketFromSymbol(symbol),
      status: "failed"
    };
  } finally {
    clearTimeout(timeout);
  }
};

const shouldRefresh = (row: SymbolMetadataRow | undefined, forceRefresh: boolean): boolean => {
  if (forceRefresh) {
    return true;
  }

  if (!row) {
    return true;
  }

  if (row.status === "ready" && row.display_name) {
    return false;
  }

  const lastFetchedMs = row.last_fetched_at ? new Date(row.last_fetched_at).getTime() : Number.NaN;
  if (Number.isNaN(lastFetchedMs)) {
    return true;
  }

  return Date.now() - lastFetchedMs >= SYMBOL_METADATA_RETRY_INTERVAL_MS;
};

export const extractSymbolFromSource = (source: string): string | null => {
  const normalizedSource = source.trim();
  if (!normalizedSource) {
    return null;
  }

  if (normalizedSource.startsWith("naver_stock_")) {
    return normalizedSource.replace("naver_stock_", "").trim().toUpperCase() || null;
  }

  if (normalizedSource.startsWith("toss_stock_community_")) {
    return normalizedSource.replace("toss_stock_community_", "").trim().toUpperCase() || null;
  }

  return null;
};

export const loadSymbolMetadataMap = async (
  service: SupabaseClient,
  symbols: Iterable<string>
): Promise<Map<string, SymbolMetadataRow>> => {
  const normalizedSymbols = normalizeSymbols(symbols);
  const rows = new Map<string, SymbolMetadataRow>();

  for (const batch of chunk(normalizedSymbols, SYMBOL_METADATA_BATCH_SIZE)) {
    const { data, error } = await service
      .from("symbol_metadata")
      .select("symbol,display_name,market,status,last_fetched_at")
      .in("symbol", batch);

    if (error) {
      throw error;
    }

    for (const item of data ?? []) {
      const symbol = String(item.symbol ?? "").trim().toUpperCase();
      if (!symbol) {
        continue;
      }

      rows.set(symbol, {
        symbol,
        display_name: typeof item.display_name === "string" ? item.display_name : null,
        market: parseMarket(item.market),
        status:
          item.status === "ready" || item.status === "failed" || item.status === "pending"
            ? item.status
            : "pending",
        last_fetched_at: typeof item.last_fetched_at === "string" ? item.last_fetched_at : null
      });
    }
  }

  return rows;
};

export const syncSymbolMetadata = async (
  service: SupabaseClient,
  symbols: Iterable<string>,
  options?: { forceRefresh?: boolean }
): Promise<Map<string, SymbolMetadataRow>> => {
  const normalizedSymbols = normalizeSymbols(symbols);
  const output = new Map<string, SymbolMetadataRow>();

  if (normalizedSymbols.length === 0) {
    return output;
  }

  const existing = await loadSymbolMetadataMap(service, normalizedSymbols);
  const missing = normalizedSymbols.filter((symbol) => !existing.has(symbol));

  if (missing.length > 0) {
    const pendingRows = missing.map((symbol) => ({
      symbol,
      status: "pending" as const
    }));

    const { error } = await service.from("symbol_metadata").upsert(pendingRows, {
      onConflict: "symbol",
      ignoreDuplicates: true
    });
    if (error) {
      throw error;
    }

    for (const symbol of missing) {
      existing.set(symbol, {
        symbol,
        display_name: null,
        market: inferMarketFromSymbol(symbol),
        status: "pending",
        last_fetched_at: null
      });
    }
  }

  const forceRefresh = Boolean(options?.forceRefresh);
  const symbolsToRefresh = normalizedSymbols.filter((symbol) => shouldRefresh(existing.get(symbol), forceRefresh));

  if (symbolsToRefresh.length > 0) {
    const fetchedAt = new Date().toISOString();
    const upsertRows = await mapWithConcurrency(
      symbolsToRefresh,
      SYMBOL_METADATA_SYNC_CONCURRENCY,
      async (symbol) => {
        const metadata = await fetchFromUpstream(symbol);
        return {
          symbol,
          display_name: metadata.display_name,
          market: metadata.market,
          status: metadata.status,
          last_fetched_at: fetchedAt
        };
      }
    );

    const { error } = await service.from("symbol_metadata").upsert(upsertRows, {
      onConflict: "symbol"
    });
    if (error) {
      throw error;
    }

    for (const row of upsertRows) {
      existing.set(row.symbol, row);
    }
  }

  for (const symbol of normalizedSymbols) {
    const row = existing.get(symbol);
    if (row) {
      output.set(symbol, row);
    }
  }

  return output;
};
