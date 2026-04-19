"use client";

import { useEffect, useState, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { buildCleanFilterCookie } from "@/lib/clean-filter";
import { useCleanFilter } from "@/components/clean-filter-provider";

export function CleanFilterToggle() {
  const [showInfo, setShowInfo] = useState(false);
  const { cleanFilterEnabled, isApplying, applyCleanFilter } = useCleanFilter();

  const onToggle = (event: MouseEvent<HTMLButtonElement>) => {
    if (isApplying) {
      return;
    }

    const nextValue = !cleanFilterEnabled;
    const rect = event.currentTarget.getBoundingClientRect();
    applyCleanFilter(nextValue, {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    });
    document.cookie = buildCleanFilterCookie(nextValue);
  };

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

  useEffect(() => {
    if (!showInfo) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [showInfo]);

  return (
    <>
      <div className={`clean-filter-toggle-group${cleanFilterEnabled ? " clean-filter-toggle-group-active" : ""}`}>
        <button
          type="button"
          className="clean-filter-toggle"
          onClick={onToggle}
          aria-pressed={cleanFilterEnabled}
          aria-busy={isApplying}
          aria-label={cleanFilterEnabled ? "클린필터 끄기" : "클린필터 켜기"}
          title={cleanFilterEnabled ? "클린필터 켜짐" : "클린필터 꺼짐"}
          disabled={isApplying}
        >
          <span className="clean-filter-toggle-copy">예쁜말{cleanFilterEnabled ? "ON" : "OFF"}</span>
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

      {showInfo && typeof document !== "undefined"
        ? createPortal(
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
            </div>,
            document.body
          )
        : null}
    </>
  );
}
