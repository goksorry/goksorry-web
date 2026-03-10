"use client";

import { useRouter } from "next/navigation";
import { buildCleanFilterCookie } from "@/lib/clean-filter";
import { useCleanFilter } from "@/components/clean-filter-provider";

export function CleanFilterToggle() {
  const router = useRouter();
  const { cleanFilterEnabled, setCleanFilterEnabled } = useCleanFilter();

  const onToggle = () => {
    const nextValue = !cleanFilterEnabled;
    setCleanFilterEnabled(nextValue);
    document.cookie = buildCleanFilterCookie(nextValue);
    router.refresh();
  };

  return (
    <button
      type="button"
      className={`clean-filter-toggle${cleanFilterEnabled ? " clean-filter-toggle-active" : ""}`}
      onClick={onToggle}
      aria-pressed={cleanFilterEnabled}
      aria-label={cleanFilterEnabled ? "클린필터 끄기" : "클린필터 켜기"}
      title={cleanFilterEnabled ? "클린필터 켜짐" : "클린필터 꺼짐"}
    >
      <span aria-hidden="true" className="clean-filter-toggle-emoji">
        🧼
      </span>
      <span className="clean-filter-toggle-label">예쁜말</span>
      <span className="clean-filter-toggle-state">{cleanFilterEnabled ? "ON" : "OFF"}</span>
    </button>
  );
}
