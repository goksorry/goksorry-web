"use client";

import { startTransition, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { OverviewPayload } from "@/lib/overview-data";
import { SOURCE_GROUPS, type SourceGroupId } from "@/lib/feed-source-groups";

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

export function MarketOverview() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [payload, setPayload] = useState<OverviewPayload | null>(null);
  const [error, setError] = useState("");
  const [activeGroupId, setActiveGroupId] = useState<SourceGroupId | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      try {
        const response = await fetch("/api/overview", {
          signal: controller.signal,
          cache: "no-store"
        });
        if (!response.ok) {
          throw new Error(`overview ${response.status}`);
        }
        const data = (await response.json()) as OverviewPayload;
        setPayload(data);
        setError("");
      } catch (loadError) {
        if (controller.signal.aborted) {
          return;
        }
        setError(loadError instanceof Error ? loadError.message : "overview fetch failed");
      }
    };

    void load();
    const timer = window.setInterval(() => {
      void load();
    }, 60000);

    return () => {
      controller.abort();
      window.clearInterval(timer);
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
      nextParams.set("channel", groupId);
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
      router.push(`/?channel=${groupId}`);
    });
  };

  const activeGroup = payload?.community_indicators.find((group) => group.id === activeGroupId) ?? null;

  return (
    <>
      <section className="overview-panel">
        <div className="overview-heading">
          <div>
            <p className="overview-kicker">Market & Community Pulse</p>
            <h2>실시간 체감 지수</h2>
          </div>
          <p className="muted">
            {payload?.generated_at ? `업데이트 ${toLocalTime(payload.generated_at)}` : "상단 지수를 불러오는 중"}
          </p>
        </div>

        {error ? <p className="error">Overview load failed: {error}</p> : null}

        <div className="overview-top-row">
          {(payload?.market_indicators ?? Array.from({ length: 5 })).map((indicator: any, index) => (
            <article
              key={indicator?.id ?? `market-skeleton-${index}`}
              className={`overview-card overview-card-market overview-tone-${indicator?.tone ?? "flat"}`}
            >
              <p className="overview-label">{indicator?.label ?? "Loading"}</p>
              <strong className="overview-value">{indicator?.value_text ?? "--"}</strong>
              <p className="overview-delta">{indicator?.delta_text ?? "loading..."}</p>
              <p className="overview-note">{indicator?.note ?? "지표 준비 중"}</p>
            </article>
          ))}
        </div>

        <div className="overview-bottom-row">
          {(payload?.community_indicators ?? SOURCE_GROUPS.map((group) => ({ ...group, score: 50, mentions: 0, tone: "mixed" })) as any[]).map(
            (group: any) => (
              <button
                key={group.id}
                type="button"
                className={`overview-card overview-card-community overview-tone-${group.tone ?? "mixed"}`}
                onClick={() => onCommunityIndicatorClick(group.id)}
              >
                <div className="overview-community-head">
                  <p className="overview-label">{group.label}</p>
                  <span className="overview-score-badge">{group.score}</span>
                </div>
                <strong className="overview-value">{group.shortLabel}</strong>
                <p className="overview-delta">
                  mentions {group.mentions} · bull {group.bullish ?? 0} · bear {group.bearish ?? 0}
                </p>
                <p className="overview-note">
                  {pathname === "/" ? "클릭 시 Feed 필터 적용" : pathname.startsWith("/community") ? "클릭 시 팝업 미리보기" : "클릭 시 Feed 이동"}
                </p>
              </button>
            )
          )}
        </div>
      </section>

      {activeGroup ? (
        <div className="overview-modal-backdrop" role="presentation" onClick={() => setActiveGroupId(null)}>
          <div className="overview-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <div className="overview-modal-head">
              <div>
                <p className="overview-kicker">Community Feed Preview</p>
                <h3>{activeGroup.label}</h3>
              </div>
              <button type="button" className="btn btn-secondary" onClick={() => setActiveGroupId(null)}>
                Close
              </button>
            </div>

            <div className="overview-modal-list">
              {activeGroup.rows.map((row) => (
                <article key={row.post_key} className="overview-modal-item">
                  <div className="overview-modal-meta">
                    <span className="tag">{row.source}</span>
                    <span className={`overview-inline-tone overview-inline-tone-${row.label}`}>{row.label}</span>
                    <span className="muted">{row.confidence.toFixed(2)}</span>
                    <span className="muted">{toLocalTime(row.analyzed_at)}</span>
                  </div>
                  <a href={row.url} target="_blank" rel="noreferrer">
                    {row.title}
                  </a>
                </article>
              ))}

              {activeGroup.rows.length === 0 ? <p className="muted">최근 24시간 기준 외부 감지 글이 없습니다.</p> : null}
            </div>

            <div className="overview-modal-actions">
              <Link className="btn" href={`/?channel=${activeGroup.id}`} onClick={() => setActiveGroupId(null)}>
                Feed에서 열기
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
