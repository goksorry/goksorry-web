import { SOURCE_GROUPS } from "@/lib/feed-source-groups";

export function MarketOverviewFallback() {
  return (
    <>
      <section className="overview-market-block">
        <div className="overview-section-head">
          <h3>시장</h3>
          <p className="overview-section-copy">주요 지수와 환율의 최근 흐름 · 약 5분 캐시</p>
        </div>
        <div className="overview-market-row">
          {["KOSPI", "KOSDAQ", "NASDAQ", "원/달러 환율"].map((label) => (
            <article key={label} className="overview-card overview-market-stat overview-tone-flat">
              <div className="overview-market-head">
                <p className="overview-label">{label}</p>
                <p className="overview-note">로딩중</p>
              </div>
              <div className="overview-market-main">
                <strong className="overview-value">로딩중</strong>
                <p className="overview-delta">로딩중</p>
              </div>
            </article>
          ))}
        </div>
      </section>
      <section className="overview-panel">
        <div className="overview-panel-art" aria-hidden="true" />
        <div className="overview-hero">
          <div className="overview-heading">
            <div className="overview-heading-copy">
              <p className="overview-kicker">커뮤니티 체감</p>
              <h2>곡소리 지수</h2>
              <p className="overview-timestamp">캐시 지수 준비 중</p>
            </div>
            <div className="overview-overall-score">
              <p className="overview-overall-label">최근 6시간 커뮤니티 평균</p>
              <strong className="overview-overall-value">
                --<span>/10</span>
              </strong>
              <p className="overview-overall-band">계산 중</p>
            </div>
          </div>
        </div>
        <section className="overview-section">
          <div className="overview-bottom-row">
            {SOURCE_GROUPS.map((group) => (
              <article key={group.id} className="overview-card overview-card-community overview-tone-mixed">
                <div className="overview-community-head">
                  <p className="overview-label">{group.label}</p>
                  <span className="overview-score-badge">로딩중</span>
                </div>
                <p className="overview-delta">로딩중</p>
              </article>
            ))}
          </div>
        </section>
      </section>
    </>
  );
}
