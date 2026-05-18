import { MarketOverviewFallback } from "@/components/market-overview-fallback";

function LoadingFeedLane({ tone, label }: { tone: "fear" | "hope"; label: string }) {
  return (
    <section className={`sentiment-lane sentiment-lane-${tone}`}>
      <div className="sentiment-lane-head">
        <h2>
          {label}
          <span className="tag sentiment-count-tag">로딩</span>
        </h2>
        <span className={`sentiment-lane-watermark sentiment-lane-watermark-${tone}`} aria-hidden="true">
          {tone === "fear" ? "🤡" : "🥂"}
        </span>
      </div>
      <p className="muted feed-loading-status">피드를 불러오는 중입니다.</p>
      <div className="sentiment-list" />
      <div className="feed-skeleton-list" aria-hidden="true">
        {Array.from({ length: 4 }).map((_, index) => (
          <article key={index} className={`sentiment-card sentiment-card-${tone} feed-skeleton-card`}>
            <div className="sentiment-card-head">
              <div className="sentiment-card-head-tags">
                <span className="feed-skeleton-pill feed-skeleton-pill-source" />
                <span className="feed-skeleton-pill feed-skeleton-pill-symbol" />
              </div>
              <span className="feed-skeleton-pill feed-skeleton-pill-time" />
            </div>
            <div className="sentiment-card-body">
              <span className="feed-skeleton-title" />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default function Loading() {
  return (
    <>
      <MarketOverviewFallback />
      <section id="feed-top" className="panel feed-filter-panel scroll-anchor">
        <h1>외부 감성 피드</h1>
        <p className="muted feed-loading-copy">최근 커뮤니티 감성 피드를 준비하고 있습니다.</p>
        <div className="feed-filter-skeleton-actions" aria-hidden="true">
          {Array.from({ length: 6 }).map((_, index) => (
            <span key={index} className="feed-skeleton-pill feed-skeleton-filter-chip" />
          ))}
        </div>
      </section>
      <section className="panel feed-lanes-panel" aria-label="외부 감성 피드 로딩 중">
        <div className="sentiment-columns">
          <LoadingFeedLane tone="fear" label="공포" />
          <LoadingFeedLane tone="hope" label="희망" />
        </div>
      </section>
    </>
  );
}
