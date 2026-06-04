import type { Metadata } from "next";
import { ANALYSIS_SECTION_ORDER, fetchLatestAnalysisReport, type AnalysisItem, type AnalysisReport } from "@/lib/analysis-data";
import { buildPageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = buildPageMetadata({
  title: "분석",
  description: "삐에로봇이 30분 주기로 뉴스, Top 10, 환율, 시장, 인기 테마, PER/PBR, 차트 상태를 분석한 결과입니다.",
  path: "/analysis"
});

const formatKst = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "시간 정보 없음";
  }
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Seoul"
  }).format(date);
};

const isReportStale = (report: AnalysisReport): boolean => {
  const asofMs = new Date(report.asof).getTime();
  return Number.isNaN(asofMs) || Date.now() - asofMs > 60 * 60 * 1000;
};

const renderItem = (item: AnalysisItem, index: number) => (
  <li key={`${item.label}-${index}`} className={`analysis-item analysis-tone-${item.tone}`}>
    <div className="analysis-item-main">
      <span className="analysis-item-label">{item.label}</span>
      {item.value ? <strong className="analysis-item-value">{item.value}</strong> : null}
    </div>
    {item.note ? <p>{item.note}</p> : null}
  </li>
);

export default async function AnalysisPage() {
  const report = await fetchLatestAnalysisReport();

  if (!report) {
    return (
      <section className="panel analysis-empty">
        <p className="overview-kicker">삐에로봇 분석</p>
        <h1>분석</h1>
        <p className="muted">아직 저장된 분석 결과가 없습니다. 삐에로봇 첫 30분 분석 이후 표시됩니다.</p>
      </section>
    );
  }

  const stale = isReportStale(report);
  const sections = ANALYSIS_SECTION_ORDER.map((id) => report.payload.sections[id]);

  return (
    <div className="analysis-page">
      <section className="analysis-hero panel">
        <div className="analysis-hero-copy">
          <p className="overview-kicker">삐에로봇 분석</p>
          <h1>분석</h1>
          <p>{report.payload.headline}</p>
          <p className="muted">{report.summary}</p>
        </div>
        <div className="analysis-status-card">
          <span className={`analysis-status analysis-status-${report.status}`}>{report.status}</span>
          {stale ? <span className="analysis-status analysis-status-stale">stale</span> : null}
          <p>업데이트 {formatKst(report.asof)}</p>
          <p>30분 주기</p>
        </div>
      </section>

      {report.errors.length > 0 ? (
        <section className="panel analysis-error-panel">
          <h2>수집 오류</h2>
          <ul>
            {report.errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="analysis-grid" aria-label="분석 섹션">
        {sections.map((section) => (
          <article key={section.id} className={`analysis-card analysis-card-${section.id}`}>
            <div className="analysis-card-head">
              <h2>{section.title}</h2>
              <span>{section.items.length}건</span>
            </div>
            <p className="analysis-card-summary">{section.summary}</p>
            <ul className="analysis-list">
              {section.items.length > 0 ? section.items.map(renderItem) : <li className="analysis-item analysis-tone-flat">대기 중</li>}
            </ul>
          </article>
        ))}
      </section>

      {report.payload.important_symbols.length > 0 ? (
        <section className="panel analysis-symbol-panel">
          <h2>중요 종목</h2>
          <div className="analysis-symbols">
            {report.payload.important_symbols.map((symbol) => (
              <span key={symbol} className="tag">
                {symbol}
              </span>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
