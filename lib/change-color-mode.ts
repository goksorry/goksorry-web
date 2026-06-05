import { CLIENT_PERSISTENCE_DEFINITIONS } from "@/lib/persistence-registry";

export type ChangeColorMode = "kr" | "us" | "hybrid";
export type MarketColorContext = "kr" | "us";

export const CHANGE_COLOR_MODE_STORAGE_DEFINITION = CLIENT_PERSISTENCE_DEFINITIONS.changeColorMode;
export const CHANGE_COLOR_MODE_COOKIE_DEFINITION = CLIENT_PERSISTENCE_DEFINITIONS.changeColorModeCookie;
export const CHANGE_COLOR_MODE_REQUEST_HEADER = "x-goksorry-change-color-mode";
export const DEFAULT_CHANGE_COLOR_MODE: ChangeColorMode = "hybrid";
export const CHANGE_COLOR_MODES: ChangeColorMode[] = ["kr", "us", "hybrid"];

const CHANGE_COLOR_MODE_SET = new Set<string>(CHANGE_COLOR_MODES);

export const normalizeChangeColorMode = (value: string | null | undefined): ChangeColorMode | null => {
  const normalized = String(value ?? "").trim().toLowerCase();
  return CHANGE_COLOR_MODE_SET.has(normalized) ? (normalized as ChangeColorMode) : null;
};

export const applyChangeColorMode = (mode: ChangeColorMode): void => {
  document.documentElement.setAttribute("data-change-color-mode", mode);
};

export const getMarketColorContextForIndicator = (id: string): MarketColorContext => {
  return id.trim().toLowerCase() === "nasdaq" ? "us" : "kr";
};

export const getMarketColorContextForAnalysisSection = (id: string): MarketColorContext => {
  return id.trim().toLowerCase().startsWith("us_") ? "us" : "kr";
};
