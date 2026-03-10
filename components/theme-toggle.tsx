"use client";

import { useEffect, useState } from "react";

type ThemeMode = "light" | "dark" | "system";

const STORAGE_KEY = "goksorry-theme";

const isThemeMode = (value: string | null): value is ThemeMode => {
  return value === "light" || value === "dark" || value === "system";
};

const applyTheme = (mode: ThemeMode) => {
  const root = document.documentElement;
  if (mode === "system") {
    root.removeAttribute("data-theme");
    return;
  }

  root.setAttribute("data-theme", mode);
};

const OPTIONS: Array<{ mode: ThemeMode; emoji: string; label: string }> = [
  { mode: "light", emoji: "☀️", label: "라이트" },
  { mode: "dark", emoji: "🌙", label: "다크" },
  { mode: "system", emoji: "🖥", label: "시스템" }
];

export function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>("system");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const nextMode = isThemeMode(stored) ? stored : "system";
    setMode(nextMode);
    applyTheme(nextMode);
  }, []);

  const onSelect = (nextMode: ThemeMode) => {
    setMode(nextMode);
    window.localStorage.setItem(STORAGE_KEY, nextMode);
    applyTheme(nextMode);
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
