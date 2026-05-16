import { CLIENT_PERSISTENCE_DEFINITIONS } from "@/lib/persistence-registry";

export type ThemeTone = "light" | "dark" | "system";
export type ThemeEffectiveTone = Exclude<ThemeTone, "system">;
export type ThemeFamily = "default" | "excel" | "powerpoint" | "docs" | "vscode" | "jetbrains" | "visual-studio";
export type ThemeShellType = ThemeFamily;

export type ThemeId =
  | "light"
  | "dark"
  | "system"
  | "excel-light"
  | "excel-dark"
  | "excel-system"
  | "powerpoint-light"
  | "powerpoint-dark"
  | "powerpoint-system"
  | "docs-light"
  | "docs-dark"
  | "docs-system"
  | "vscode-light"
  | "vscode-dark"
  | "vscode-system"
  | "jetbrains-light"
  | "jetbrains-dark"
  | "jetbrains-system"
  | "vs-light"
  | "vs-dark"
  | "vs-system";

export type ThemeMode = ThemeId;

export type ThemeOption = {
  id: ThemeId;
  label: string;
  family: ThemeFamily;
  familyLabel: string;
  tone: ThemeTone;
  shellType: ThemeShellType;
  swatches: [string, string, string];
};

export const THEME_STORAGE_DEFINITION = CLIENT_PERSISTENCE_DEFINITIONS.themeMode;
export const THEME_PARAM_NAME = "theme";
export const DEFAULT_THEME_ID: ThemeId = "light";

const buildThemeOption = (
  id: ThemeId,
  label: string,
  family: ThemeFamily,
  familyLabel: string,
  tone: ThemeTone,
  shellType: ThemeShellType,
  swatches: [string, string, string]
): ThemeOption => ({ id, label, family, familyLabel, tone, shellType, swatches });

export const THEME_OPTIONS: ThemeOption[] = [
  buildThemeOption("light", "기본 라이트", "default", "기본", "light", "default", ["#eef1f4", "#58606a", "#a25852"]),
  buildThemeOption("dark", "기본 다크", "default", "기본", "dark", "default", ["#181c22", "#aeb7c1", "#c56b64"]),
  buildThemeOption("system", "기본 시스템", "default", "기본", "system", "default", ["#eef1f4", "#181c22", "#58606a"]),
  buildThemeOption("excel-light", "엑셀 라이트", "excel", "Excel", "light", "excel", ["#f4fbf7", "#107c41", "#d6ede1"]),
  buildThemeOption("excel-dark", "엑셀 다크", "excel", "Excel", "dark", "excel", ["#0f1f19", "#21a366", "#335b48"]),
  buildThemeOption("excel-system", "엑셀 시스템", "excel", "Excel", "system", "excel", ["#f4fbf7", "#0f1f19", "#107c41"]),
  buildThemeOption(
    "powerpoint-light",
    "파워포인트 라이트",
    "powerpoint",
    "PowerPoint",
    "light",
    "powerpoint",
    ["#fff5ef", "#c43e1c", "#f4c7b5"]
  ),
  buildThemeOption(
    "powerpoint-dark",
    "파워포인트 다크",
    "powerpoint",
    "PowerPoint",
    "dark",
    "powerpoint",
    ["#24150f", "#f26f42", "#7a3322"]
  ),
  buildThemeOption(
    "powerpoint-system",
    "파워포인트 시스템",
    "powerpoint",
    "PowerPoint",
    "system",
    "powerpoint",
    ["#fff5ef", "#24150f", "#c43e1c"]
  ),
  buildThemeOption("docs-light", "기술문서 라이트", "docs", "Docs", "light", "docs", ["#f7f9fc", "#2563eb", "#10b981"]),
  buildThemeOption("docs-dark", "기술문서 다크", "docs", "Docs", "dark", "docs", ["#0f172a", "#60a5fa", "#34d399"]),
  buildThemeOption("docs-system", "기술문서 시스템", "docs", "Docs", "system", "docs", ["#f7f9fc", "#0f172a", "#2563eb"]),
  buildThemeOption("vscode-light", "VS Code 라이트", "vscode", "VS Code", "light", "vscode", ["#f3f3f3", "#007acc", "#c586c0"]),
  buildThemeOption("vscode-dark", "VS Code 다크", "vscode", "VS Code", "dark", "vscode", ["#1e1e1e", "#007acc", "#ce9178"]),
  buildThemeOption("vscode-system", "VS Code 시스템", "vscode", "VS Code", "system", "vscode", ["#f3f3f3", "#1e1e1e", "#007acc"]),
  buildThemeOption(
    "jetbrains-light",
    "JetBrains 라이트",
    "jetbrains",
    "JetBrains",
    "light",
    "jetbrains",
    ["#fafafa", "#6b21a8", "#f97316"]
  ),
  buildThemeOption(
    "jetbrains-dark",
    "JetBrains 다크",
    "jetbrains",
    "JetBrains",
    "dark",
    "jetbrains",
    ["#19191f", "#a855f7", "#f59e0b"]
  ),
  buildThemeOption(
    "jetbrains-system",
    "JetBrains 시스템",
    "jetbrains",
    "JetBrains",
    "system",
    "jetbrains",
    ["#fafafa", "#19191f", "#a855f7"]
  ),
  buildThemeOption(
    "vs-light",
    "Visual Studio 라이트",
    "visual-studio",
    "Visual Studio",
    "light",
    "visual-studio",
    ["#f7f4fb", "#68217a", "#2b579a"]
  ),
  buildThemeOption(
    "vs-dark",
    "Visual Studio 다크",
    "visual-studio",
    "Visual Studio",
    "dark",
    "visual-studio",
    ["#1e1e2f", "#b180d7", "#569cd6"]
  ),
  buildThemeOption(
    "vs-system",
    "Visual Studio 시스템",
    "visual-studio",
    "Visual Studio",
    "system",
    "visual-studio",
    ["#f7f4fb", "#1e1e2f", "#68217a"]
  )
];

const THEME_IDS = new Set<string>(THEME_OPTIONS.map((option) => option.id));
const THEME_BY_ID = new Map<ThemeId, ThemeOption>(THEME_OPTIONS.map((option) => [option.id, option]));

const FAMILY_TONE_THEME_IDS: Record<ThemeFamily, Record<ThemeTone, ThemeId>> = {
  default: {
    light: "light",
    dark: "dark",
    system: "system"
  },
  excel: {
    light: "excel-light",
    dark: "excel-dark",
    system: "excel-system"
  },
  powerpoint: {
    light: "powerpoint-light",
    dark: "powerpoint-dark",
    system: "powerpoint-system"
  },
  docs: {
    light: "docs-light",
    dark: "docs-dark",
    system: "docs-system"
  },
  vscode: {
    light: "vscode-light",
    dark: "vscode-dark",
    system: "vscode-system"
  },
  jetbrains: {
    light: "jetbrains-light",
    dark: "jetbrains-dark",
    system: "jetbrains-system"
  },
  "visual-studio": {
    light: "vs-light",
    dark: "vs-dark",
    system: "vs-system"
  }
};

const THEME_ALIASES: Record<string, ThemeId> = {
  default: "light",
  "default-light": "light",
  "default-dark": "dark",
  "default-system": "system",
  system: "system",
  excel: "excel-system",
  powerpoint: "powerpoint-system",
  ppt: "powerpoint-system",
  docs: "docs-system",
  document: "docs-system",
  techdocs: "docs-system",
  vscode: "vscode-system",
  "vs-code": "vscode-system",
  jetbrain: "jetbrains-system",
  jetbrains: "jetbrains-system",
  vs: "vs-system",
  visualstudio: "vs-system",
  "visual-studio": "vs-system",
  "visual-studio-light": "vs-light",
  "visual-studio-dark": "vs-dark",
  "visual-studio-system": "vs-system"
};

export const normalizeThemeId = (value: string | null | undefined): ThemeId | null => {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  if (THEME_IDS.has(normalized)) {
    return normalized as ThemeId;
  }

  return THEME_ALIASES[normalized] ?? null;
};

export const isThemeMode = (value: string | null): value is ThemeMode => {
  return normalizeThemeId(value) !== null;
};

export const getThemeOption = (themeId: ThemeId): ThemeOption => {
  return THEME_BY_ID.get(themeId) ?? THEME_OPTIONS[0];
};

export const resolveSystemTone = (): ThemeEffectiveTone => {
  if (typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }

  return "light";
};

export const resolveLegacySystemTheme = (): ThemeId => {
  return resolveSystemTone();
};

export const getEffectiveThemeId = (themeId: ThemeId, systemTone: ThemeEffectiveTone = resolveSystemTone()): ThemeId => {
  const option = getThemeOption(themeId);
  if (option.tone !== "system") {
    return themeId;
  }

  return FAMILY_TONE_THEME_IDS[option.family][systemTone];
};

export const applyThemeAttributes = (
  root: HTMLElement,
  themeId: ThemeId,
  systemTone: ThemeEffectiveTone = resolveSystemTone()
): void => {
  const option = getThemeOption(themeId);
  const effectiveTone = option.tone === "system" ? systemTone : option.tone;
  const effectiveThemeId = getEffectiveThemeId(themeId, effectiveTone);

  root.setAttribute("data-theme-id", option.id);
  root.setAttribute("data-theme", effectiveThemeId);
  root.setAttribute("data-theme-shell", option.shellType);
  root.setAttribute("data-theme-family", option.family);
  root.setAttribute("data-theme-tone", option.tone);
  root.setAttribute("data-theme-effective-tone", effectiveTone);
};

export const readThemeParamFromLocation = (): ThemeId | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const params = new URLSearchParams(window.location.search);
  if (!params.has(THEME_PARAM_NAME)) {
    return null;
  }

  return normalizeThemeId(params.get(THEME_PARAM_NAME)) ?? DEFAULT_THEME_ID;
};

export const applyThemeMode = (mode: ThemeMode): void => {
  applyThemeAttributes(document.documentElement, mode);
};

export const getThemeInitScript = (): string => {
  return `(() => {
    try {
      const key = ${JSON.stringify(THEME_STORAGE_DEFINITION.key)};
      const defaultTheme = ${JSON.stringify(DEFAULT_THEME_ID)};
      const paramName = ${JSON.stringify(THEME_PARAM_NAME)};
      const themes = ${JSON.stringify(
        Object.fromEntries(
          THEME_OPTIONS.map((option) => [
            option.id,
            {
              family: option.family,
              shell: option.shellType,
              tone: option.tone
            }
          ])
        )
      )};
      const familyToneThemeIds = ${JSON.stringify(FAMILY_TONE_THEME_IDS)};
      const valid = new Set(Object.keys(themes));
      const aliases = ${JSON.stringify(THEME_ALIASES)};
      const normalize = (value) => {
        const normalized = String(value || "").trim().toLowerCase();
        if (!normalized) return null;
        if (valid.has(normalized)) return normalized;
        return aliases[normalized] || null;
      };
      const params = new URLSearchParams(window.location.search);
      const hasThemeParam = params.has(paramName);
      const paramTheme = hasThemeParam ? normalize(params.get(paramName)) || defaultTheme : null;
      const storedRaw = window.localStorage.getItem(key);
      const storedTheme = storedRaw ? normalize(storedRaw) || defaultTheme : null;
      const value = paramTheme || storedTheme || defaultTheme;
      const option = themes[value] || themes[defaultTheme];
      const systemTone =
        window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      const effectiveTone = option.tone === "system" ? systemTone : option.tone;
      const effectiveTheme = familyToneThemeIds[option.family][effectiveTone] || defaultTheme;
      const root = document.documentElement;
      root.setAttribute("data-theme-id", value);
      root.setAttribute("data-theme", effectiveTheme);
      root.setAttribute("data-theme-shell", option.shell);
      root.setAttribute("data-theme-family", option.family);
      root.setAttribute("data-theme-tone", option.tone);
      root.setAttribute("data-theme-effective-tone", effectiveTone);
    } catch {
      const root = document.documentElement;
      root.setAttribute("data-theme-id", ${JSON.stringify(DEFAULT_THEME_ID)});
      root.setAttribute("data-theme", ${JSON.stringify(DEFAULT_THEME_ID)});
      root.setAttribute("data-theme-shell", "default");
      root.setAttribute("data-theme-family", "default");
      root.setAttribute("data-theme-tone", "light");
      root.setAttribute("data-theme-effective-tone", "light");
    }
  })();`;
};
