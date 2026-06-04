import "server-only";

import { unstable_noStore as noStore } from "next/cache";
import { getServiceSupabaseClient } from "@/lib/supabase/service";

export type AnalysisReportStatus = "ok" | "partial" | "error";
export type AnalysisTone = "up" | "down" | "flat" | "fear" | "greed" | "mixed";
export type AnalysisSectionId =
  | "korean_news"
  | "us_news"
  | "kr_top10"
  | "us_top10"
  | "kr_themes"
  | "us_themes"
  | "kr_valuation"
  | "us_valuation"
  | "kr_large_popular_changes"
  | "us_large_popular_changes"
  | "kr_chart_states"
  | "us_chart_states";

export type AnalysisItem = {
  label: string;
  value: string;
  note: string;
  tone: AnalysisTone;
};

export type AnalysisSection = {
  id: AnalysisSectionId;
  title: string;
  summary: string;
  items: AnalysisItem[];
};

export type AnalysisReportPayload = {
  headline: string;
  brief: string;
  sections: Record<AnalysisSectionId, AnalysisSection>;
  important_symbols: string[];
  generated_from: Record<string, unknown>;
};

export type AnalysisReport = {
  id: string;
  asof: string;
  status: AnalysisReportStatus;
  summary: string;
  payload: AnalysisReportPayload;
  errors: string[];
  created_at: string;
};

type ReportRow = {
  id: unknown;
  asof: unknown;
  status: unknown;
  summary: unknown;
  payload: unknown;
  errors: unknown;
  created_at: unknown;
};

export const ANALYSIS_SECTION_ORDER: AnalysisSectionId[] = [
  "korean_news",
  "us_news",
  "kr_top10",
  "us_top10",
  "kr_themes",
  "us_themes",
  "kr_valuation",
  "us_valuation",
  "kr_large_popular_changes",
  "us_large_popular_changes",
  "kr_chart_states",
  "us_chart_states"
];

const SECTION_TITLES: Record<AnalysisSectionId, string> = {
  korean_news: "한국 경제 뉴스",
  us_news: "미국 경제 뉴스",
  kr_top10: "한국 Top 10",
  us_top10: "미국 Top 10",
  kr_themes: "한국 인기 테마",
  us_themes: "미국 인기 테마",
  kr_valuation: "한국 PER/PBR",
  us_valuation: "미국 PER/PBR",
  kr_large_popular_changes: "한국 인기주 변화",
  us_large_popular_changes: "미국 인기주 변화",
  kr_chart_states: "한국 차트 상세",
  us_chart_states: "미국 차트 상세"
};

const TONES = new Set<AnalysisTone>(["up", "down", "flat", "fear", "greed", "mixed"]);

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

const asText = (value: unknown, fallback = "", maxLength = 500): string => {
  const text = typeof value === "string" ? value : value === null || value === undefined ? "" : String(value);
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return fallback;
  }
  return normalized.slice(0, maxLength);
};

const asTone = (value: unknown): AnalysisTone => {
  const text = asText(value, "mixed", 20).toLowerCase();
  return TONES.has(text as AnalysisTone) ? (text as AnalysisTone) : "mixed";
};

const normalizeItems = (value: unknown): AnalysisItem[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.slice(0, 10).flatMap((item) => {
    const record = asRecord(item);
    if (!record) {
      return [];
    }

    const label = asText(record.label, "", 80);
    const valueText = asText(record.value, "", 120);
    const note = asText(record.note, "", 240);
    if (!label && !valueText && !note) {
      return [];
    }

    return [
      {
        label: label || "항목",
        value: valueText,
        note,
        tone: asTone(record.tone)
      }
    ];
  });
};

const normalizeSection = (id: AnalysisSectionId, value: unknown): AnalysisSection => {
  const record = asRecord(value) ?? {};
  return {
    id,
    title: asText(record.title, SECTION_TITLES[id], 80),
    summary: asText(record.summary, "분석 대기 중", 500),
    items: normalizeItems(record.items)
  };
};

export const normalizeAnalysisPayload = (value: unknown): AnalysisReportPayload => {
  const record = asRecord(value) ?? {};
  const sectionsRecord = asRecord(record.sections) ?? {};
  const sections = Object.fromEntries(
    ANALYSIS_SECTION_ORDER.map((id) => [id, normalizeSection(id, sectionsRecord[id])])
  ) as Record<AnalysisSectionId, AnalysisSection>;

  return {
    headline: asText(record.headline, "분석 대기 중", 160),
    brief: asText(record.brief, "삐에로봇 분석 결과가 아직 없습니다.", 800),
    sections,
    important_symbols: Array.isArray(record.important_symbols)
      ? record.important_symbols.map((item) => asText(item, "", 80)).filter(Boolean).slice(0, 20)
      : [],
    generated_from: asRecord(record.generated_from) ?? {}
  };
};

const normalizeErrors = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => asText(item, "", 240)).filter(Boolean).slice(0, 20);
};

const normalizeStatus = (value: unknown): AnalysisReportStatus => {
  const text = asText(value, "ok", 20).toLowerCase();
  if (text === "partial" || text === "error") {
    return text;
  }
  return "ok";
};

const normalizeReport = (row: ReportRow): AnalysisReport => {
  const payload = normalizeAnalysisPayload(row.payload);
  const summary = asText(row.summary, payload.brief, 1000);

  return {
    id: asText(row.id, "", 80),
    asof: asText(row.asof, new Date().toISOString(), 40),
    status: normalizeStatus(row.status),
    summary,
    payload,
    errors: normalizeErrors(row.errors),
    created_at: asText(row.created_at, "", 40)
  };
};

export const fetchLatestAnalysisReport = async (): Promise<AnalysisReport | null> => {
  noStore();
  const service = getServiceSupabaseClient();
  const { data, error } = await service
    .from("analysis_reports")
    .select("id,asof,status,summary,payload,errors,created_at")
    .order("asof", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("analysis report lookup failed", { message: error.message });
    return null;
  }

  return data ? normalizeReport(data as ReportRow) : null;
};
