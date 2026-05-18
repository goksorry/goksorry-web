import { CLIENT_PERSISTENCE_DEFINITIONS } from "@/lib/persistence-registry";

export type ThemeTone = "light" | "dark" | "system";
export type ThemeEffectiveTone = Exclude<ThemeTone, "system">;
export type ThemeFamily = "default" | "excel" | "powerpoint" | "docs" | "vscode" | "jetbrains";
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
  | "jetbrains-system";

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

export type ThemeFamilyIcon = {
  href: string;
  label: string;
  mimeType: string;
};

export const THEME_STORAGE_DEFINITION = CLIENT_PERSISTENCE_DEFINITIONS.themeMode;
export const THEME_COOKIE_DEFINITION = CLIENT_PERSISTENCE_DEFINITIONS.themeModeCookie;
export const THEME_PARAM_NAME = "theme";
export const THEME_REQUEST_HEADER = "x-goksorry-theme-id";
export const DEFAULT_THEME_ID: ThemeId = "light";
export const DEFAULT_FAVICON_HREF = "/favicon.ico";

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
  buildThemeOption("excel-light", "엑셀 라이트", "excel", "Excel", "light", "excel", ["#f3f2f1", "#217346", "#ffffff"]),
  buildThemeOption("excel-dark", "엑셀 다크", "excel", "Excel", "dark", "excel", ["#181f1b", "#21a366", "#27332b"]),
  buildThemeOption("excel-system", "엑셀 시스템", "excel", "Excel", "system", "excel", ["#f3f2f1", "#181f1b", "#217346"]),
  buildThemeOption(
    "powerpoint-light",
    "파워포인트 라이트",
    "powerpoint",
    "PowerPoint",
    "light",
    "powerpoint",
    ["#f4f3f2", "#b7472a", "#ffffff"]
  ),
  buildThemeOption(
    "powerpoint-dark",
    "파워포인트 다크",
    "powerpoint",
    "PowerPoint",
    "dark",
    "powerpoint",
    ["#1f1d1c", "#d35230", "#342b26"]
  ),
  buildThemeOption(
    "powerpoint-system",
    "파워포인트 시스템",
    "powerpoint",
    "PowerPoint",
    "system",
    "powerpoint",
    ["#f4f3f2", "#1f1d1c", "#b7472a"]
  ),
  buildThemeOption("docs-light", "Docs 라이트", "docs", "Docs", "light", "docs", ["#f8fafd", "#1a73e8", "#edf2fa"]),
  buildThemeOption("docs-dark", "Docs 다크", "docs", "Docs", "dark", "docs", ["#131314", "#a8c7fa", "#303134"]),
  buildThemeOption("docs-system", "Docs 시스템", "docs", "Docs", "system", "docs", ["#f8fafd", "#131314", "#1a73e8"]),
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
    ["#f4f4f4", "#3574f0", "#e9ebef"]
  ),
  buildThemeOption(
    "jetbrains-dark",
    "JetBrains 다크",
    "jetbrains",
    "JetBrains",
    "dark",
    "jetbrains",
    ["#1e1f22", "#3574f0", "#303236"]
  ),
  buildThemeOption(
    "jetbrains-system",
    "JetBrains 시스템",
    "jetbrains",
    "JetBrains",
    "system",
    "jetbrains",
    ["#f4f4f4", "#1e1f22", "#3574f0"]
  )
];

const THEME_IDS = new Set<string>(THEME_OPTIONS.map((option) => option.id));
const THEME_BY_ID = new Map<ThemeId, ThemeOption>(THEME_OPTIONS.map((option) => [option.id, option]));

export const THEME_FAMILY_ICONS: Record<ThemeFamily, ThemeFamilyIcon> = {
  default: {
    href: DEFAULT_FAVICON_HREF,
    label: "기본",
    mimeType: "image/x-icon"
  },
  excel: {
    href: "/theme-icons/excel.svg",
    label: "Excel",
    mimeType: "image/svg+xml"
  },
  powerpoint: {
    href: "/theme-icons/powerpoint.svg",
    label: "PowerPoint",
    mimeType: "image/svg+xml"
  },
  docs: {
    href: "/theme-icons/docs.svg",
    label: "Docs",
    mimeType: "image/svg+xml"
  },
  vscode: {
    href: "/theme-icons/vscode.svg",
    label: "VS Code",
    mimeType: "image/svg+xml"
  },
  jetbrains: {
    href: "/theme-icons/jetbrains.svg",
    label: "JetBrains",
    mimeType: "image/svg+xml"
  }
};

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
  jetbrains: "jetbrains-system"
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

export const getThemeFamilyIcon = (family: ThemeFamily): ThemeFamilyIcon => {
  return THEME_FAMILY_ICONS[family] ?? THEME_FAMILY_ICONS.default;
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

export type ThemeAttributeValues = {
  themeId: ThemeId;
  theme: ThemeId;
  shell: ThemeShellType;
  family: ThemeFamily;
  tone: ThemeTone;
  effectiveTone: ThemeEffectiveTone;
};

export const getThemeAttributeValues = (
  themeId: ThemeId,
  systemTone: ThemeEffectiveTone = resolveSystemTone()
): ThemeAttributeValues => {
  const option = getThemeOption(themeId);
  const effectiveTone = option.tone === "system" ? systemTone : option.tone;

  return {
    themeId: option.id,
    theme: getEffectiveThemeId(option.id, effectiveTone),
    shell: option.shellType,
    family: option.family,
    tone: option.tone,
    effectiveTone
  };
};

export const applyThemeAttributes = (
  root: HTMLElement,
  themeId: ThemeId,
  systemTone: ThemeEffectiveTone = resolveSystemTone()
): void => {
  const attributes = getThemeAttributeValues(themeId, systemTone);

  root.setAttribute("data-theme-id", attributes.themeId);
  root.setAttribute("data-theme", attributes.theme);
  root.setAttribute("data-theme-shell", attributes.shell);
  root.setAttribute("data-theme-family", attributes.family);
  root.setAttribute("data-theme-tone", attributes.tone);
  root.setAttribute("data-theme-effective-tone", attributes.effectiveTone);
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
      const cookieKey = ${JSON.stringify(THEME_COOKIE_DEFINITION.key)};
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
      const familyIcons = ${JSON.stringify(THEME_FAMILY_ICONS)};
      const familyToneThemeIds = ${JSON.stringify(FAMILY_TONE_THEME_IDS)};
      const valid = new Set(Object.keys(themes));
      const aliases = ${JSON.stringify(THEME_ALIASES)};
      const normalize = (value) => {
        const normalized = String(value || "").trim().toLowerCase();
        if (!normalized) return null;
        if (valid.has(normalized)) return normalized;
        return aliases[normalized] || null;
      };
      const readCookie = (name) => {
        const prefix = name + "=";
        const entry = document.cookie
          .split(";")
          .map((part) => part.trim())
          .find((part) => part.startsWith(prefix));
        if (!entry) return null;
        try {
          return decodeURIComponent(entry.slice(prefix.length));
        } catch {
          return entry.slice(prefix.length);
        }
      };
      const params = new URLSearchParams(window.location.search);
      const hasThemeParam = params.has(paramName);
      const paramTheme = hasThemeParam ? normalize(params.get(paramName)) || defaultTheme : null;
      const cookieTheme = normalize(readCookie(cookieKey));
      const storedRaw = (() => {
        try {
          return window.localStorage.getItem(key);
        } catch {
          return null;
        }
      })();
      const storedTheme = storedRaw ? normalize(storedRaw) || defaultTheme : null;
      const value = paramTheme || cookieTheme || storedTheme || defaultTheme;
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
      const icon = familyIcons[option.family] || familyIcons.default;
      let favicon = document.querySelector('link[data-theme-favicon="true"]');
      if (!favicon) {
        favicon = document.createElement("link");
        favicon.setAttribute("data-theme-favicon", "true");
        document.head.appendChild(favicon);
      }
      favicon.setAttribute("rel", "icon");
      favicon.setAttribute("href", icon.href);
      favicon.setAttribute("type", icon.mimeType);
      if (icon.mimeType === "image/svg+xml") {
        favicon.setAttribute("sizes", "any");
      } else {
        favicon.removeAttribute("sizes");
      }
    } catch {
      const root = document.documentElement;
      root.setAttribute("data-theme-id", ${JSON.stringify(DEFAULT_THEME_ID)});
      root.setAttribute("data-theme", ${JSON.stringify(DEFAULT_THEME_ID)});
      root.setAttribute("data-theme-shell", "default");
      root.setAttribute("data-theme-family", "default");
      root.setAttribute("data-theme-tone", "light");
      root.setAttribute("data-theme-effective-tone", "light");
      let favicon = document.querySelector('link[data-theme-favicon="true"]');
      if (!favicon) {
        favicon = document.createElement("link");
        favicon.setAttribute("data-theme-favicon", "true");
        document.head.appendChild(favicon);
      }
      favicon.setAttribute("rel", "icon");
      favicon.setAttribute("href", ${JSON.stringify(DEFAULT_FAVICON_HREF)});
      favicon.setAttribute("type", "image/x-icon");
      favicon.removeAttribute("sizes");
    }
  })();`;
};
