"use client";

import { useEffect, useRef, useState } from "react";

const SITE_SHARE_TITLE = "곡소리닷컴";
const SITE_SHARE_TEXT = "외부 종목 커뮤니티 감성 피드와 커뮤니티";
const SITE_SHARE_URL = "https://goksorry.com";
const STATUS_RESET_MS = 2200;

type ShareStatus = "idle" | "copied" | "shared" | "error";

const isAbortLikeError = (error: unknown): boolean => {
  if (!(error instanceof Error)) {
    return false;
  }

  return error.name === "AbortError" || error.message.toLowerCase().includes("cancel");
};

const copyToClipboard = async (value: string): Promise<void> => {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  if (typeof document === "undefined") {
    throw new Error("clipboard unavailable");
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  const copied = document.execCommand("copy");
  document.body.removeChild(textarea);
  if (!copied) {
    throw new Error("copy failed");
  }
};

export function SiteShareButton() {
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<ShareStatus>("idle");
  const resetTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  const scheduleStatusReset = () => {
    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current);
    }
    resetTimerRef.current = window.setTimeout(() => {
      setStatus("idle");
      resetTimerRef.current = null;
    }, STATUS_RESET_MS);
  };

  const handleClick = async () => {
    if (pending || typeof window === "undefined") {
      return;
    }

    const preferShareIntent =
      window.matchMedia("(pointer: coarse)").matches || window.matchMedia("(max-width: 767px)").matches;

    setPending(true);
    try {
      if (preferShareIntent && typeof navigator.share === "function") {
        await navigator.share({
          title: SITE_SHARE_TITLE,
          text: SITE_SHARE_TEXT,
          url: SITE_SHARE_URL
        });
        setStatus("shared");
        scheduleStatusReset();
        return;
      }

      await copyToClipboard(SITE_SHARE_URL);
      setStatus("copied");
      scheduleStatusReset();
    } catch (error) {
      if (isAbortLikeError(error)) {
        return;
      }

      if (preferShareIntent) {
        try {
          await copyToClipboard(SITE_SHARE_URL);
          setStatus("copied");
          scheduleStatusReset();
          return;
        } catch {
          // Fall through to visible error state.
        }
      }

      setStatus("error");
      scheduleStatusReset();
    } finally {
      setPending(false);
    }
  };

  const buttonLabel =
    status === "copied"
      ? "복사됨"
      : status === "shared"
        ? "공유됨"
        : status === "error"
          ? "다시 시도"
          : "사이트 공유";

  return (
    <button
      type="button"
      className="btn btn-secondary header-share-button"
      onClick={() => void handleClick()}
      disabled={pending}
      aria-label="사이트 공유"
      title={buttonLabel}
    >
      <span>{pending ? "공유 중..." : buttonLabel}</span>
      <span className="sr-only" aria-live="polite">
        {status === "copied"
          ? "사이트 주소가 복사되었습니다."
          : status === "shared"
            ? "사이트 공유가 완료되었습니다."
            : status === "error"
              ? "사이트 공유에 실패했습니다."
              : ""}
      </span>
    </button>
  );
}
