"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode
} from "react";

type CrossfadeContentProps = {
  swapKey: string;
  durationMs?: number;
  children: ReactNode;
};

export function CrossfadeContent({
  swapKey,
  durationMs = 500,
  children
}: CrossfadeContentProps) {
  const [previousNode, setPreviousNode] = useState<ReactNode | null>(null);
  const [showCurrent, setShowCurrent] = useState(true);
  const [lockedHeight, setLockedHeight] = useState<number | null>(null);
  const currentRef = useRef<HTMLDivElement | null>(null);
  const previousRef = useRef<HTMLDivElement | null>(null);
  const previousKeyRef = useRef(swapKey);
  const renderedChildrenRef = useRef(children);
  const frameRef = useRef<number | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (previousKeyRef.current === swapKey) {
      renderedChildrenRef.current = children;
      return;
    }

    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    setPreviousNode(renderedChildrenRef.current);
    setShowCurrent(false);
    previousKeyRef.current = swapKey;
    renderedChildrenRef.current = children;
  }, [children, swapKey]);

  useLayoutEffect(() => {
    if (!previousNode) {
      return;
    }

    const nextHeight = Math.max(
      currentRef.current?.offsetHeight ?? 0,
      previousRef.current?.offsetHeight ?? 0
    );

    setLockedHeight(nextHeight > 0 ? nextHeight : null);
    frameRef.current = requestAnimationFrame(() => {
      setShowCurrent(true);
      frameRef.current = null;
    });
    timeoutRef.current = setTimeout(() => {
      setPreviousNode(null);
      setLockedHeight(null);
      setShowCurrent(true);
      timeoutRef.current = null;
    }, durationMs);

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [durationMs, previousNode]);

  return (
    <div
      className="crossfade-shell"
      style={
        {
          "--crossfade-duration": `${durationMs}ms`,
          ...(lockedHeight ? { height: `${lockedHeight}px` } : {})
        } as CSSProperties
      }
    >
      <div
        ref={currentRef}
        className={`crossfade-layer crossfade-layer-current${
          previousNode ? (showCurrent ? " crossfade-layer-visible" : " crossfade-layer-hidden") : ""
        }`}
      >
        {children}
      </div>

      {previousNode ? (
        <div
          ref={previousRef}
          aria-hidden="true"
          className={`crossfade-layer crossfade-layer-previous${
            showCurrent ? " crossfade-layer-hidden" : " crossfade-layer-visible"
          }`}
        >
          {previousNode}
        </div>
      ) : null}
    </div>
  );
}
