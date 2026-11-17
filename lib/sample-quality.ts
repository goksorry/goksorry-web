// Display guard only: this is not a statistical confidence or representativeness claim.
export const MIN_DIRECTIONAL_SAMPLE = 30;
export const SAMPLE_DISPLAY_NOTE = "희망·공포 합계 30건 미만이면 지수 표시를 보류합니다. 표시 기준이며 전체 여론의 대표성이나 통계적 신뢰도를 보장하지 않습니다.";

export function sampleQuality(sample: { bullish: number; bearish: number; neutral: number }) {
  const directional = Math.max(0, sample.bullish) + Math.max(0, sample.bearish);
  const total = directional + Math.max(0, sample.neutral);
  return { total, directional, limited: directional < MIN_DIRECTIONAL_SAMPLE };
}

export function groupsSampleLimited(groups: readonly { bullish: number; bearish: number; neutral: number }[]) {
  const active = groups.filter(group => sampleQuality(group).directional > 0);
  return !active.length || active.some(group => sampleQuality(group).limited);
}
