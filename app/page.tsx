import Link from "next/link";
import { fetchRecentFeedRows, filterRowsBySourceGroup, getFeedExactSourceOptions } from "@/lib/feed-data";
import { SOURCE_GROUPS, isSourceGroupId, type SourceGroupId } from "@/lib/feed-source-groups";
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

  return new Intl.DateTimeFormat("en-US", {
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
  const selectedLabel = pickFirst(searchParams?.label) as "bullish" | "bearish" | "neutral" | "";
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
    if (selectedLabel && row.label !== selectedLabel) {
      return false;
    }

    const analyzedAtMs = new Date(row.analyzed_at).getTime();
    if (Number.isNaN(analyzedAtMs)) {
      return false;
    }

    return nowMs - analyzedAtMs <= rangeHours * 60 * 60 * 1000;
  });

  return (
    <>
      <section className="panel">
        <h1>External Sentiment Feed</h1>
        <p className="muted">
          Pulls external community posts, classifies sentiment (bullish/bearish/neutral), and displays latest
          results.
        </p>

        <form className="actions" method="get">
          <label className="inline">
            <span>Channel</span>
            <select name="channel" defaultValue={selectedChannel}>
              <option value="">All Communities</option>
              {SOURCE_GROUPS.map((group) => (
                <option value={group.id} key={group.id}>
                  {group.label}
                </option>
              ))}
            </select>
          </label>

          <label className="inline">
            <span>Source</span>
            <select name="source" defaultValue={normalizedSelectedSource}>
              <option value="">All</option>
              {sourceOptions.map((source) => (
                <option value={source} key={source}>
                  {source}
                </option>
              ))}
            </select>
          </label>

          <label className="inline">
            <span>Label</span>
            <select name="label" defaultValue={selectedLabel}>
              <option value="">All</option>
              <option value="bullish">bullish</option>
              <option value="bearish">bearish</option>
              <option value="neutral">neutral</option>
            </select>
          </label>

          <label className="inline">
            <span>Range</span>
            <select name="range" defaultValue={selectedRange}>
              <option value="1h">1h</option>
              <option value="6h">6h</option>
              <option value="24h">24h</option>
            </select>
          </label>

          <button type="submit">Apply</button>
          <Link className="btn btn-secondary" href="/">
            Reset
          </Link>
        </form>
      </section>

      <section className="panel">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Source</th>
                <th>Title</th>
                <th>Label</th>
                <th>Confidence</th>
                <th>Time ({timezone})</th>
              </tr>
            </thead>
            <tbody>
              {errorMessage ? (
                <tr>
                  <td colSpan={5} className="error">
                    Failed to load feed: {errorMessage}
                  </td>
                </tr>
              ) : null}

              {!errorMessage && filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="muted">
                    No rows for current filters.
                  </td>
                </tr>
              ) : null}

              {filteredRows.map((row) => (
                <tr key={row.post_key}>
                  <td>
                    <span className="tag">{row.source}</span>
                  </td>
                  <td>
                    <a href={row.url} target="_blank" rel="noreferrer">
                      {row.title}
                    </a>
                  </td>
                  <td>{row.label}</td>
                  <td>{row.confidence.toFixed(2)}</td>
                  <td>{toLocalTime(row.analyzed_at, timezone)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
