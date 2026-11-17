// Disposable PostgREST contract fixture. Never connects to the linked project.
import { createServer } from "node:http";
let snapshots = new Map();
let failWrite = false, failRead = false, failFeed = false, failPolicy = false;
let contentSince = null;
let calls = [];
const makeRows = () => Array.from({ length: 620 }, (_, i) => ({
  post_key: `fixture-${i}`, label: i % 3 === 0 ? "neutral" : i % 3 === 1 ? "bullish" : "bearish",
  sentiment_score: i % 3 === 0 ? 5 : i % 3 === 1 ? 8 : 2, confidence: .9,
  analyzed_at: new Date(Date.now() - 60_000 - i * 1000).toISOString()
}));
const symbol = (i) => i >= 500 ? "LATE" : `S${i % 12}`;
const policyBlocked = process.env.POLICY_TEST_BLOCKED === "1";
const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1:3101");
  const send = (status, value) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(value)); };
  let body = ""; for await (const part of req) body += part;
  if (url.pathname === "/_control") {
    if (req.method === "POST") {
      const control = JSON.parse(body || "{}");
      failWrite = Boolean(control.failWrite); failRead = Boolean(control.failRead);
      failFeed = Boolean(control.failFeed);
      failPolicy = Boolean(control.failPolicy);
      contentSince = typeof control.contentSince === "string" ? control.contentSince : null;
      if (control.reset) { snapshots.clear(); calls = []; }
    }
    return send(200, { snapshots: [...snapshots.values()], calls });
  }
  const table = url.pathname.split("/").pop(); calls.push({ table, method: req.method, query: url.search });
  if (table === "detector_status" && req.method === "POST") calls[calls.length - 1].payload = JSON.parse(body);
  if (table === "detector_status" && failPolicy) return send(500, { message: "fixture policy unavailable" });
  if (table === "world_snapshots") {
    if (req.method === "POST") {
      if (failWrite) return send(500, { message: "fixture snapshot write failure" });
      const row = JSON.parse(body); snapshots.set(row.bucket_at, row); return send(200, null);
    }
    if (req.method === "DELETE") {
      const cutoff = (url.searchParams.get("bucket_at") ?? "").slice(3);
      for (const key of snapshots.keys()) if (key < cutoff) snapshots.delete(key);
      return send(200, null);
    }
    if (failRead) return send(500, { message: "fixture missing history" });
    const range = url.searchParams.getAll("bucket_at");
    return send(200, [...snapshots.values()].filter((row) => range.every((filter) => filter.startsWith("gte.") ? row.bucket_at >= filter.slice(4) : row.bucket_at < filter.slice(3))));
  }
  if (req.method !== "GET" && req.method !== "HEAD") return send(200, null);
  if (table === "sentiment_results") {
    const start = Number(url.searchParams.get("offset") ?? 0), limit = Number(url.searchParams.get("limit") ?? 1000);
    if (failFeed && start >= 500) return send(500, { message: "fixture feed second-page failure" });
    return send(200, makeRows().slice(start, start + limit));
  }
  if (table === "external_posts") {
    const filter = url.searchParams.get("post_key") ?? "";
    return send(200, makeRows().filter((row) => filter.includes(`\"${row.post_key}\"`) || new RegExp(`(?:\\(|,)${row.post_key}(?:,|\\))`).test(filter)).map((row) => {
      const i = Number(row.post_key.split("-")[1]);
      return { post_key: row.post_key, source: "toss_stock_community", title: "테스트 수집 제목", clean_title: "테스트 수집 제목", url: "https://example.com/post", symbol: symbol(i) };
    }));
  }
  if (table === "symbol_metadata") return send(200, [...Array.from({ length: 12 }, (_, i) => `S${i}`), "LATE"].map((symbol) => ({ symbol, display_name: symbol === "LATE" ? "다음 페이지 종목" : symbol, market: "us", status: "ready", last_fetched_at: new Date().toISOString() })));
  if (table === "detector_status") {
    const blocked = policyBlocked && !contentSince;
    return send(200, [{ singleton: true, collector_last_run_at: new Date().toISOString(), collector_errors: 0, llm_degraded: false, collection_policy: { checked_at: new Date().toISOString(), sources: [{ source_name: "toss_stock_community", allow_fetch: !blocked, allow_detail: !blocked && !contentSince, postponed: blocked, reason: blocked ? "terms_review_required" : contentSince ? "reviewed_limited_use" : "reviewed_use", content_since: contentSince, article_count: blocked ? 0 : 620 }] } }]);
  }
  return send(200, []);
});
const port = Number(process.env.TEST_BACKEND_PORT || 3101);
server.listen(port, "127.0.0.1", () => process.stdout.write(`World test backend listening on ${port}\n`));
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.close(() => process.exit(0)));
