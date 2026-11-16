import { test, expect } from "@playwright/test";
import { INDEX_CACHE_CONTROL } from "../lib/index-cache-policy";
test("feed API discovers stock beyond 500 rows and paginates its scope", async ({ request }) => {
  const base = await (await request.get("/api/feed?limit=40")).json();
  expect(base.rows).toHaveLength(40);
  expect(base.summary.total).toBe(620);
  expect(base.rows.some((row: any) => row.symbol === "LATE")).toBe(false);
  const keys: string[] = [];
  let offset = 0;
  let asOf = "";
  for (let page = 0; page < 3; page++) {
    const data = await (await request.get(`/api/feed?symbol=LATE&channels=toss&limit=40&offset=${offset}&asOf=${encodeURIComponent(asOf)}`)).json();
    expect(data.summary.total).toBe(120);
    expect(data.rows.every((row: any) => row.symbol === "LATE")).toBe(true);
    keys.push(...data.rows.map((row: any) => row.post_key));
    asOf = data.generated_at; offset = data.nextOffset;
    expect(data.hasMore).toBe(page < 2);
  }
  expect(new Set(keys).size).toBe(120);
  const fear = await (await request.get("/api/feed?symbol=LATE&channels=toss&sentiment=bearish")).json();
  expect(fear.summary.total).toBe(120); expect(fear.summary.hope_ratio).toBe(.5);
  expect(fear.rows.every((row: any) => row.label === "bearish")).toBe(true);
  const empty = await (await request.get("/api/feed?symbol=MISSING")).json();
  expect(empty).toMatchObject({ rows: [], hasMore: false, nextOffset: null, errorMessage: "", summary: { total: 0 } });
});
test("home renders the metaverse, analysis redirects and public world contract survives", async ({ request }) => {
  const html = await (await request.get("/?stock=LATE&channels=toss")).text();
  expect(html).toContain("world-root"); expect(html).toContain("오늘의 개미극장");
  const redirect = await request.get("/analysis?stock=LATE&channels=toss", { maxRedirects: 0 });
  expect(redirect.status()).toBe(307); expect(new URL(redirect.headers().location, "http://127.0.0.1:3100").search).toBe("?stock=LATE&channels=toss");
  const world = await (await request.get("/api/internal/world")).json();
  expect(world.version).toBe(1); expect(world.overall.total).toBe(620);
});

test("a failed scan never returns partial scope or caches an empty success", async ({ request }) => {
  const asOf = encodeURIComponent(new Date(Date.now() - 1000).toISOString());
  await request.post("http://127.0.0.1:3101/_control", { data: { failFeed: true } });
  try {
    const response = await request.get(`/api/feed?symbol=LATE&asOf=${asOf}`);
    const data = await response.json();
    expect(data.errorMessage).not.toBe(""); expect(data.rows).toEqual([]);
    expect(response.headers()["cache-control"]).toBe("no-store");
  } finally { await request.post("http://127.0.0.1:3101/_control", { data: {} }); }
  expect((await (await request.get(`/api/feed?symbol=LATE&asOf=${asOf}`)).json()).summary.total).toBe(120);
});

test("index endpoints share one short CDN budget instead of piling stale caches", async ({ request }) => {
  for (const path of ["/api/feed?limit=12", "/api/overview", "/api/community-indicators"]) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
    expect(response.headers()["cache-control"], path).toBe(INDEX_CACHE_CONTROL);
  }
  const overview = await request.get("/api/internal/overview");
  expect(overview.status()).toBe(200);
  expect([INDEX_CACHE_CONTROL, "public, max-age=0, s-maxage=10"]).toContain(overview.headers()["cache-control"]);
  expect((await request.get("/api/internal/world")).headers()["cache-control"]).toBe("no-store");
});
