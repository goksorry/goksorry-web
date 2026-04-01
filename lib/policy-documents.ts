import "server-only";

import { unstable_noStore as noStore } from "next/cache";
import { getServiceSupabaseClient } from "@/lib/supabase/service";
import { POLICY_DOCUMENT_META, type PolicyDocumentType } from "@/lib/policy-defaults";

export type PolicyDocumentVersion = {
  id: string;
  type: PolicyDocumentType;
  title: string;
  summary: string;
  body: string;
  is_adverse: boolean;
  published_at: string;
  effective_at: string;
  updated_at: string;
  superseded_at: string | null;
  created_at: string;
};

type PolicyDocumentVersionRow = {
  id: string;
  type: PolicyDocumentType;
  summary: string;
  body: string;
  is_adverse: boolean;
  published_at: string;
  effective_at: string;
  updated_at: string;
  superseded_at: string | null;
  created_at: string;
};

const isMissingPolicyDocumentTableError = (code: string | null | undefined, message: string): boolean => {
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    message.includes("policy_document_versions") ||
    message.includes("schema cache")
  );
};

const buildPolicyDocumentLoadError = (type: PolicyDocumentType, detail: string): Error => {
  return new Error(`${POLICY_DOCUMENT_META[type].title} 문서를 불러오지 못했습니다. ${detail}`);
};

const mapPolicyDocument = (row: PolicyDocumentVersionRow): PolicyDocumentVersion => {
  return {
    id: String(row.id),
    type: row.type,
    title: POLICY_DOCUMENT_META[row.type].title,
    summary: String(row.summary ?? ""),
    body: String(row.body ?? ""),
    is_adverse: Boolean(row.is_adverse),
    published_at: String(row.published_at),
    effective_at: String(row.effective_at),
    updated_at: String(row.updated_at),
    superseded_at: row.superseded_at ? String(row.superseded_at) : null,
    created_at: String(row.created_at)
  };
};

export const getCurrentPolicyDocument = async (type: PolicyDocumentType): Promise<PolicyDocumentVersion> => {
  noStore();

  const service = getServiceSupabaseClient();
  const nowIso = new Date().toISOString();
  const { data, error } = await service
    .from("policy_document_versions")
    .select("id,type,summary,body,is_adverse,published_at,effective_at,updated_at,superseded_at,created_at")
    .eq("type", type)
    .is("superseded_at", null)
    .lte("effective_at", nowIso)
    .order("effective_at", { ascending: false })
    .order("published_at", { ascending: false })
    .limit(1)
    .maybeSingle<PolicyDocumentVersionRow>();

  if (error) {
    if (isMissingPolicyDocumentTableError(error.code, error.message)) {
      throw buildPolicyDocumentLoadError(type, "정책 문서 저장소를 확인할 수 없습니다.");
    }

    throw buildPolicyDocumentLoadError(type, "정책 문서 조회 중 오류가 발생했습니다.");
  }

  if (!data) {
    throw buildPolicyDocumentLoadError(type, "현재 적용 중인 문서가 등록되어 있지 않습니다.");
  }

  return mapPolicyDocument(data);
};

export const listPolicyDocumentVersions = async (type: PolicyDocumentType): Promise<PolicyDocumentVersion[]> => {
  noStore();

  const service = getServiceSupabaseClient();
  const { data, error } = await service
    .from("policy_document_versions")
    .select("id,type,summary,body,is_adverse,published_at,effective_at,updated_at,superseded_at,created_at")
    .eq("type", type)
    .order("published_at", { ascending: false })
    .limit(50);

  if (error) {
    if (isMissingPolicyDocumentTableError(error.code, error.message)) {
      throw buildPolicyDocumentLoadError(type, "정책 문서 저장소를 확인할 수 없습니다.");
    }

    throw buildPolicyDocumentLoadError(type, "정책 문서 목록 조회 중 오류가 발생했습니다.");
  }

  if (!data || data.length === 0) {
    throw buildPolicyDocumentLoadError(type, "등록된 문서 이력이 없습니다.");
  }

  return data.map(mapPolicyDocument);
};
