"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { buildCleanFilterCookie } from "@/lib/clean-filter";
import { useCleanFilter } from "@/components/clean-filter-provider";

export function CleanFilterToggle() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showInfo, setShowInfo] = useState(false);
  const pendingStartedAtRef = useRef<number | null>(null);
  const { cleanFilterEnabled, isApplying, beginApply, finishApply } = useCleanFilter();

  const onToggle = () => {
    if (isApplying || isPending) {
      return;
    }

    const nextValue = !cleanFilterEnabled;
    pendingStartedAtRef.current = Date.now();
    beginApply(nextValue);
    document.cookie = buildCleanFilterCookie(nextValue);
    startTransition(() => {
      router.refresh();
    });
  };

  useEffect(() => {
    if (isPending) {
      return;
    }

    if (pendingStartedAtRef.current === null) {
      return;
    }

    const elapsedMs = Date.now() - pendingStartedAtRef.current;
    const remainingMs = Math.max(0, 240 - elapsedMs);
    const timeout = window.setTimeout(() => {
      finishApply();
      pendingStartedAtRef.current = null;
    }, remainingMs);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [finishApply, isPending]);

  useEffect(() => {
    if (!showInfo) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowInfo(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [showInfo]);

  return (
    <>
      <div className="clean-filter-toggle-group">
        <button
          type="button"
          className={`clean-filter-toggle${cleanFilterEnabled ? " clean-filter-toggle-active" : ""}`}
          onClick={onToggle}
          aria-pressed={cleanFilterEnabled}
          aria-busy={isApplying || isPending}
          aria-label={cleanFilterEnabled ? "클린필터 끄기" : "클린필터 켜기"}
          title={cleanFilterEnabled ? "클린필터 켜짐" : "클린필터 꺼짐"}
          disabled={isApplying || isPending}
        >
          <span aria-hidden="true" className="clean-filter-toggle-emoji">
            🧼
          </span>
          <span className="clean-filter-toggle-label">예쁜말</span>
          <span className="clean-filter-toggle-state">{cleanFilterEnabled ? "ON" : "OFF"}</span>
        </button>
        <button
          type="button"
          className="clean-filter-info-button"
          aria-label="예쁜말 필터 설명 보기"
          aria-haspopup="dialog"
          aria-expanded={showInfo}
          onClick={() => setShowInfo(true)}
        >
          ?
        </button>
      </div>

      {showInfo ? (
        <div className="clean-filter-info-backdrop" role="presentation" onClick={() => setShowInfo(false)}>
          <div
            className="clean-filter-info-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="clean-filter-info-title"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="clean-filter-info-kicker">AI 필터 안내</p>
            <h2 id="clean-filter-info-title">이쁜말 필터</h2>
            <div className="clean-filter-info-copy">
              <p>마음씨가 이쁜 곡소리닷컴 이용자들을 위해 이쁜말만 볼 수 있도록 AI필터를 사용합니다.</p>
              <p>외부 피드의 거친 표현을 조금 더 부드럽게 바꿔서 보여줍니다.</p>
              <p>주식하는 사람들은 항상 화나있기 때문에, 글들이 보기 거북하시면 켜보세요. 화면 상단에서 언제든 토글할 수 있습니다.</p>
            </div>
            <div className="clean-filter-info-actions">
              <button type="button" className="btn" onClick={() => setShowInfo(false)}>
                닫기
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
