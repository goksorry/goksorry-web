"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useCleanFilter } from "@/components/clean-filter-provider";
import { resolveDisplayTitle } from "@/lib/clean-filter";
import { SOURCE_GROUP_IDS, getSourceGroupShortLabel, serializeSourceGroupSelection } from "@/lib/feed-source-groups";
import { readFeedSelection, type FeedPage, type FeedSelection } from "@/lib/feed-scope";
import { percent } from "@/lib/world";
import { getMarketColorContextForIndicator } from "@/lib/change-color-mode";
import { PierrotStage } from "./pierrot-stage";
import "./sentiment-home.css";

const labels = { all: "전체", bearish: "공포", bullish: "희망", neutral: "중립" };
const moodLabels = { fear: "공포", hope: "희망", mixed: "혼조", neutral: "중립", watching: "표본 부족" };
const selectionKey = (selection: FeedSelection) => JSON.stringify(selection);
const scopeLabel = (selection: FeedSelection, page: FeedPage) => [selection.symbol ? page.stocks.find(s => s.symbol === selection.symbol)?.name ?? selection.symbol : "전체 종목", selection.channels.length === 4 ? "전체 커뮤니티" : selection.channels.length ? selection.channels.map(id => page.communities.find(c => c.id === id)?.name ?? id).join("·") : "출처 선택 없음"].join(" · ");

export function SentimentHome({ initial, initialSelection, timezone }: { initial: FeedPage; initialSelection: FeedSelection; timezone: string }) {
  const params = useSearchParams();
  const selection = readFeedSelection(params);
  const key = selectionKey(selection);
  const [data, setData] = useState(initial);
  const [shownSelection, setShownSelection] = useState(initialSelection);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initial.errorMessage);
  const [now, setNow] = useState(0);
  const [revealed, setRevealed] = useState<string[]>([]);
  const [stocksOpen, setStocksOpen] = useState(false);
  const [communitiesOpen, setCommunitiesOpen] = useState(false);
  const { cleanFilterEnabled } = useCleanFilter();
  const current = useRef({ data: initial, key: selectionKey(initialSelection) });
  const request = useRef<AbortController | null>(null);
  const first = useRef(true);
  const loadRef = useRef<(more?: boolean) => Promise<void>>();
  const formatTime = (iso: string) => new Intl.DateTimeFormat("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: timezone }).format(new Date(iso));

  useEffect(() => {
    const media = matchMedia("(min-width: 960px)");
    const sync = () => { setStocksOpen(media.matches); setCommunitiesOpen(media.matches); };
    sync(); media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const selected = JSON.parse(key) as FeedSelection;
    let pending = false;
    const load = async (more = false, refresh = false) => {
      if (refresh && pending) return;
      request.current?.abort();
      const controller = new AbortController(); request.current = controller;
      pending = true;
      setBusy(true);
      const query = new URLSearchParams({ hours: "6", limit: "40", symbol: selected.symbol, channels: serializeSourceGroupSelection(selected.channels), sentiment: selected.sentiment });
      const previous = current.current.data;
      const targetCount = refresh && current.current.key === key ? Math.max(40, previous.rows.length) : 40;
      if (refresh) query.set("limit", String(Math.min(200, targetCount)));
      if (more && previous.nextOffset !== null) { query.set("offset", String(previous.nextOffset)); query.set("asOf", previous.generated_at); }
      try {
        const response = await fetch(`/api/feed?${query}`, { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error("조회 실패");
        let next: FeedPage = await response.json();
        if (next.errorMessage || !next.summary) throw new Error(next.errorMessage || "조회 실패");
        while (refresh && next.rows.length < targetCount && next.nextOffset !== null) {
          query.set("offset", String(next.nextOffset)); query.set("asOf", next.generated_at);
          query.set("limit", String(Math.min(200, targetCount - next.rows.length)));
          const response = await fetch(`/api/feed?${query}`, { signal: controller.signal, cache: "no-store" });
          if (!response.ok) throw new Error("조회 실패");
          const page: FeedPage = await response.json();
          if (page.errorMessage || !page.summary) throw new Error("조회 실패");
          next = { ...page, rows: [...next.rows, ...page.rows] };
        }
        if (controller.signal.aborted) return;
        const result = more ? { ...next, rows: [...new Map([...previous.rows, ...next.rows].map(row => [row.post_key, row])).values()] } : next;
        current.current = { data: result, key }; setData(result); setShownSelection(selected); setError("");
      } catch (e) {
        if (!controller.signal.aborted) setError(more ? "더 보기 실패 · 다시 시도해 주세요." : "조회 실패 · 마지막 정상 데이터 표시 중");
      } finally { if (!controller.signal.aborted) { pending = false; setBusy(false); } }
    };
    loadRef.current = load;
    if (!first.current || key !== current.current.key || initial.errorMessage) void load();
    first.current = false;
    const timer = setInterval(() => {
      setNow(Date.now());
      if (!document.hidden) void load(false, true);
    }, 60_000);
    setNow(Date.now());
    return () => { clearInterval(timer); request.current?.abort(); };
  }, [key, initial.errorMessage]);

  const select = (next: FeedSelection) => {
    const url = new URL(window.location.href);
    ["stock", "symbol", "channels", "channel", "sentiment", "scene", "feed", "date"].forEach(name => url.searchParams.delete(name));
    if (next.symbol) url.searchParams.set("stock", next.symbol);
    const channels = serializeSourceGroupSelection(next.channels);
    if (channels) url.searchParams.set("channels", channels);
    if (next.sentiment !== "all") url.searchParams.set("sentiment", next.sentiment);
    window.history.pushState(null, "", url.pathname + url.search);
  };
  const reset = () => select({ symbol: "", channels: [...SOURCE_GROUP_IDS], sentiment: "all" });
  const summary = data.summary;
  const delayed = summary.data_at && now && now - Date.parse(summary.data_at) >= 30 * 60_000;
  const status = error || (delayed ? "갱신 지연" : !summary.total ? "최근 6시간 표본 없음" : data.collection.unavailable ? "수집 상태 확인 불가" : data.collection.degraded ? "분류 지연" : data.collection.errors ? "일부 수집 지연" : summary.total < 3 ? "소표본 · 해석 대기" : "최근 6시간");
  const selectedScope = scopeLabel(shownSelection, data);
  const isFiltered = selection.symbol || selection.channels.length !== 4 || selection.sentiment !== "all";

  return <div className="sentiment-home">
    {params.get("scene") === "theater" && <p className="home-notice" role="status">개미극장은 종료되었습니다. 현재 현황을 표시합니다.</p>}
    <section className="home-current" aria-label="현재 분위기" aria-busy={busy}>
      <div className="home-current-main">
        <div className="home-title"><h1>곡소리 지수</h1><span>{moodLabels[summary.mood]}</span></div>
        <div className="home-index"><strong>{summary.total ? summary.index.toFixed(1) : "—"}</strong><span>/ 10</span><small>높을수록 공포</small></div>
        <div className="home-ratios"><span className="home-hope">희망 <b>{percent(summary.hope_ratio)}</b></span><span className="home-fear">공포 <b>{percent(summary.fear_ratio)}</b></span></div>
        <div className="home-ratio-bar" aria-hidden="true"><i style={{ width: summary.hope_ratio === null ? "0%" : `${summary.hope_ratio * 100}%` }} /><i style={{ width: summary.fear_ratio === null ? "0%" : `${summary.fear_ratio * 100}%` }} /></div>
        <p className="home-counts">표본 {summary.total.toLocaleString()}건 · 중립 {summary.neutral.toLocaleString()}건</p>
      </div>
      <PierrotStage mood={summary.mood} />
      <div className="home-current-foot"><span role="status">{busy ? "갱신 중" : status}</span><span>기준 {summary.data_at ? <time dateTime={summary.data_at}>{formatTime(summary.data_at)}</time> : "—"}</span></div>
    </section>

    <div className="home-content">
      <aside className="home-explore" aria-label="종목과 커뮤니티 선택">
        <details className="home-disclosure" open={stocksOpen} onToggle={event => setStocksOpen(event.currentTarget.open)}>
          <summary>종목별 언급 <span>{data.stocks.length}종목 <span aria-hidden="true">＋</span></span></summary>
          <div className="home-choices">
            <button type="button" aria-pressed={!selection.symbol} onClick={() => select({ ...selection, symbol: "" })}>전체 종목</button>
            {data.stocks.map(stock => <button type="button" key={stock.symbol} aria-pressed={selection.symbol === stock.symbol} onClick={() => select({ ...selection, symbol: stock.symbol })}><span>{stock.name}<small>{stock.symbol}</small></span><b>{stock.total}건</b></button>)}
            {!data.stocks.length && <p>해당 출처의 종목 언급이 없습니다.</p>}
          </div>
        </details>
        <details className="home-disclosure" open={communitiesOpen} onToggle={event => setCommunitiesOpen(event.currentTarget.open)}>
          <summary>커뮤니티별 현황 <span>{selection.channels.length}곳 선택 <span aria-hidden="true">＋</span></span></summary>
          <div className="home-choices">
            <button type="button" aria-pressed={selection.channels.length === 4} onClick={() => select({ ...selection, channels: [...SOURCE_GROUP_IDS] })}>전체 커뮤니티</button>
            {data.communities.map(group => <button type="button" key={group.id} aria-pressed={selection.channels.includes(group.id)} onClick={() => select({ ...selection, channels: selection.channels.includes(group.id) ? selection.channels.filter(id => id !== group.id) : SOURCE_GROUP_IDS.filter(id => id === group.id || selection.channels.includes(id)) })}>
              <span>{group.name}<small>{group.disabled ? "수집 중단" : group.problem ? "일부 수집 지연" : `${group.summary.total}건 · 중립 ${group.summary.neutral}건`}</small></span><span className="home-community-ratio">희망 {percent(group.summary.hope_ratio)}<small>공포 {percent(group.summary.fear_ratio)}</small></span>
            </button>)}
          </div>
        </details>
      </aside>

      <section className="home-feed" id="recent-posts" aria-label="최근 글">
        <div className="home-feed-head"><h2>최근 글</h2><span>최신순</span></div>
        <div className="home-scope"><span>{selectedScope}{shownSelection.sentiment !== selection.sentiment ? ` · 표시 중: ${labels[shownSelection.sentiment]}` : ""}</span>{isFiltered && <button type="button" onClick={reset}>전체 복귀</button>}</div>
        <div className="home-tabs" role="group" aria-label="감성 필터">{(Object.keys(labels) as (keyof typeof labels)[]).map(side => <button type="button" key={side} aria-pressed={selection.sentiment === side} onClick={() => select({ ...selection, sentiment: side })}>{labels[side]}</button>)}</div>
        {error && <div className="home-notice" role="alert">{error} <button type="button" onClick={() => void loadRef.current?.()}>다시 조회</button></div>}
        <ul className="home-posts" aria-busy={busy}>{data.rows.map(row => {
          const title = resolveDisplayTitle({ title: row.title, cleanTitle: row.clean_title, cleanFilterEnabled: cleanFilterEnabled && !revealed.includes(row.post_key) });
          return <li key={row.post_key} className="home-post" data-sentiment={row.label}>
            <div className="home-post-meta"><span className={`home-label-${row.label}`}>{labels[row.label]}</span><span>{getSourceGroupShortLabel(row.source)}</span>{row.symbol && <button type="button" onClick={() => select({ ...selection, symbol: row.symbol! })}>{row.symbol_name || row.symbol}</button>}<time dateTime={row.analyzed_at}>{formatTime(row.analyzed_at)}</time></div>
            <a className="home-post-title" href={/^https?:\/\//i.test(row.url) ? row.url : undefined} target="_blank" rel="noopener noreferrer">{title.text}<span aria-hidden="true"> ↗</span><span className="sr-only"> (원문, 새 탭)</span></a>
            {cleanFilterEnabled && <button type="button" className="home-original-toggle" aria-pressed={revealed.includes(row.post_key)} onClick={() => setRevealed(keys => keys.includes(row.post_key) ? keys.filter(k => k !== row.post_key) : [...keys, row.post_key])}>{revealed.includes(row.post_key) ? "예쁜말 보기" : "원래 제목 보기"}</button>}
          </li>;
        })}</ul>
        {!data.rows.length && !busy && !error && <p className="home-empty">조건에 맞는 최근 글이 없습니다.</p>}
        {data.hasMore && <button className="home-more" type="button" disabled={busy || key !== current.current.key} onClick={() => void loadRef.current?.(true)}>{busy ? "불러오는 중" : "더 보기"}</button>}
        <p className="home-feed-note">최근 6시간 분석 표본 · 희망·공포 비율은 중립 제외</p>
      </section>
    </div>

    <section className="home-market" aria-label="주요 시장 지표"><h2>주요 시장 지표</h2><div>{data.market_indicators.map(indicator => <article key={indicator.id} data-market-context={getMarketColorContextForIndicator(indicator.id)} data-market-indicator-id={indicator.id}><span>{indicator.label}</span><strong>{indicator.value_text}</strong><span className={`home-market-${indicator.tone}`}>{indicator.delta_text}</span><small>{indicator.note}</small></article>)}</div></section>
  </div>;
}
