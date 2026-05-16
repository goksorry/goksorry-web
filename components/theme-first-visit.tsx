"use client";

import { useEffect, useMemo, useState } from "react";
import { getThemeOption, type ThemeFamily, type ThemeTone } from "@/lib/theme";
import {
  ThemeChoiceButton,
  TONE_CHOICES,
  TONE_LABELS,
  findThemeOption,
  getThemeFamilyChoices
} from "@/components/theme-toggle";
import { useTheme } from "@/components/theme-provider";

export function ThemeFirstVisit() {
  const { themeId, showThemePrompt, selectTheme, dismissThemePrompt } = useTheme();
  const activeTheme = getThemeOption(themeId);
  const [draftFamily, setDraftFamily] = useState<ThemeFamily>(activeTheme.family);
  const [draftTone, setDraftTone] = useState<ThemeTone>(activeTheme.tone);
  const familyChoices = useMemo(() => getThemeFamilyChoices(), []);

  useEffect(() => {
    if (!showThemePrompt) {
      return;
    }

    setDraftFamily(activeTheme.family);
    setDraftTone(activeTheme.tone);
  }, [activeTheme.family, activeTheme.tone, showThemePrompt]);

  if (!showThemePrompt) {
    return null;
  }

  const draftTheme = findThemeOption(draftFamily, draftTone) ?? activeTheme;
  const onSubmit = () => {
    selectTheme(draftTheme.id);
  };

  return (
    <div className="theme-first-visit" role="presentation">
      <div className="theme-first-visit-panel" role="dialog" aria-modal="true" aria-labelledby="theme-first-visit-title">
        <p className="theme-first-visit-kicker">테마 선택</p>
        <h2 id="theme-first-visit-title">사이트 분위기를 고르세요.</h2>
        <p className="muted">나중에도 우측 상단의 테마 메뉴에서 바꿀 수 있습니다.</p>
        <div className="theme-first-visit-options">
          <section className="theme-menu-group" aria-labelledby="theme-first-visit-family-heading">
            <p id="theme-first-visit-family-heading" className="theme-menu-group-label">
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

          <section className="theme-menu-group" aria-labelledby="theme-first-visit-tone-heading">
            <p id="theme-first-visit-tone-heading" className="theme-menu-group-label">
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
        </div>
        <div className="actions">
          <button type="button" className="btn btn-secondary" onClick={dismissThemePrompt}>
            기본 유지
          </button>
          <button type="button" className="btn" onClick={onSubmit}>
            선택 완료
          </button>
        </div>
      </div>
    </div>
  );
}
