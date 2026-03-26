"use client";

import { CrossfadeContent } from "@/components/crossfade-content";
import { startTransition, useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useFeedSelection } from "@/components/feed-selection-provider";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCleanFilter } from "@/components/clean-filter-provider";
import { CLEAN_FILTER_APPLY_DURATION_MS, resolveDisplayTitle } from "@/lib/clean-filter";
import type { CommunityIndicatorsPayload, OverviewPayload } from "@/lib/overview-data";
import type { SourceGroupSummary } from "@/lib/feed-data";
import { SOURCE_GROUPS, type SourceGroupId } from "@/lib/feed-source-groups";
import { SENTIMENT_BAND_DISPLAY, SENTIMENT_DISPLAY, TONE_EMOJI } from "@/lib/sentiment-display";
import type { SentimentBand } from "@/lib/sentiment-score";

const toLocalTime = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
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

type MarketOverviewProps = {
  marketOverview: Pick<OverviewPayload, "generated_at" | "market_indicators">;
};

type OverviewArtStyle = CSSProperties & {
  "--overview-art-light": string;
  "--overview-art-dark": string;
};

const OVERVIEW_REGIME_ART_SLUG: Record<SentimentBand, string> = {
  extreme_bearish: "extreme-bearish",
  bearish: "bearish",
  neutral: "neutral",
  bullish: "bullish",
  extreme_bullish: "extreme-bullish"
};

const buildOverviewArtStyle = (band: SentimentBand): OverviewArtStyle => {
  const slug = OVERVIEW_REGIME_ART_SLUG[band];
  return {
    "--overview-art-light": `url("/images/overview-regimes/overview-regime-${slug}-light.webp")`,
    "--overview-art-dark": `url("/images/overview-regimes/overview-regime-${slug}-dark.webp")`
  };
};

const EMPTY_COMMUNITY_GROUPS: SourceGroupSummary[] = SOURCE_GROUPS.map((group) => ({
  id: group.id,
  label: group.label,
  shortLabel: group.shortLabel,
  mentions: 0,
  bullish: 0,
  bearish: 0,
  neutral: 0,
  score: 5,
  sentiment_band: "neutral",
  tone: "mixed",
  rows: []
}));

export function MarketOverview({ marketOverview }: MarketOverviewProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { cleanFilterEnabled } = useCleanFilter();
  const { activeGroupIds, setOptimisticGroupIds } = useFeedSelection();
  const [payload, setPayload] = useState<CommunityIndicatorsPayload | null>(null);
  const [error, setError] = useState("");
  const [activeGroupId, setActiveGroupId] = useState<SourceGroupId | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      try {
        const response = await fetch("/api/community-indicators", {
          signal: controller.signal,
          cache: "default"
        });
        if (!response.ok) {
          throw new Error(`community indicators ${response.status}`);
        }
        const data = (await response.json()) as CommunityIndicatorsPayload;
        setPayload(data);
        setError("");
      } catch {
        if (controller.signal.aborted) {
          return;
        }
        setError("지수 불러오기에 실패했습니다.");
      }
    };

    void load();

    return () => {
      controller.abort();
    };
  }, []);

  useEffect(() => {
    setActiveGroupId(null);
  }, [pathname]);

  useEffect(() => {
    if (!activeGroupId) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveGroupId(null);
      }
    };

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [activeGroupId]);

  const onCommunityIndicatorClick = (groupId: SourceGroupId) => {
    if (pathname === "/") {
      const nextParams = new URLSearchParams(searchParams.toString());
      nextParams.set("channels", groupId);
      nextParams.delete("channel");
      nextParams.delete("source");
      setOptimisticGroupIds([groupId]);
      startTransition(() => {
        router.replace(`/?${nextParams.toString()}`, { scroll: false });
      });
      return;
    }

    if (pathname.startsWith("/community")) {
      setActiveGroupId(groupId);
      return;
    }

    setOptimisticGroupIds([groupId]);
    startTransition(() => {
      router.push(`/?channels=${groupId}`);
    });
  };

  const activeGroup = payload?.community_indicators.find((group) => group.id === activeGroupId) ?? null;
  const communityGroups = payload?.community_indicators ?? EMPTY_COMMUNITY_GROUPS;
  const communityLoading = payload === null && !error;
  const actionableActiveRows = activeGroup?.rows.filter((row) => row.label !== "neutral") ?? [];
  const selectedFeedGroupId = pathname === "/" && activeGroupIds.length === 1 ? activeGroupIds[0] : null;
  const overallCommunityScore = payload?.overall_sentiment_score ?? 5;
  const overallCommunityBand = payload?.overall_sentiment_band ?? "neutral";
  const overallCommunityLabel = communityLoading
    ? "계산 중"
    : SENTIMENT_BAND_DISPLAY[overallCommunityBand].label;
  const overviewArtStyle = buildOverviewArtStyle(overallCommunityBand);

  return (
    <>
      <section className="overview-market-block">
        <div className="overview-section-head">
          <h3>시장</h3>
          <p className="overview-section-copy">주요 지수와 환율의 최근 흐름</p>
        </div>
        <div className="overview-market-row">
          {marketOverview.market_indicators.map((indicator) => (
            <article key={indicator.id} className={`overview-card overview-market-stat overview-tone-${indicator.tone ?? "flat"}`}>
              <p className="overview-label">{indicator.label}</p>
              <div className="overview-market-main">
                <strong className="overview-value">{indicator.value_text}</strong>
                <p className="overview-delta">{indicator.delta_text}</p>
              </div>
              <p className="overview-note">{indicator.note}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="overview-panel" style={overviewArtStyle}>
        <div className="overview-panel-art" aria-hidden="true" />
        <div className="overview-hero">
          <div className="overview-heading">
            <div className="overview-heading-copy">
              <p className="overview-kicker">커뮤니티 체감</p>
              <h2>실시간 체감 지수</h2>
              <p className="overview-timestamp">
                {marketOverview.generated_at ? `업데이트 ${toLocalTime(marketOverview.generated_at)}` : "캐시 지수 준비 중"}
              </p>
            </div>
            <div className="overview-overall-score" aria-live="polite">
              <p className="overview-overall-label">최근 6시간 커뮤니티 평균</p>
              <strong className="overview-overall-value">
                {communityLoading ? "--" : overallCommunityScore.toFixed(1)}
                <span>/10</span>
              </strong>
              <p className="overview-overall-band">{overallCommunityLabel}</p>
            </div>
          </div>

          {error ? <p className="error overview-hero-error">커뮤니티 지수 로드 실패: {error}</p> : null}
        </div>

        <section className="overview-section">
          <div className="overview-section-head">
            <h3>커뮤니티</h3>
            <p className="overview-section-copy">최근 6시간 채널별 분위기와 언급 흐름</p>
          </div>
          <div className="overview-bottom-row">
            {communityGroups.map((group) => (
              <button
                key={group.id}
                type="button"
                className={`overview-card overview-card-community overview-tone-${group.tone}${selectedFeedGroupId === group.id ? " overview-card-active" : ""}`}
                onClick={() => onCommunityIndicatorClick(group.id)}
                disabled={communityLoading}
                aria-pressed={selectedFeedGroupId === group.id}
              >
                <div className="overview-community-head">
                  <p className="overview-label">{group.label}</p>
                  <span className="overview-score-badge">
                    {communityLoading ? (
                      <span>로딩중</span>
                    ) : (
                      <>
                        <span>{SENTIMENT_BAND_DISPLAY[group.sentiment_band].emoji ?? TONE_EMOJI[group.tone]}</span>
                        <span>{group.score.toFixed(1)}</span>
                      </>
                    )}
                  </span>
                </div>
                <p className="overview-delta">
                  {communityLoading
                    ? "로딩중"
                    : `${SENTIMENT_BAND_DISPLAY[group.sentiment_band].label} · 언급 ${group.mentions} · 희망 ${group.bullish} · 공포 ${group.bearish}`}
                </p>
              </button>
            ))}
          </div>
        </section>
      </section>

      {activeGroup ? (
        <div className="overview-modal-backdrop" role="presentation" onClick={() => setActiveGroupId(null)}>
          <div className="overview-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <div className="overview-modal-head">
              <div>
                <p className="overview-kicker">커뮤니티 피드 미리보기</p>
                <h3>{activeGroup.label}</h3>
              </div>
              <button type="button" className="btn btn-secondary" onClick={() => setActiveGroupId(null)}>
                닫기
              </button>
            </div>

            <CrossfadeContent
              swapKey={cleanFilterEnabled ? "pretty" : "grim"}
              durationMs={CLEAN_FILTER_APPLY_DURATION_MS}
            >
              <div className="overview-modal-list">
                {actionableActiveRows.map((row) => {
                  const displayTitle = resolveDisplayTitle({
                    title: row.title,
                    cleanTitle: row.clean_title,
                    cleanFilterEnabled
                  });

                  return (
                    <article key={row.post_key} className="overview-modal-item">
                      <div className="overview-modal-meta">
                        <span className="tag">{row.source}</span>
                        <span className={`overview-inline-tone overview-inline-tone-${row.label}`}>
                          {SENTIMENT_DISPLAY[row.label].emoji} {SENTIMENT_DISPLAY[row.label].label}
                        </span>
                        <span className="muted">확신도 {row.confidence.toFixed(2)}</span>
                        <span className="muted">{toLocalTime(row.analyzed_at)}</span>
                      </div>
                      <a
                        className={displayTitle.usedFallbackFilter ? "fallback-clean-title" : ""}
                        href={row.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {displayTitle.text}
                      </a>
                    </article>
                  );
                })}

                {actionableActiveRows.length === 0 ? <p className="muted">최근 24시간 기준 공포/희망 감지 글이 없습니다.</p> : null}
              </div>
            </CrossfadeContent>

            <div className="overview-modal-actions">
              <Link
                className="btn"
                href={`/?channels=${activeGroup.id}`}
                onClick={() => {
                  setActiveGroupId(null);
                  setOptimisticGroupIds([activeGroup.id]);
                }}
              >
                피드에서 열기
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
