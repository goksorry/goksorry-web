"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { persistCleanFilterPreference } from "@/lib/clean-filter";
import { useCleanFilter } from "@/components/clean-filter-provider";
import { useTheme } from "@/components/theme-provider";

type HintStyle = CSSProperties & {
  "--first-visit-hint-pointer-x"?: string;
};

const HINT_MARGIN = 12;
const HINT_GAP = 10;

const findHeaderTarget = (): HTMLElement | null => {
  return document.querySelector(".header .header-controls") ?? document.querySelector("[data-testid='concept-header-actions']");
};

export function FirstVisitHeaderHint() {
  const { cleanFilterEnabled, showFirstVisitPrompt, dismissFirstVisitPrompt } = useCleanFilter();
  const { showThemePrompt, dismissThemePrompt } = useTheme();
  const hintRef = useRef<HTMLElement | null>(null);
  const [hintStyle, setHintStyle] = useState<HintStyle | undefined>(undefined);
  const visible = showFirstVisitPrompt || showThemePrompt;

  useEffect(() => {
    if (!visible) {
      return;
    }

    let frameId = 0;
    const updatePosition = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        const target = findHeaderTarget();
        const hint = hintRef.current;
        if (!target || !hint) {
          return;
        }

        const header = target.closest(".header, [data-testid='program-header']") as HTMLElement | null;
        const targetRect = target.getBoundingClientRect();
        const headerRect = header?.getBoundingClientRect();
        const hintWidth = Math.min(hint.getBoundingClientRect().width || 320, window.innerWidth - HINT_MARGIN * 2);
        const targetCenter = targetRect.left + targetRect.width / 2;
        const left = Math.max(HINT_MARGIN, Math.min(window.innerWidth - HINT_MARGIN - hintWidth, targetCenter - hintWidth / 2));
        const top = (headerRect?.bottom ?? targetRect.bottom) + HINT_GAP;
        const pointerX = Math.max(18, Math.min(hintWidth - 18, targetCenter - left));

        setHintStyle({
          left: `${left}px`,
          top: `${top}px`,
          width: `${hintWidth}px`,
          "--first-visit-hint-pointer-x": `${pointerX}px`
        });
      });
    };

    updatePosition();
    const resizeObserver = new ResizeObserver(updatePosition);
    const target = findHeaderTarget();
    const header = target?.closest(".header, [data-testid='program-header']");
    if (target) {
      resizeObserver.observe(target);
    }
    if (header) {
      resizeObserver.observe(header);
    }
    window.addEventListener("resize", updatePosition);

    return () => {
      window.cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      window.removeEventListener("resize", updatePosition);
    };
  }, [visible]);

  if (!visible) {
    return null;
  }

  const dismiss = () => {
    persistCleanFilterPreference(cleanFilterEnabled);
    dismissFirstVisitPrompt();
    dismissThemePrompt();
  };

  return (
    <aside ref={hintRef} className="first-visit-header-hint" role="note" aria-label="초기 설정 안내" style={hintStyle}>
      <span className="first-visit-header-hint-pointer" aria-hidden="true" />
      <p>이쁜말필터와 테마는 여기서 바꿀 수 있어요.</p>
      <button type="button" className="first-visit-header-hint-close" onClick={dismiss} aria-label="초기 설정 안내 닫기">
        확인
      </button>
    </aside>
  );
}
