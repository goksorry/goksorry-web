"use client";

import { useEffect, useState } from "react";
import { readClientLocalStorageValue, writeClientLocalStorageValue } from "@/lib/browser-persistence";
import { applyThemeMode, isThemeMode, THEME_STORAGE_DEFINITION, type ThemeMode } from "@/lib/theme";

const OPTIONS: Array<{ mode: ThemeMode; emoji: string; label: string }> = [
  { mode: "light", emoji: "☀️", label: "라이트" },
  { mode: "dark", emoji: "🌙", label: "다크" },
  { mode: "system", emoji: "🖥", label: "시스템" }
];

export function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>("system");

  useEffect(() => {
    const stored = readClientLocalStorageValue(THEME_STORAGE_DEFINITION);
    const nextMode = isThemeMode(stored) ? stored : "system";
    setMode(nextMode);
    applyThemeMode(nextMode);
  }, []);

  const onSelect = (nextMode: ThemeMode) => {
    setMode(nextMode);
    writeClientLocalStorageValue(THEME_STORAGE_DEFINITION, nextMode);
    applyThemeMode(nextMode);
  };

  return (
    <div className="theme-toggle" role="group" aria-label="테마 선택">
      {OPTIONS.map((option) => (
        <button
          key={option.mode}
          type="button"
          className={`theme-toggle-button${mode === option.mode ? " theme-toggle-button-active" : ""}`}
          onClick={() => onSelect(option.mode)}
          aria-pressed={mode === option.mode}
          aria-label={`${option.label} 테마`}
          title={`${option.label} 테마`}
        >
          <span aria-hidden="true" className="theme-toggle-emoji">
            {option.emoji}
          </span>
        </button>
      ))}
    </div>
  );
}
