import { createClient } from "@supabase/supabase-js";

const DEFAULT_BATCH_SIZE = 100;
const DEFAULT_CONCURRENCY = 8;
const DEFAULT_RETRY_HOURS = 24;

const requiredEnv = (name) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

const parsePositiveInt = (value, fallback) => {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const getOptions = () => {
  return {
    batchSize: parsePositiveInt(process.env.SYMBOL_METADATA_BATCH_SIZE, DEFAULT_BATCH_SIZE),
    concurrency: parsePositiveInt(process.env.SYMBOL_METADATA_CONCURRENCY, DEFAULT_CONCURRENCY),
    retryHours: parsePositiveInt(process.env.SYMBOL_METADATA_RETRY_HOURS, DEFAULT_RETRY_HOURS)
  };
};

const createServiceClient = () => {
  return createClient(requiredEnv("NEXT_PUBLIC_SUPABASE_URL"), requiredEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
};

const parseMarket = (value) => {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  if (["kr", "kor", "korea", "krx", "kospi", "kosdaq"].includes(normalized)) {
    return "kr";
  }

  if (["us", "usa", "nasdaq", "nyse", "amex"].includes(normalized)) {
    return "us";
  }

  return null;
};

const inferMarketFromSymbol = (symbol) => {
  if (/^\d{6}$/.test(symbol)) {
    return "kr";
  }

  if (/^[A-Z.\-]{1,10}$/.test(symbol)) {
    return "us";
  }

  return null;
};

const fetchSymbolMetadataFromUpstream = async (symbol) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);

  try {
    const response = await fetch(
      `https://wts-info-api.tossinvest.com/api/v2/stock-infos/code-or-symbol/${encodeURIComponent(symbol)}`,
      {
        headers: {
          "User-Agent": "goksorry-web-symbol-backfill/1.0",
          Accept: "application/json"
        },
        signal: controller.signal
      }
    );

    if (!response.ok) {
      throw new Error(`upstream ${response.status}`);
    }

    const payload = await response.json();
    const result = payload?.result ?? {};
    const displayName =
      String(result.name ?? result.detailName ?? result.companyName ?? "")
        .trim() || null;

    return {
      display_name: displayName,
      market:
        parseMarket(result.market) ??
        parseMarket(result.marketType) ??
        parseMarket(result.exchangeCode) ??
        parseMarket(result.nationCode) ??
        inferMarketFromSymbol(symbol)
    };
  } finally {
    clearTimeout(timeout);
  }
};

const mapWithConcurrency = async (items, concurrency, mapper) => {
  const results = new Array(items.length);
  let cursor = 0;

  const worker = async () => {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) {
        return;
      }

      results[index] = await mapper(items[index], index);
    }
  };

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
};

const fetchPendingSymbols = async (service, batchSize) => {
  const { data, error } = await service
    .from("symbol_metadata")
    .select("symbol,status,last_fetched_at,updated_at")
    .eq("status", "pending")
    .order("updated_at", { ascending: true })
    .limit(batchSize);

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => ({
    symbol: String(row.symbol),
    status: String(row.status),
    last_fetched_at: row.last_fetched_at ? String(row.last_fetched_at) : null
  }));
};

const fetchRetryableFailedSymbols = async (service, batchSize, retryHours) => {
  const { data, error } = await service
    .from("symbol_metadata")
    .select("symbol,status,last_fetched_at,updated_at")
    .eq("status", "failed")
    .order("updated_at", { ascending: true })
    .limit(batchSize * 4);

  if (error) {
    throw error;
  }

  const cutoffMs = Date.now() - retryHours * 60 * 60 * 1000;
  return (data ?? [])
    .filter((row) => {
      const lastFetchedMs = row.last_fetched_at ? new Date(String(row.last_fetched_at)).getTime() : Number.NaN;
      return Number.isNaN(lastFetchedMs) || lastFetchedMs <= cutoffMs;
    })
    .slice(0, batchSize)
    .map((row) => ({
      symbol: String(row.symbol),
      status: String(row.status),
      last_fetched_at: row.last_fetched_at ? String(row.last_fetched_at) : null
    }));
};

const fetchQueuedSymbols = async (service, options) => {
  const pending = await fetchPendingSymbols(service, options.batchSize);
  if (pending.length >= options.batchSize) {
    return pending;
  }

  const failed = await fetchRetryableFailedSymbols(service, options.batchSize - pending.length, options.retryHours);
  return [...pending, ...failed];
};

const upsertResolvedRows = async (service, rows) => {
  if (rows.length === 0) {
    return;
  }

  const { error } = await service.from("symbol_metadata").upsert(rows, { onConflict: "symbol" });
  if (error) {
    throw error;
  }
};

const main = async () => {
  const options = getOptions();
  const service = createServiceClient();

  let totalProcessed = 0;
  let totalReady = 0;
  let totalFailed = 0;

  while (true) {
    const queued = await fetchQueuedSymbols(service, options);
    if (queued.length === 0) {
      break;
    }

    console.log(
      `[symbol-metadata] processing ${queued.length} symbol(s) ` +
        `(batch=${options.batchSize}, concurrency=${options.concurrency})`
    );

    const nowIso = new Date().toISOString();
    const resolvedRows = await mapWithConcurrency(queued, options.concurrency, async (row) => {
      try {
        const metadata = await fetchSymbolMetadataFromUpstream(row.symbol);
        const ready = Boolean(metadata.display_name);
        return {
          symbol: row.symbol,
          display_name: metadata.display_name,
          market: metadata.market,
          status: ready ? "ready" : "failed",
          last_fetched_at: nowIso
        };
      } catch (error) {
        console.error(`[symbol-metadata] fetch failed for ${row.symbol}:`, error instanceof Error ? error.message : error);
        return {
          symbol: row.symbol,
          display_name: null,
          market: inferMarketFromSymbol(row.symbol),
          status: "failed",
          last_fetched_at: nowIso
        };
      }
    });

    await upsertResolvedRows(service, resolvedRows);

    totalProcessed += resolvedRows.length;
    totalReady += resolvedRows.filter((row) => row.status === "ready").length;
    totalFailed += resolvedRows.filter((row) => row.status === "failed").length;
  }

  console.log(
    `[symbol-metadata] done processed=${totalProcessed} ready=${totalReady} failed=${totalFailed}`
  );
};

main().catch((error) => {
  console.error("[symbol-metadata] fatal:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
