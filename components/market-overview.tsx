"use client";

import { startTransition, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { CommunityIndicatorsPayload, OverviewPayload } from "@/lib/overview-data";
import type { SourceGroupSummary } from "@/lib/feed-data";
import { SOURCE_GROUPS, type SourceGroupId } from "@/lib/feed-source-groups";
import { SENTIMENT_DISPLAY, TONE_EMOJI } from "@/lib/sentiment-display";

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

const EMPTY_COMMUNITY_GROUPS: SourceGroupSummary[] = SOURCE_GROUPS.map((group) => ({
  id: group.id,
  label: group.label,
  shortLabel: group.shortLabel,
  mentions: 0,
  bullish: 0,
  bearish: 0,
  neutral: 0,
  score: 50,
  tone: "mixed",
  rows: []
}));

export function MarketOverview({ marketOverview }: MarketOverviewProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
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
      startTransition(() => {
        router.push(`/?${nextParams.toString()}`);
      });
      return;
    }

    if (pathname.startsWith("/community")) {
      setActiveGroupId(groupId);
      return;
    }

    startTransition(() => {
      router.push(`/?channels=${groupId}`);
    });
  };

  const activeGroup = payload?.community_indicators.find((group) => group.id === activeGroupId) ?? null;
  const communityGroups = payload?.community_indicators ?? EMPTY_COMMUNITY_GROUPS;
  const communityLoading = payload === null && !error;
  const actionableActiveRows = activeGroup?.rows.filter((row) => row.label !== "neutral") ?? [];

  return (
    <>
      <section className="overview-panel">
        <div className="overview-heading">
          <div className="overview-heading-copy">
            <p className="overview-kicker">시장 · 커뮤니티 체감</p>
            <h2>실시간 체감 지수</h2>
          </div>
          <p className="overview-timestamp">
            {marketOverview.generated_at ? `업데이트 ${toLocalTime(marketOverview.generated_at)}` : "캐시 지수 준비 중"}
          </p>
        </div>

        {error ? <p className="error">커뮤니티 지수 로드 실패: {error}</p> : null}

        <div className="overview-top-row">
          {marketOverview.market_indicators.map((indicator) => (
            <article
              key={indicator.id}
              className={`overview-card overview-card-market overview-tone-${indicator.tone ?? "flat"}`}
            >
              <p className="overview-label">{indicator.label}</p>
              <div className="overview-market-main">
                <strong className="overview-value">{indicator.value_text}</strong>
                <p className="overview-delta">{indicator.delta_text}</p>
              </div>
              <p className="overview-note">{indicator.note}</p>
            </article>
          ))}
        </div>

        <div className="overview-bottom-row">
          {communityGroups.map((group) => (
            <button
              key={group.id}
              type="button"
              className={`overview-card overview-card-community overview-tone-${group.tone}`}
              onClick={() => onCommunityIndicatorClick(group.id)}
              disabled={communityLoading}
            >
              <div className="overview-community-head">
                <p className="overview-label">{group.label}</p>
                <span className="overview-score-badge">
                  {communityLoading ? (
                    <span>로딩중</span>
                  ) : (
                    <>
                      <span>{TONE_EMOJI[group.tone]}</span>
                      <span>{group.score}</span>
                    </>
                  )}
                </span>
              </div>
              <p className="overview-delta">{communityLoading ? "로딩중" : `언급 ${group.mentions} · 희망 ${group.bullish} · 공포 ${group.bearish}`}</p>
            </button>
          ))}
        </div>
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

            <div className="overview-modal-list">
              {actionableActiveRows.map((row) => (
                <article key={row.post_key} className="overview-modal-item">
                  <div className="overview-modal-meta">
                    <span className="tag">{row.source}</span>
                    <span className={`overview-inline-tone overview-inline-tone-${row.label}`}>
                      {SENTIMENT_DISPLAY[row.label].emoji} {SENTIMENT_DISPLAY[row.label].label}
                    </span>
                    <span className="muted">확신도 {row.confidence.toFixed(2)}</span>
                    <span className="muted">{toLocalTime(row.analyzed_at)}</span>
                  </div>
                  <a href={row.url} target="_blank" rel="noreferrer">
                    {row.title}
                  </a>
                </article>
              ))}

              {actionableActiveRows.length === 0 ? <p className="muted">최근 24시간 기준 공포/희망 감지 글이 없습니다.</p> : null}
            </div>

            <div className="overview-modal-actions">
              <Link className="btn" href={`/?channels=${activeGroup.id}`} onClick={() => setActiveGroupId(null)}>
                피드에서 열기
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
