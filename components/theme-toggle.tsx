"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
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
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
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
  const updatePopoverPosition = useCallback(() => {
    if (typeof window === "undefined" || !buttonRef.current) {
      return;
    }

    const edgePadding = 8;
    const triggerGap = 8;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const triggerRect = buttonRef.current.getBoundingClientRect();
    const desktopWidth = 23 * 16;
    const mobileWidth = 20 * 16;
    const preferredWidth = window.matchMedia("(max-width: 760px)").matches ? mobileWidth : desktopWidth;
    const width = Math.max(0, Math.min(preferredWidth, viewportWidth - edgePadding * 2));
    const top = Math.min(triggerRect.bottom + triggerGap, viewportHeight - edgePadding);
    const left = Math.min(Math.max(triggerRect.right - width, edgePadding), Math.max(edgePadding, viewportWidth - width - edgePadding));
    const maxHeight = Math.max(180, viewportHeight - top - edgePadding);

    setPopoverStyle({
      position: "fixed",
      top,
      right: "auto",
      left,
      width,
      maxHeight
    });
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (shellRef.current?.contains(target) || popoverRef.current?.contains(target)) {
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

  useEffect(() => {
    if (!open) {
      return;
    }

    updatePopoverPosition();
    window.addEventListener("resize", updatePopoverPosition);
    window.addEventListener("scroll", updatePopoverPosition, true);
    window.visualViewport?.addEventListener("resize", updatePopoverPosition);
    window.visualViewport?.addEventListener("scroll", updatePopoverPosition);
    return () => {
      window.removeEventListener("resize", updatePopoverPosition);
      window.removeEventListener("scroll", updatePopoverPosition, true);
      window.visualViewport?.removeEventListener("resize", updatePopoverPosition);
      window.visualViewport?.removeEventListener("scroll", updatePopoverPosition);
    };
  }, [open, updatePopoverPosition]);

  const onSelect = (nextThemeId: ThemeId) => {
    selectTheme(nextThemeId);
    setOpen(false);
  };
  const onToggle = () => {
    if (!open) {
      updatePopoverPosition();
    }

    setOpen((current) => !current);
  };
  const popover =
    open && typeof document !== "undefined"
      ? createPortal(
          <div ref={popoverRef} className="theme-menu-popover" style={popoverStyle ?? undefined} role="menu" aria-label="테마 선택">
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
          </div>,
          document.body
        )
      : null;

  return (
    <div className="theme-menu" ref={shellRef}>
      <button
        ref={buttonRef}
        type="button"
        className="theme-menu-trigger"
        onClick={onToggle}
        aria-label={`테마 선택: 현재 ${activeTheme.label}`}
        aria-haspopup="menu"
        aria-expanded={open}
        title={`테마: ${activeTheme.label}`}
      >
        <span aria-hidden="true">🎨</span>
      </button>
      {popover}
    </div>
  );
}
