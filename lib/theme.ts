import { CLIENT_PERSISTENCE_DEFINITIONS } from "@/lib/persistence-registry";

export type ThemeId =
  | "light"
  | "dark"
  | "excel-light"
  | "excel-dark"
  | "powerpoint-light"
  | "powerpoint-dark"
  | "blog-light"
  | "blog-dark"
  | "docs-light"
  | "docs-dark"
  | "vscode-light"
  | "vscode-dark"
  | "jetbrains-light"
  | "jetbrains-dark"
  | "vs-light"
  | "vs-dark";

export type ThemeMode = ThemeId;
export type ThemeShellType = "default" | "excel" | "ide" | "presentation" | "blog" | "docs";

export type ThemeOption = {
  id: ThemeId;
  label: string;
  familyLabel: string;
  tone: "light" | "dark";
  shellType: ThemeShellType;
  swatches: [string, string, string];
};

export const THEME_STORAGE_DEFINITION = CLIENT_PERSISTENCE_DEFINITIONS.themeMode;
export const THEME_PARAM_NAME = "theme";
export const DEFAULT_THEME_ID: ThemeId = "light";

export const THEME_OPTIONS: ThemeOption[] = [
  { id: "light", label: "라이트", familyLabel: "기본", tone: "light", shellType: "default", swatches: ["#eef1f4", "#58606a", "#a25852"] },
  { id: "dark", label: "다크", familyLabel: "기본", tone: "dark", shellType: "default", swatches: ["#181c22", "#aeb7c1", "#c56b64"] },
  { id: "excel-light", label: "엑셀 라이트", familyLabel: "Excel", tone: "light", shellType: "excel", swatches: ["#f4fbf7", "#107c41", "#d6ede1"] },
  { id: "excel-dark", label: "엑셀 다크", familyLabel: "Excel", tone: "dark", shellType: "excel", swatches: ["#0f1f19", "#21a366", "#335b48"] },
  { id: "powerpoint-light", label: "파워포인트 라이트", familyLabel: "PowerPoint", tone: "light", shellType: "presentation", swatches: ["#fff5ef", "#c43e1c", "#f4c7b5"] },
  { id: "powerpoint-dark", label: "파워포인트 다크", familyLabel: "PowerPoint", tone: "dark", shellType: "presentation", swatches: ["#24150f", "#f26f42", "#7a3322"] },
  { id: "blog-light", label: "블로그 라이트", familyLabel: "Blog", tone: "light", shellType: "blog", swatches: ["#fbf6ee", "#8b5e3c", "#d9a441"] },
  { id: "blog-dark", label: "블로그 다크", familyLabel: "Blog", tone: "dark", shellType: "blog", swatches: ["#1d1814", "#d7a35b", "#755840"] },
  { id: "docs-light", label: "기술문서 라이트", familyLabel: "Docs", tone: "light", shellType: "docs", swatches: ["#f7f9fc", "#2563eb", "#10b981"] },
  { id: "docs-dark", label: "기술문서 다크", familyLabel: "Docs", tone: "dark", shellType: "docs", swatches: ["#0f172a", "#60a5fa", "#34d399"] },
  { id: "vscode-light", label: "VS Code 라이트", familyLabel: "VS Code", tone: "light", shellType: "ide", swatches: ["#f3f3f3", "#007acc", "#c586c0"] },
  { id: "vscode-dark", label: "VS Code 다크", familyLabel: "VS Code", tone: "dark", shellType: "ide", swatches: ["#1e1e1e", "#007acc", "#ce9178"] },
  { id: "jetbrains-light", label: "JetBrains 라이트", familyLabel: "JetBrains", tone: "light", shellType: "ide", swatches: ["#fafafa", "#6b21a8", "#f97316"] },
  { id: "jetbrains-dark", label: "JetBrains 다크", familyLabel: "JetBrains", tone: "dark", shellType: "ide", swatches: ["#19191f", "#a855f7", "#f59e0b"] },
  { id: "vs-light", label: "Visual Studio 라이트", familyLabel: "Visual Studio", tone: "light", shellType: "ide", swatches: ["#f7f4fb", "#68217a", "#2b579a"] },
  { id: "vs-dark", label: "Visual Studio 다크", familyLabel: "Visual Studio", tone: "dark", shellType: "ide", swatches: ["#1e1e2f", "#b180d7", "#569cd6"] }
];

const THEME_IDS = new Set<string>(THEME_OPTIONS.map((option) => option.id));

const THEME_ALIASES: Record<string, ThemeId> = {
  default: "light",
  system: "light",
  excel: "excel-light",
  powerpoint: "powerpoint-light",
  ppt: "powerpoint-light",
  blog: "blog-light",
  docs: "docs-light",
  document: "docs-light",
  techdocs: "docs-light",
  vscode: "vscode-dark",
  "vs-code": "vscode-dark",
  jetbrain: "jetbrains-dark",
  jetbrains: "jetbrains-dark",
  vs: "vs-dark",
  visualstudio: "vs-dark",
  "visual-studio": "vs-dark"
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
  return THEME_OPTIONS.find((option) => option.id === themeId) ?? THEME_OPTIONS[0];
};

export const applyThemeAttributes = (root: HTMLElement, themeId: ThemeId): void => {
  const option = getThemeOption(themeId);
  root.setAttribute("data-theme", option.id);
  root.setAttribute("data-theme-shell", option.shellType);
  root.setAttribute("data-theme-family", option.familyLabel.toLowerCase().replace(/\s+/g, "-"));
  root.setAttribute("data-theme-tone", option.tone);
};

export const resolveLegacySystemTheme = (): ThemeId => {
  if (typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }

  return "light";
};

export const readThemeParamFromLocation = (): ThemeId | null => {
  if (typeof window === "undefined") {
    return null;
  }

  return normalizeThemeId(new URLSearchParams(window.location.search).get(THEME_PARAM_NAME));
};

export const applyThemeMode = (mode: ThemeMode): void => {
  const root = document.documentElement;
  applyThemeAttributes(root, mode);
};

export const getThemeInitScript = (): string => {
  return `(() => {
    try {
      const key = ${JSON.stringify(THEME_STORAGE_DEFINITION.key)};
      const themes = ${JSON.stringify(
        Object.fromEntries(
          THEME_OPTIONS.map((option) => [
            option.id,
            {
              family: option.familyLabel.toLowerCase().replace(/\s+/g, "-"),
              shell: option.shellType,
              tone: option.tone
            }
          ])
        )
      )};
      const valid = new Set(Object.keys(themes));
      const aliases = ${JSON.stringify(THEME_ALIASES)};
      const normalize = (value) => {
        const normalized = String(value || "").trim().toLowerCase();
        if (!normalized) return null;
        if (valid.has(normalized)) return normalized;
        return aliases[normalized] || null;
      };
      const paramTheme = normalize(new URLSearchParams(window.location.search).get(${JSON.stringify(THEME_PARAM_NAME)}));
      const storedRaw = window.localStorage.getItem(key);
      const storedTheme = normalize(storedRaw);
      const legacySystemTheme =
        storedRaw === "system" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
      const value = paramTheme || storedTheme || (storedRaw === "system" ? legacySystemTheme : ${JSON.stringify(DEFAULT_THEME_ID)});
      const root = document.documentElement;
      root.setAttribute("data-theme", value);
      root.setAttribute("data-theme-shell", themes[value].shell);
      root.setAttribute("data-theme-family", themes[value].family);
      root.setAttribute("data-theme-tone", themes[value].tone);
    } catch {
      const root = document.documentElement;
      root.setAttribute("data-theme", ${JSON.stringify(DEFAULT_THEME_ID)});
      root.setAttribute("data-theme-shell", "default");
      root.setAttribute("data-theme-family", "default");
      root.setAttribute("data-theme-tone", "light");
    }
  })();`;
};
