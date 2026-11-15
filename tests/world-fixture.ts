import { readFeedSelection } from "../lib/feed-scope";
import { getSourceGroupId } from "../lib/feed-source-groups";
import { test, type Page } from "@playwright/test";
import { buildWorldFrame, buildWorldReplay, worldDate, worldDayBounds } from "../lib/world";
import { buildOverallFromSourceGroupSummaries, buildSourceGroupSummaries, type FeedRow } from "../lib/feed-data";

export function worldRows(): FeedRow[] {
  const names = ["삼성전자", "애플", "엔비디아", "테슬라", "SK하이닉스", "카카오", "네이버", "현대차", "마이크로소프트", "아마존", "알파벳", "쿠팡"];
  const sources = ["toss_stock_community", "ppomppu_stock", "blind_stock_invest", "dc_stock"];
  return names.flatMap((name, i) => Array.from({ length: 10 + i }, (_, j) => {
    const label = i === 0 ? "bullish" : (i + j) % 3 === 0 ? "neutral" : (i + j) % 3 === 1 ? "bullish" : "bearish";
    return {
      post_key: `s${i}-${j}`, source: i === 0 ? `toss_stock_community_S0` : sources[j % 4],
      title: `${name} 시발 오늘의 의견 ${j}`, clean_title: `${name} 오늘의 생각 ${j}`, url: `https://example.com/posts/${i}-${j}`,
      symbol: `S${i}`, symbol_name: name, symbol_market: "kr" as const, label,
      sentiment_score: label === "bullish" ? 8 : label === "bearish" ? 2 : 5, confidence: .9,
      analyzed_at: new Date(Date.now() - j * 10_000).toISOString()
    };
  }));
}
export async function prepareWorld(page: Page) {
  const rows = worldRows().sort((a, b) => b.analyzed_at.localeCompare(a.analyzed_at));
  const frame = buildWorldFrame(rows);
  const groups = buildSourceGroupSummaries(rows);
  const overall = buildOverallFromSourceGroupSummaries(groups);
  await page.context().addCookies([
    { name: "goksorry-cookie-consent", value: "v1:essential", domain: "127.0.0.1", path: "/" },
    { name: "goksorry-clean-filter", value: "on", domain: "127.0.0.1", path: "/" }
  ]);
  await page.addInitScript(() => {
    localStorage.setItem("goksorry-theme", "light");
    localStorage.setItem("goksorry-change-color-mode", "hybrid");
  });
  await page.route("**/api/auth/session", (route) => route.fulfill({ json: {} }));
  await page.route("**/api/internal/world", (route) => route.fulfill({ json: frame }));
  await page.route("**/api/feed?*", (route) => {
    const params = new URL(route.request().url()).searchParams;
    const { channels, symbol, sentiment } = readFeedSelection(params);
    const offset = Number(params.get("offset") ?? 0), limit = Number(params.get("limit") ?? 80);
    const filtered = rows.filter(row => channels.includes(getSourceGroupId(row.source)!) && (!symbol || row.symbol === symbol) && (sentiment === "all" || row.label === sentiment));
    // Legacy payload deliberately lacks summary; API/browser integration tests use the full backend.
    return route.fulfill({ json: { rows: filtered.slice(offset, offset + limit), nextOffset: offset + limit < filtered.length ? offset + limit : null, hasMore: offset + limit < filtered.length, errorMessage: "" } });
  });
  await page.route("**/api/internal/overview", (route) => route.fulfill({ json: {
    generated_at: new Date().toISOString(), market_indicators: ["kospi", "kosdaq", "nasdaq", "usdkrw"].map((id) => ({ id, label: id.toUpperCase(), value_text: "1,234.56", delta_text: "+10 (1%)", tone: "up", note: "테스트 기준", change_value: 10, change_percent: 1 })),
    ...overall, market_adjustment_enabled: false, market_adjustment_status: "inactive", community_indicators: groups
  } }));
  await page.route("**/api/internal/world/replay?*", (route) => {
    const date = new URL(route.request().url()).searchParams.get("date") ?? worldDate();
    const start = Date.parse(worldDayBounds(date)!.start);
    const replay = buildWorldReplay(date, Array.from({ length: 144 }, (_, i) => ({ bucket_at: new Date(start + i * 600_000).toISOString(), frame: i % 8 === 1 ? null : { ...frame, generated_at: new Date(start + i * 600_000).toISOString() } })));
    return route.fulfill({ json: replay });
  });
  return frame;
}

export async function requireWebGL2(page: Page) {
  const supported = await page.evaluate(() => {
    const gl = document.createElement("canvas").getContext("webgl2");
    const available = Boolean(gl);
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
    return available;
  });
  test.skip(!supported, "This browser environment cannot create WebGL2; static fallback is tested separately.");
}
