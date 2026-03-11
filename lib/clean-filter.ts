export const CLEAN_FILTER_COOKIE = "goksorry-clean-filter";
export const CLEAN_FILTER_SWITCH_DELAY_MS = 250;
export const CLEAN_FILTER_APPLY_DURATION_MS = 500;

export const isCleanFilterEnabled = (value: string | null | undefined): boolean => {
  return value !== "off";
};

export const buildCleanFilterCookie = (enabled: boolean): string => {
  return `${CLEAN_FILTER_COOKIE}=${enabled ? "on" : "off"}; Path=/; Max-Age=31536000; SameSite=Lax`;
};

const findCleanFilterCookie = (): string | null => {
  if (typeof document === "undefined") {
    return null;
  }

  return (
    document.cookie
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${CLEAN_FILTER_COOKIE}=`)) ?? null
  );
};

export const hasCleanFilterCookieInDocument = (): boolean => {
  return findCleanFilterCookie() !== null;
};

export const readCleanFilterFromDocument = (): boolean => {
  if (typeof document === "undefined") {
    return true;
  }

  const cookie = findCleanFilterCookie();

  if (!cookie) {
    return true;
  }

  return isCleanFilterEnabled(cookie.split("=").slice(1).join("="));
};

const CLEAN_FALLBACK_PATTERNS: Array<[RegExp, string]> = [
  [/개잡주/g, "부진한 종목"],
  [/(?<!개)잡주/g, "변동성 큰 종목"],
  [/쓰레기/g, "좋지 않은"],
  [/존나|ㅈㄴ/g, "매우"],
  [/씨발|시발|ㅅㅂ/g, "강한 불만"],
  [/지랄/g, "과한 반응"],
  [/염병/g, "과한 표현"],
  [/좆망|ㅈ망/g, "크게 부진"],
  [/좆같|ㅈ같/g, "좋지 않"],
  [/씹창/g, "큰 혼란"],
  [/병신|븅신|ㅂㅅ/g, "엉망"],
  [/떡락/g, "급락"],
  [/떡상/g, "급등"],
  [/꼬라박/g, "급락"],
  [/나락/g, "급락"],
  [/쳐물|처물/g, "고점 매수"],
  [/쳐박|처박/g, "급락"],
  [/개판/g, "혼란"],
  [/개새끼/g, "문제가 큰 사람"],
  [/새끼/g, "사람"],
  [/병맛/g, "이상한 분위기"],
  [/미친/g, "강한"],
  [/한녀/g, "여성"],
  [/한남/g, "남성"],
  [/틀딱/g, "고령층"]
];

const CLEAN_FALLBACK_HINT = /(개잡주|잡주|쓰레기|존나|ㅈㄴ|씨발|시발|ㅅㅂ|지랄|염병|좆망|ㅈ망|좆같|ㅈ같|씹창|병신|븅신|ㅂㅅ|떡락|떡상|꼬라박|나락|쳐물|처물|쳐박|처박|개판|개새끼|새끼|병맛|미친|한녀|한남|틀딱)/;

const applyCleanFallbackDictionary = (title: string): string => {
  if (!CLEAN_FALLBACK_HINT.test(title)) {
    return title;
  }

  return CLEAN_FALLBACK_PATTERNS.reduce((current, [pattern, replacement]) => {
    return current.replace(pattern, replacement);
  }, title);
};

export const resolveDisplayTitle = ({
  title,
  cleanTitle,
  cleanFilterEnabled
}: {
  title: string;
  cleanTitle?: string | null;
  cleanFilterEnabled: boolean;
}): { text: string; usedFallbackFilter: boolean } => {
  if (!cleanFilterEnabled) {
    return {
      text: title,
      usedFallbackFilter: false
    };
  }

  if (cleanFilterEnabled && cleanTitle) {
    return {
      text: cleanTitle,
      usedFallbackFilter: false
    };
  }

  return {
    text: applyCleanFallbackDictionary(title),
    usedFallbackFilter: true
  };
};

export const pickDisplayTitle = ({
  title,
  cleanTitle,
  cleanFilterEnabled
}: {
  title: string;
  cleanTitle?: string | null;
  cleanFilterEnabled: boolean;
}): string => {
  return resolveDisplayTitle({ title, cleanTitle, cleanFilterEnabled }).text;
};
