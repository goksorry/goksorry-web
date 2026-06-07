import { MarketOverviewFallback } from "@/components/market-overview-fallback";

type FeedLaneProps = {
  tone: "fear" | "hope";
  label: string;
};

const skeletonLines = (count: number, prefix: string) =>
  Array.from({ length: count }).map((_, index) => <span key={`${prefix}-${index}`} className="page-skeleton-line" />);

const skeletonTags = (count: number, prefix: string) =>
  Array.from({ length: count }).map((_, index) => <span key={`${prefix}-${index}`} className="page-skeleton-tag" />);

function LoadingFeedLane({ tone, label }: FeedLaneProps) {
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

function SkeletonPostRows({ rows = 5, showBoard = false }: { rows?: number; showBoard?: boolean }) {
  return (
    <div className="community-post-list page-skeleton-post-list" aria-hidden="true">
      {Array.from({ length: rows }).map((_, index) => (
        <article key={index} className={`community-post-row${showBoard ? " community-post-row-board" : ""}`}>
          {showBoard ? <span className="page-skeleton-line page-skeleton-board-label" /> : null}
          <span className="page-skeleton-line page-skeleton-post-title" />
          <span className="page-skeleton-line page-skeleton-post-meta" />
        </article>
      ))}
    </div>
  );
}

function SkeletonAnalysisCard({ id, wide = true }: { id: string; wide?: boolean }) {
  return (
    <article className={`analysis-card analysis-card-${id}${wide ? " page-skeleton-analysis-wide" : ""}`}>
      <div className="analysis-card-head">
        <h2>
          <span className="page-skeleton-line page-skeleton-heading" />
        </h2>
        <span>
          <span className="page-skeleton-line page-skeleton-count" />
        </span>
      </div>
      <p className="analysis-card-summary">
        <span className="page-skeleton-line" />
      </p>
      <ul className="analysis-list" aria-hidden="true">
        {Array.from({ length: wide ? 3 : 2 }).map((_, index) => (
          <li key={index} className="analysis-item analysis-tone-flat">
            <div className="analysis-item-main">
              <span className="page-skeleton-line page-skeleton-item-label" />
              <span className="page-skeleton-line page-skeleton-item-value" />
            </div>
            <p>
              <span className="page-skeleton-line" />
            </p>
          </li>
        ))}
      </ul>
    </article>
  );
}

export function HomePageLoading() {
  return (
    <>
      <MarketOverviewFallback />
      <section id="feed-top" className="panel feed-filter-panel scroll-anchor" aria-busy="true">
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

export function AnalysisPageLoading() {
  return (
    <div className="analysis-page page-skeleton page-skeleton-analysis" aria-busy="true">
      <section className="overview-market-block analysis-market-strip" aria-label="분석 시장 지표 로딩 중">
        <div className="overview-section-head">
          <h3>시장</h3>
          <p className="overview-section-copy">주요 지수와 환율 흐름을 불러오는 중입니다.</p>
        </div>
        <div className="overview-market-row" aria-hidden="true">
          {Array.from({ length: 4 }).map((_, index) => (
            <article key={index} className="overview-card overview-market-stat">
              {skeletonLines(3, `market-${index}`)}
            </article>
          ))}
        </div>
      </section>

      <section className="analysis-hero panel">
        <div className="analysis-hero-copy" aria-hidden="true">
          <p className="overview-kicker">삐에로봇 분석</p>
          <h1>분석</h1>
          {skeletonLines(4, "analysis-brief")}
        </div>
        <div className="analysis-status-card" aria-hidden="true">
          {skeletonLines(4, "analysis-status")}
        </div>
      </section>

      <section className="analysis-grid" aria-label="분석 섹션 로딩 중">
        {["kr_categories", "us_categories", "korean_news", "us_news", "kr_top10", "us_top10"].map((id) => (
          <SkeletonAnalysisCard key={id} id={id} />
        ))}
        {["kr_large_popular_changes", "us_large_popular_changes", "kr_chart_states", "us_chart_states"].map((id) => (
          <SkeletonAnalysisCard key={id} id={id} wide={false} />
        ))}
      </section>
    </div>
  );
}

export function CommunityPageLoading() {
  return (
    <>
      <section className="panel community-board-panel page-skeleton" aria-busy="true">
        <h1>게시판</h1>
        <div className="board-grid" aria-hidden="true">
          {Array.from({ length: 4 }).map((_, index) => (
            <span key={index} className="card board-card page-skeleton-board-card">
              <span className="page-skeleton-line page-skeleton-heading" />
            </span>
          ))}
        </div>
      </section>
      <section className="panel page-skeleton" aria-busy="true">
        <h2>최근 글</h2>
        <SkeletonPostRows showBoard />
      </section>
    </>
  );
}

export function CommunityBoardPageLoading() {
  return (
    <section className="panel page-skeleton" aria-busy="true">
      <h1>
        <span className="page-skeleton-line page-skeleton-form-title" />
      </h1>
      <p className="muted">
        <span className="page-skeleton-line page-skeleton-post-meta-wide" />
      </p>
      <div className="actions" aria-hidden="true">{skeletonTags(2, "board-actions")}</div>
      <SkeletonPostRows />
    </section>
  );
}

export function CommunityPostPageLoading() {
  return (
    <>
      <section className="panel page-skeleton" aria-busy="true">
        <h1>
          <span className="page-skeleton-line page-skeleton-post-detail-title" />
        </h1>
        <p className="muted">
          <span className="page-skeleton-line page-skeleton-post-meta-wide" />
        </p>
        <div className="page-skeleton-article-body" aria-hidden="true">{skeletonLines(7, "post-body")}</div>
      </section>
      <section className="panel page-skeleton" aria-busy="true">
        <h2>댓글</h2>
        <SkeletonPostRows rows={3} />
      </section>
    </>
  );
}

export function CommunityFormPageLoading() {
  return (
    <section className="panel page-skeleton page-skeleton-form" aria-busy="true">
      <h1>
        <span className="page-skeleton-line page-skeleton-form-title" />
      </h1>
      <div aria-hidden="true">
        <span className="page-skeleton-line page-skeleton-input" />
        <span className="page-skeleton-line page-skeleton-textarea" />
        <span className="page-skeleton-line page-skeleton-button" />
      </div>
    </section>
  );
}

export function GoksorryRoomPageLoading() {
  return (
    <section className="panel goksorry-room-panel page-skeleton page-skeleton-room" aria-busy="true">
      <h1>곡소리방</h1>
      <div className="goksorry-room-form" aria-hidden="true">
        <span className="page-skeleton-line page-skeleton-input" />
        <span className="page-skeleton-line page-skeleton-button" />
      </div>
      <div className="goksorry-room-list" aria-hidden="true">
        {Array.from({ length: 6 }).map((_, index) => (
          <article key={index} className="goksorry-room-entry page-skeleton-room-entry">
            {skeletonLines(index % 2 === 0 ? 2 : 3, `room-${index}`)}
          </article>
        ))}
      </div>
    </section>
  );
}

export function ChatPageLoading() {
  return (
    <section className="panel chat-page-panel page-skeleton page-skeleton-chat" aria-busy="true">
      <h1>전체 채팅</h1>
      <div className="page-skeleton-chat-log" aria-hidden="true">
        {Array.from({ length: 8 }).map((_, index) => (
          <span key={index} className={`page-skeleton-line page-skeleton-chat-bubble ${index % 2 ? "page-skeleton-chat-bubble-alt" : ""}`} />
        ))}
      </div>
      <div className="page-skeleton-chat-input" aria-hidden="true">
        <span className="page-skeleton-line page-skeleton-input" />
        <span className="page-skeleton-line page-skeleton-button" />
      </div>
    </section>
  );
}

export function ProfilePageLoading() {
  return (
    <section className="panel page-skeleton page-skeleton-form" aria-busy="true">
      <h1>내 프로필</h1>
      <p className="muted">계정 정보를 확인하는 중입니다.</p>
      <div aria-hidden="true">
        <span className="page-skeleton-line page-skeleton-input" />
        <span className="page-skeleton-line page-skeleton-input" />
        <span className="page-skeleton-line page-skeleton-policy" />
        <span className="page-skeleton-line page-skeleton-button" />
      </div>
    </section>
  );
}

export function AuthPageLoading() {
  return (
    <section className="panel page-skeleton page-skeleton-auth" aria-busy="true">
      <h1>로그인</h1>
      <p className="muted">로그인 화면을 준비하는 중입니다.</p>
      <div aria-hidden="true">
        <span className="page-skeleton-line page-skeleton-auth-button" />
        <span className="page-skeleton-line page-skeleton-policy" />
      </div>
    </section>
  );
}

export function DocsPageLoading() {
  return (
    <section className="panel docs-shell page-skeleton page-skeleton-docs" aria-busy="true">
      <div className="docs-hero">
        <div>
          <p className="docs-kicker">API 문서</p>
          <h1>문서</h1>
          {skeletonLines(2, "docs-hero")}
        </div>
        <div className="actions" aria-hidden="true">{skeletonTags(2, "docs-action")}</div>
      </div>
      <div className="docs-top-grid" aria-hidden="true">
        {Array.from({ length: 2 }).map((_, index) => (
          <article key={index} className="card">
            {skeletonLines(5, `docs-card-${index}`)}
          </article>
        ))}
      </div>
      <article className="card docs-code" aria-hidden="true">
        {skeletonLines(6, "docs-code")}
      </article>
    </section>
  );
}

export function PolicyPageLoading({ title }: { title: string }) {
  return (
    <section className="panel page-skeleton page-skeleton-policy-page" aria-busy="true">
      <h1>{title}</h1>
      <article aria-hidden="true">
        {skeletonLines(10, "policy")}
      </article>
    </section>
  );
}

export function AdminPageLoading() {
  return (
    <section className="panel page-skeleton page-skeleton-admin" aria-busy="true">
      <h1>관리자</h1>
      <div className="page-skeleton-admin-toolbar" aria-hidden="true">
        <span className="page-skeleton-line page-skeleton-input" />
        <span className="page-skeleton-line page-skeleton-button" />
      </div>
      <div className="table-wrap" aria-hidden="true">
        <div className="page-skeleton-admin-table">
          {Array.from({ length: 7 }).map((_, index) => (
            <span key={index} className="page-skeleton-line" />
          ))}
        </div>
      </div>
    </section>
  );
}
