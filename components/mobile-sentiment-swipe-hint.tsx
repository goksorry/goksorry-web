"use client";

import { useEffect, useRef, useState } from "react";

type HintState = {
  direction: "left" | "right";
  targetLabel: "희망" | "공포";
} | null;

const MOBILE_MEDIA_QUERY = "(max-width: 760px)";
const LENGTH_DIFF_THRESHOLD = 160;
const FADE_OUT_MS = 220;

const buildHint = (activeLaneId: string): HintState => {
  if (activeLaneId === "fear-lane") {
    return {
      direction: "left",
      targetLabel: "희망"
    };
  }

  return {
    direction: "right",
    targetLabel: "공포"
  };
};

export function MobileSentimentSwipeHint() {
  const [hint, setHint] = useState<HintState>(null);
  const [renderedHint, setRenderedHint] = useState<HintState>(null);
  const [visible, setVisible] = useState(false);
  const hideTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current !== null) {
        window.clearTimeout(hideTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const media = window.matchMedia(MOBILE_MEDIA_QUERY);
    let frameId = 0;
    let scrollContainer: HTMLElement | null = null;

    const updateHint = () => {
      frameId = 0;

      if (!media.matches) {
        setHint(null);
        return;
      }

      const panel = document.querySelector<HTMLElement>(".feed-lanes-panel");
      scrollContainer = document.querySelector<HTMLElement>(".sentiment-columns");
      const fearLane = document.getElementById("fear-lane");
      const hopeLane = document.getElementById("hope-lane");

      if (!panel || !scrollContainer || !fearLane || !hopeLane) {
        setHint(null);
        return;
      }

      const lanes = [fearLane, hopeLane];
      const activeLane = lanes.reduce<HTMLElement | null>((closest, lane) => {
        if (!closest) {
          return lane;
        }

        const laneDistance = Math.abs(lane.offsetLeft - scrollContainer!.scrollLeft);
        const closestDistance = Math.abs(closest.offsetLeft - scrollContainer!.scrollLeft);
        return laneDistance < closestDistance ? lane : closest;
      }, null);

      if (!activeLane) {
        setHint(null);
        return;
      }

      const otherLane = activeLane.id === "fear-lane" ? hopeLane : fearLane;
      const activeRect = activeLane.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();
      const isShorterLane = otherLane.scrollHeight - activeLane.scrollHeight > LENGTH_DIFF_THRESHOLD;
      const blankVisible = activeRect.bottom < window.innerHeight - 32;
      const panelStillVisible = panelRect.bottom > window.innerHeight * 0.55;
      const userScrolledIntoFeed = window.scrollY > Math.max(120, panel.offsetTop - 120);

      if (isShorterLane && blankVisible && panelStillVisible && userScrolledIntoFeed) {
        setHint(buildHint(activeLane.id));
        return;
      }

      setHint(null);
    };

    const requestUpdate = () => {
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
      frameId = window.requestAnimationFrame(updateHint);
    };

    requestUpdate();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);

    scrollContainer = document.querySelector<HTMLElement>(".sentiment-columns");
    scrollContainer?.addEventListener("scroll", requestUpdate, { passive: true });

    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", requestUpdate);
    } else {
      media.addListener(requestUpdate);
    }

    return () => {
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
      scrollContainer?.removeEventListener("scroll", requestUpdate);
      if (typeof media.removeEventListener === "function") {
        media.removeEventListener("change", requestUpdate);
      } else {
        media.removeListener(requestUpdate);
      }
    };
  }, []);

  useEffect(() => {
    if (hint) {
      if (hideTimeoutRef.current !== null) {
        window.clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = null;
      }

      setRenderedHint(hint);
      const frame = window.requestAnimationFrame(() => {
        setVisible(true);
      });

      return () => {
        window.cancelAnimationFrame(frame);
      };
    }

    setVisible(false);
    hideTimeoutRef.current = window.setTimeout(() => {
      setRenderedHint(null);
      hideTimeoutRef.current = null;
    }, FADE_OUT_MS);
  }, [hint]);

  if (!renderedHint && !visible) {
    return null;
  }

  return (
    <div className={`mobile-swipe-hint${visible ? " mobile-swipe-hint-visible" : ""}`} aria-live="polite">
      {renderedHint?.direction === "left" ? "←" : "→"}{" "}
      {renderedHint?.direction === "left" ? "왼쪽" : "오른쪽"}으로 스와이프하여 {renderedHint?.targetLabel} 피드 보기
    </div>
  );
}
