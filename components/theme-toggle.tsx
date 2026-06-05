"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { CHANGE_COLOR_MODES, type ChangeColorMode } from "@/lib/change-color-mode";
import { THEME_OPTIONS, getThemeOption, type ThemeFamily, type ThemeOption, type ThemeTone } from "@/lib/theme";
import { useTheme } from "@/components/theme-provider";

type ThemeChoiceButtonProps = {
  label: ReactNode;
  ariaLabel: string;
  swatchOption?: ThemeOption;
  active: boolean;
  onSelect: () => void;
};

const buildSwatchStyle = (option: ThemeOption): CSSProperties =>
  ({
    "--theme-swatch-a": option.swatches[0],
    "--theme-swatch-b": option.swatches[1],
    "--theme-swatch-c": option.swatches[2]
  }) as CSSProperties;

export const TONE_CHOICES: ThemeTone[] = ["light", "dark", "system"];
export const TONE_LABELS: Record<ThemeTone, string> = {
  light: "라이트",
  dark: "다크",
  system: "시스템"
};

export const findThemeOption = (family: ThemeFamily, tone: ThemeTone): ThemeOption | undefined =>
  THEME_OPTIONS.find((option) => option.family === family && option.tone === tone);

export const getThemeFamilyChoices = (): Array<{ family: ThemeFamily; label: string }> => {
  const seen = new Set<ThemeFamily>();
  return THEME_OPTIONS.reduce<Array<{ family: ThemeFamily; label: string }>>((acc, option) => {
    if (seen.has(option.family)) {
      return acc;
    }

    seen.add(option.family);
    return [...acc, { family: option.family, label: option.familyLabel }];
  }, []);
};

const CHANGE_COLOR_LABELS: Record<ChangeColorMode, string> = {
  kr: "한국식",
  us: "미국식",
  hybrid: "하이브리드"
};

const renderChangeColorLabel = (mode: ChangeColorMode): ReactNode => {
  if (mode === "hybrid") {
    return <span className="theme-menu-change-label theme-menu-change-label-hybrid">🔀</span>;
  }

  return (
    <span className={`theme-menu-change-label theme-menu-change-label-${mode}`}>
      <span className="theme-menu-change-flag">{mode === "kr" ? "🇰🇷" : "🇺🇸"}</span>
      <span className="theme-menu-change-arrow theme-menu-change-up">↑</span>
      <span className="theme-menu-change-arrow theme-menu-change-down">↓</span>
    </span>
  );
};

export function ThemeChoiceButton({ label, ariaLabel, swatchOption, active, onSelect }: ThemeChoiceButtonProps) {
  return (
    <button
      type="button"
      className={`theme-menu-item theme-menu-choice${swatchOption ? "" : " theme-menu-choice-plain"}${
        active ? " theme-menu-item-active" : ""
      }`}
      style={swatchOption ? buildSwatchStyle(swatchOption) : undefined}
      onClick={onSelect}
      aria-pressed={active}
      aria-label={ariaLabel}
    >
      {swatchOption ? <span className="theme-menu-swatch" aria-hidden="true" /> : null}
      <span className="theme-menu-item-copy">
        <span>{label}</span>
      </span>
    </button>
  );
}

export function ThemeToggle() {
  const { themeId, changeColorMode, selectTheme, selectChangeColorMode } = useTheme();
  const [open, setOpen] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties | null>(null);
  const [draftFamily, setDraftFamily] = useState<ThemeFamily>("default");
  const [draftTone, setDraftTone] = useState<ThemeTone>("light");
  const [draftChangeColorMode, setDraftChangeColorMode] = useState<ChangeColorMode>(changeColorMode);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const activeTheme = getThemeOption(themeId);
  const familyChoices = useMemo(() => getThemeFamilyChoices(), []);
  const draftTheme = findThemeOption(draftFamily, draftTone) ?? activeTheme;
  const updatePopoverPosition = useCallback(() => {
    if (typeof window === "undefined" || !buttonRef.current) {
      return;
    }

    const edgePadding = 8;
    const triggerGap = 8;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const triggerRect = buttonRef.current.getBoundingClientRect();
    const desktopWidth = 19 * 16;
    const mobileWidth = 19 * 16;
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

    setDraftFamily(activeTheme.family);
    setDraftTone(activeTheme.tone);
    setDraftChangeColorMode(changeColorMode);
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
  }, [activeTheme.family, activeTheme.tone, changeColorMode, open, updatePopoverPosition]);

  const onApply = () => {
    selectTheme(draftTheme.id);
    selectChangeColorMode(draftChangeColorMode);
    setOpen(false);
  };
  const onToggle = () => {
    if (!open) {
      setDraftFamily(activeTheme.family);
      setDraftTone(activeTheme.tone);
      setDraftChangeColorMode(changeColorMode);
      updatePopoverPosition();
    }

    setOpen((current) => !current);
  };
  const popover =
    open && typeof document !== "undefined"
      ? createPortal(
          <div ref={popoverRef} className="theme-menu-popover" style={popoverStyle ?? undefined} role="menu" aria-label="테마 선택">
            <section className="theme-menu-group" aria-labelledby="theme-family-heading">
              <p id="theme-family-heading" className="theme-menu-group-label">
                테마
              </p>
              <div className="theme-menu-options theme-menu-family-options">
                {familyChoices.map((choice) => {
                  const swatchOption = findThemeOption(choice.family, draftTone) ?? draftTheme;
                  return (
                    <ThemeChoiceButton
                      key={choice.family}
                      label={choice.label}
                      ariaLabel={`테마 ${choice.label}`}
                      swatchOption={swatchOption}
                      active={choice.family === draftFamily}
                      onSelect={() => setDraftFamily(choice.family)}
                    />
                  );
                })}
              </div>
            </section>
            <section className="theme-menu-group" aria-labelledby="theme-tone-heading">
              <p id="theme-tone-heading" className="theme-menu-group-label">
                색상
              </p>
              <div className="theme-menu-options theme-menu-tone-options">
                {TONE_CHOICES.map((tone) => {
                  const swatchOption = findThemeOption(draftFamily, tone) ?? draftTheme;
                  return (
                    <ThemeChoiceButton
                      key={tone}
                      label={TONE_LABELS[tone]}
                      ariaLabel={`색상 ${TONE_LABELS[tone]}`}
                      swatchOption={swatchOption}
                      active={tone === draftTone}
                      onSelect={() => setDraftTone(tone)}
                    />
                  );
                })}
              </div>
            </section>
            <section className="theme-menu-group" aria-labelledby="theme-change-color-heading">
              <p id="theme-change-color-heading" className="theme-menu-group-label">
                등락률
              </p>
              <div className="theme-menu-options theme-menu-change-options">
                {CHANGE_COLOR_MODES.map((mode) => (
                  <ThemeChoiceButton
                    key={mode}
                    label={renderChangeColorLabel(mode)}
                    ariaLabel={`등락률 색상 ${CHANGE_COLOR_LABELS[mode]}`}
                    active={mode === draftChangeColorMode}
                    onSelect={() => setDraftChangeColorMode(mode)}
                  />
                ))}
              </div>
            </section>
            <div className="theme-menu-actions">
              <button type="button" className="btn theme-menu-apply" onClick={onApply}>
                적용
              </button>
            </div>
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
