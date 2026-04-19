"use client";

import { useMemo, type CSSProperties } from "react";
import { CLEAN_FILTER_APPLY_DURATION_MS } from "@/lib/clean-filter";
import { useCleanFilter } from "@/components/clean-filter-provider";

export function CleanFilterOverlay() {
  const { isApplying, animationMode, animationOrigin } = useCleanFilter();

  const circleStyle = useMemo(() => {
    if (!isApplying || !animationMode || !animationOrigin || typeof window === "undefined") {
      return null;
    }

    const farthestHorizontalDistance = Math.max(animationOrigin.x, window.innerWidth - animationOrigin.x);
    const farthestVerticalDistance = Math.max(animationOrigin.y, window.innerHeight - animationOrigin.y);
    const circleSize = Math.ceil(Math.hypot(farthestHorizontalDistance, farthestVerticalDistance) * 2);
    const minScale = Math.max(12 / circleSize, 0.0001);

    return {
      "--clean-filter-circle-x": `${animationOrigin.x}px`,
      "--clean-filter-circle-y": `${animationOrigin.y}px`,
      "--clean-filter-circle-size": `${circleSize}px`,
      "--clean-filter-circle-min-scale": minScale.toFixed(5),
      "--clean-filter-overlay-duration": `${CLEAN_FILTER_APPLY_DURATION_MS}ms`
    } as CSSProperties;
  }, [animationMode, animationOrigin, isApplying]);

  if (!isApplying || !animationMode || !circleStyle) {
    return null;
  }

  return (
    <div className={`clean-filter-overlay clean-filter-overlay-active clean-filter-overlay-${animationMode}`} aria-hidden="true">
      <span className="clean-filter-overlay-circle" style={circleStyle} />
    </div>
  );
}
