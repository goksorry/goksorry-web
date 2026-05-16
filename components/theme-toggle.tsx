"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { THEME_OPTIONS, getThemeOption, type ThemeId, type ThemeOption } from "@/lib/theme";
import { useTheme } from "@/components/theme-provider";

type ThemeOptionButtonProps = {
  option: ThemeOption;
  active: boolean;
  onSelect: (themeId: ThemeId) => void;
};

const buildSwatchStyle = (option: ThemeOption): CSSProperties =>
  ({
    "--theme-swatch-a": option.swatches[0],
    "--theme-swatch-b": option.swatches[1],
    "--theme-swatch-c": option.swatches[2]
  }) as CSSProperties;

export function ThemeOptionButton({ option, active, onSelect }: ThemeOptionButtonProps) {
  return (
    <button
      type="button"
      className={`theme-menu-item${active ? " theme-menu-item-active" : ""}`}
      style={buildSwatchStyle(option)}
      onClick={() => onSelect(option.id)}
      aria-pressed={active}
    >
      <span className="theme-menu-swatch" aria-hidden="true" />
      <span className="theme-menu-item-copy">
        <span>{option.label}</span>
        <small>{option.id}</small>
      </span>
    </button>
  );
}

export function ThemeToggle() {
  const { themeId, selectTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const activeTheme = getThemeOption(themeId);
  const groups = useMemo(
    () =>
      THEME_OPTIONS.reduce<Array<{ label: string; options: ThemeOption[] }>>((acc, option) => {
        const group = acc.find((item) => item.label === option.familyLabel);
        if (group) {
          group.options.push(option);
          return acc;
        }

        return [...acc, { label: option.familyLabel, options: [option] }];
      }, []),
    []
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (shellRef.current?.contains(event.target as Node)) {
        return;
      }

      setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const onSelect = (nextThemeId: ThemeId) => {
    selectTheme(nextThemeId);
    setOpen(false);
  };

  return (
    <div className="theme-menu" ref={shellRef}>
      <button
        type="button"
        className="theme-menu-trigger"
        onClick={() => setOpen((current) => !current)}
        aria-label={`테마 선택: 현재 ${activeTheme.label}`}
        aria-haspopup="menu"
        aria-expanded={open}
        title={`테마: ${activeTheme.label}`}
      >
        <span aria-hidden="true">🎨</span>
      </button>

      {open ? (
        <div className="theme-menu-popover" role="menu" aria-label="테마 선택">
          {groups.map((group) => (
            <section key={group.label} className="theme-menu-group">
              <p className="theme-menu-group-label">{group.label}</p>
              <div className="theme-menu-options">
                {group.options.map((option) => (
                  <ThemeOptionButton key={option.id} option={option} active={option.id === themeId} onSelect={onSelect} />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : null}
    </div>
  );
}
