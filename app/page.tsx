import Link from "next/link";
import { fetchRecentFeedRows, filterRowsBySourceGroup, getFeedExactSourceOptions } from "@/lib/feed-data";
import { SOURCE_GROUPS, isSourceGroupId, type SourceGroupId } from "@/lib/feed-source-groups";
import { SENTIMENT_DISPLAY } from "@/lib/sentiment-display";
import { getServiceSupabaseClient } from "@/lib/supabase/service";
import { getTimezone } from "@/lib/env";

type QueryValue = string | string[] | undefined;

const pickFirst = (value: QueryValue): string => {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
};

const rangeHoursMap: Record<string, number> = {
  "1h": 1,
  "6h": 6,
  "24h": 24
};

const toLocalTime = (iso: string, timezone: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: timezone
  }).format(date);
};

export default async function Home({
  searchParams
}: {
  searchParams?: Record<string, QueryValue>;
}) {
  const selectedSource = pickFirst(searchParams?.source);
  const selectedChannelRaw = pickFirst(searchParams?.channel);
  const selectedChannel: SourceGroupId | "" = isSourceGroupId(selectedChannelRaw) ? selectedChannelRaw : "";
  const selectedRange = pickFirst(searchParams?.range) || "24h";
  const rangeHours = rangeHoursMap[selectedRange] ?? 24;

  const service = getServiceSupabaseClient();
  const { rows, errorMessage } = await fetchRecentFeedRows(service, { hours: rangeHours, limit: 500 });

  const timezone = getTimezone();
  const channelFilteredRows = filterRowsBySourceGroup(rows, selectedChannel);
  const sourceOptions = getFeedExactSourceOptions(channelFilteredRows);
  const normalizedSelectedSource = sourceOptions.includes(selectedSource) ? selectedSource : "";
  const nowMs = Date.now();
  const filteredRows = channelFilteredRows.filter((row) => {
    if (normalizedSelectedSource && row.source !== normalizedSelectedSource) {
      return false;
    }

    const analyzedAtMs = new Date(row.analyzed_at).getTime();
    if (Number.isNaN(analyzedAtMs)) {
      return false;
    }

    return nowMs - analyzedAtMs <= rangeHours * 60 * 60 * 1000;
  });
  const actionableRows = filteredRows.filter((row) => row.label !== "neutral");
  const fearRows = actionableRows.filter((row) => row.label === "bearish");
  const hopeRows = actionableRows.filter((row) => row.label === "bullish");

  return (
    <>
      <section className="panel">
        <h1>외부 감성 피드</h1>
        <p className="muted">
          외부 커뮤니티에서 감지한 글 중 공포와 희망 흐름만 분리해서 보여줍니다. 중립 글은 기본적으로 숨깁니다.
        </p>

        <form className="actions" method="get">
          <label className="inline">
            <span>커뮤니티 묶음</span>
            <select name="channel" defaultValue={selectedChannel}>
              <option value="">전체</option>
              {SOURCE_GROUPS.map((group) => (
                <option value={group.id} key={group.id}>
                  {group.label}
                </option>
              ))}
            </select>
          </label>

          <label className="inline">
            <span>세부 소스</span>
            <select name="source" defaultValue={normalizedSelectedSource}>
              <option value="">전체</option>
              {sourceOptions.map((source) => (
                <option value={source} key={source}>
                  {source}
                </option>
              ))}
            </select>
          </label>

          <label className="inline">
            <span>범위</span>
            <select name="range" defaultValue={selectedRange}>
              <option value="1h">1h</option>
              <option value="6h">6h</option>
              <option value="24h">24h</option>
            </select>
          </label>

          <button type="submit">적용</button>
          <Link className="btn btn-secondary" href="/">
            초기화
          </Link>
        </form>
      </section>

      <section className="panel">
        <div className="sentiment-columns">
          <section className="sentiment-lane sentiment-lane-fear">
            <div className="sentiment-lane-head">
              <div>
                <p className="overview-kicker">공포 흐름</p>
                <h2>
                  {SENTIMENT_DISPLAY.bearish.emoji} 공포
                </h2>
              </div>
              <span className="tag">{fearRows.length}건</span>
            </div>

            {errorMessage ? <p className="error">피드를 불러오지 못했습니다: {errorMessage}</p> : null}
            {!errorMessage && fearRows.length === 0 ? <p className="muted">조건에 맞는 공포 글이 없습니다.</p> : null}

            <div className="sentiment-list">
              {fearRows.map((row) => (
                <article key={row.post_key} className="sentiment-card sentiment-card-fear">
                  <div className="sentiment-card-head">
                    <span className="tag">{row.source}</span>
                  </div>
                  <a className="sentiment-title" href={row.url} target="_blank" rel="noreferrer">
                    {row.title}
                  </a>
                  <p className="sentiment-meta">
                    <span>신뢰도 {row.confidence.toFixed(2)}</span>
                    <span>{toLocalTime(row.analyzed_at, timezone)}</span>
                  </p>
                </article>
              ))}
            </div>
          </section>

          <section className="sentiment-lane sentiment-lane-hope">
            <div className="sentiment-lane-head">
              <div>
                <p className="overview-kicker">희망 흐름</p>
                <h2>
                  {SENTIMENT_DISPLAY.bullish.emoji} 희망
                </h2>
              </div>
              <span className="tag">{hopeRows.length}건</span>
            </div>

            {errorMessage ? <p className="error">피드를 불러오지 못했습니다: {errorMessage}</p> : null}
            {!errorMessage && hopeRows.length === 0 ? <p className="muted">조건에 맞는 희망 글이 없습니다.</p> : null}

            <div className="sentiment-list">
              {hopeRows.map((row) => (
                <article key={row.post_key} className="sentiment-card sentiment-card-hope">
                  <div className="sentiment-card-head">
                    <span className="tag">{row.source}</span>
                  </div>
                  <a className="sentiment-title" href={row.url} target="_blank" rel="noreferrer">
                    {row.title}
                  </a>
                  <p className="sentiment-meta">
                    <span>신뢰도 {row.confidence.toFixed(2)}</span>
                    <span>{toLocalTime(row.analyzed_at, timezone)}</span>
                  </p>
                </article>
              ))}
            </div>
          </section>
        </div>
      </section>
    </>
  );
}
