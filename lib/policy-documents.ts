import "server-only";

import { unstable_noStore as noStore } from "next/cache";
import { getServiceSupabaseClient } from "@/lib/supabase/service";
import { POLICY_DOCUMENT_DEFAULTS, POLICY_DOCUMENT_META, type PolicyDocumentType } from "@/lib/policy-defaults";

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

const buildFallbackDocument = (type: PolicyDocumentType): PolicyDocumentVersion => {
  const fallback = POLICY_DOCUMENT_DEFAULTS[type];
  return {
    id: `fallback-${type}`,
    type,
    title: fallback.title,
    summary: fallback.summary,
    body: fallback.body,
    is_adverse: false,
    published_at: fallback.effectiveDate,
    effective_at: fallback.effectiveDate,
    updated_at: fallback.updatedDate,
    superseded_at: null,
    created_at: fallback.updatedDate
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
      return buildFallbackDocument(type);
    }

    throw new Error(`Failed to load current policy document: ${error.message}`);
  }

  if (!data) {
    return buildFallbackDocument(type);
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
      return [buildFallbackDocument(type)];
    }

    throw new Error(`Failed to list policy document versions: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return [buildFallbackDocument(type)];
  }

  return data.map(mapPolicyDocument);
};
