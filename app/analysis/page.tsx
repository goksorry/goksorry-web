import type { Metadata } from "next";
import { ANALYSIS_SECTION_ORDER, fetchLatestAnalysisReport, type AnalysisItem, type AnalysisReport } from "@/lib/analysis-data";
import { resolveChartTrendTone, splitChartTrendText } from "@/lib/analysis-trend";
import { getMarketColorContextForAnalysisSection, getMarketColorContextForIndicator } from "@/lib/change-color-mode";
import { getCachedMarketOverview, type MarketIndicator } from "@/lib/overview-data";
import { buildPageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = buildPageMetadata({
  title: "분석",
  description: "삐에로봇이 LLM 평가를 1시간 주기로 실행해 한국/미국 뉴스, Top 10, 인기 카테고리, PER/PBR, 차트 상세를 분석한 결과입니다.",
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

const formatNewsTime = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value || "시간 정보 없음";
  }
  return formatKst(value);
};

const isReportStale = (report: AnalysisReport): boolean => {
  const asofMs = new Date(report.asof).getTime();
  return Number.isNaN(asofMs) || Date.now() - asofMs > 2 * 60 * 60 * 1000;
};

const formatReportError = (error: string): string => {
  if (error === "analysis_llm:budget exhausted") {
    return "LLM 평가 예산이 부족해 이번 리포트는 기본 산식 기반으로 생성되었습니다.";
  }

  return error;
};

const renderChartValue = (item: AnalysisItem) => {
  const trendTone = resolveChartTrendTone(item.value, item.tone);
  const tokenToneClass = trendTone === "up" || trendTone === "down" ? ` analysis-chart-trend-token-${trendTone}` : "";

  return (
    <strong className="analysis-item-value">
      {splitChartTrendText(item.value).map((segment, segmentIndex) =>
        segment.isTrendToken ? (
          <span key={`${segment.text}-${segmentIndex}`} className={`analysis-chart-trend-token${tokenToneClass}`}>
            {segment.text}
          </span>
        ) : (
          segment.text
        )
      )}
    </strong>
  );
};

const renderItem = (
  item: AnalysisItem,
  index: number,
  variant: "default" | "news" | "valuation" | "chart" = "default"
) => (
  <li
    key={`${item.label}-${index}`}
    className={`analysis-item ${variant === "news" ? "analysis-news-item" : ""} ${
      variant === "news" && item.translation ? "analysis-news-item-translated" : ""
    } ${
      variant === "valuation" ? "analysis-valuation-item" : ""
    } ${variant === "chart" ? "analysis-chart-item" : ""} analysis-tone-${item.tone}`}
  >
    {variant === "news" ? (
      <>
        <div className="analysis-news-meta">
          <span className="analysis-item-label">{item.label}</span>
          <time>{formatNewsTime(item.note)}</time>
        </div>
        {item.value ? <strong className="analysis-news-headline">{item.value}</strong> : null}
        {item.translation ? <strong className="analysis-news-translation">{item.translation}</strong> : null}
      </>
    ) : variant === "valuation" ? (
      <>
        <span className="analysis-item-label">{item.label}</span>
        <span className="analysis-valuation-spacer" aria-hidden="true" />
        <strong className="analysis-item-value">{item.value}</strong>
        <strong className="analysis-item-value analysis-valuation-pbr">{item.note}</strong>
      </>
    ) : (
      <>
        <div className="analysis-item-main">
          <span className="analysis-item-label">{item.label}</span>
          {item.value ? (
            variant === "chart" ? (
              renderChartValue(item)
            ) : (
              <strong className="analysis-item-value">{item.value}</strong>
            )
          ) : null}
        </div>
        {item.note ? <p>{item.note}</p> : null}
      </>
    )}
  </li>
);

const renderSectionItem = (sectionId: string) => (item: AnalysisItem, index: number) => {
  const variant =
    sectionId === "korean_news" || sectionId === "us_news"
      ? "news"
      : sectionId === "kr_valuation" || sectionId === "us_valuation"
        ? "valuation"
        : sectionId === "kr_chart_states" || sectionId === "us_chart_states"
          ? "chart"
          : "default";

  return renderItem(item, index, variant);
};

const renderMarketIndicator = (indicator: MarketIndicator) => (
  <article
    key={indicator.id}
    className={`overview-card overview-market-stat overview-tone-${indicator.tone ?? "flat"}`}
    data-market-context={getMarketColorContextForIndicator(indicator.id)}
    data-market-indicator-id={indicator.id}
  >
    <div className="overview-market-head">
      <p className="overview-label">{indicator.label}</p>
      <p className="overview-note" hidden={!indicator.note}>
        {indicator.note}
      </p>
    </div>
    <div className="overview-market-main">
      <strong className="overview-value">{indicator.value_text}</strong>
      <p className="overview-delta">{indicator.delta_text}</p>
    </div>
  </article>
);

const renderMarketStrip = (indicators: MarketIndicator[]) => (
  <section className="overview-market-block analysis-market-strip" aria-label="주요 시장 지표">
    <div className="overview-section-head">
      <h3>시장</h3>
      <p className="overview-section-copy">주요 지수와 환율의 최근 흐름 · 약 5분 캐시</p>
    </div>
    <div className="overview-market-row">{indicators.map(renderMarketIndicator)}</div>
  </section>
);

export default async function AnalysisPage() {
  const [report, marketOverview] = await Promise.all([fetchLatestAnalysisReport(), getCachedMarketOverview()]);
  const marketIndicators = marketOverview.market_indicators.slice(0, 4);

  if (!report) {
    return (
      <div className="analysis-page">
        {renderMarketStrip(marketIndicators)}
        <section className="panel analysis-empty">
          <p className="overview-kicker">삐에로봇 분석</p>
          <h1>분석</h1>
          <p className="muted">아직 저장된 분석 결과가 없습니다. 삐에로봇 첫 LLM 평가 이후 표시됩니다.</p>
        </section>
      </div>
    );
  }

  const stale = isReportStale(report);
  const sections = ANALYSIS_SECTION_ORDER.map((id) => report.payload.sections[id]);

  return (
    <div className="analysis-page">
      {renderMarketStrip(marketIndicators)}

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
          <p>LLM 평가 1시간 주기</p>
        </div>
      </section>

      {report.errors.length > 0 ? (
        <section className="panel analysis-error-panel">
          <h2>리포트 알림</h2>
          <ul>
            {report.errors.map((error) => (
              <li key={error}>{formatReportError(error)}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="analysis-grid" aria-label="분석 섹션">
        {sections.map((section) => (
          <article
            key={section.id}
            className={`analysis-card analysis-card-${section.id}`}
            data-market-context={getMarketColorContextForAnalysisSection(section.id)}
          >
            <div className="analysis-card-head">
              <h2>{section.title}</h2>
              <span>{section.items.length}건</span>
            </div>
            <p className="analysis-card-summary">{section.summary}</p>
            <ul className="analysis-list">
              {section.items.length > 0 ? (
                section.items.map(renderSectionItem(section.id))
              ) : (
                <li className="analysis-item analysis-tone-flat">대기 중</li>
              )}
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
