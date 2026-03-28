import "server-only";

import { getServiceSupabaseClient } from "@/lib/supabase/service";
import { POLICY_DOCUMENT_META, type PolicyDocumentType } from "@/lib/policy-defaults";

export type ActivePolicyChange = {
  id: string;
  type: PolicyDocumentType;
  summary: string;
  effectiveAt: string;
  href: string;
  label: string;
};

type PolicyChangeRow = {
  id: string;
  type: PolicyDocumentType;
  summary: string;
  effective_at: string;
};

const isMissingPolicyChangesTableError = (code: string | null | undefined, message: string): boolean => {
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    message.includes("Could not find the table 'public.policy_changes'") ||
    message.includes("schema cache")
  );
};

const isMissingPolicyDocumentVersionsTableError = (code: string | null | undefined, message: string): boolean => {
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    message.includes("policy_document_versions") ||
    message.includes("schema cache")
  );
};

const isTransientPolicyFetchError = (message: string): boolean => {
  return message.includes("fetch failed") || message.includes("TypeError: fetch failed");
};

export const getActivePolicyChange = async (): Promise<ActivePolicyChange | null> => {
  const supabase = getServiceSupabaseClient();
  const now = new Date().toISOString();
  const { data: documentChange, error: documentError } = await supabase
    .from("policy_document_versions")
    .select("id, type, summary, effective_at")
    .is("superseded_at", null)
    .lte("published_at", now)
    .gt("effective_at", now)
    .order("effective_at", { ascending: true })
    .limit(1)
    .maybeSingle<PolicyChangeRow>();

  if (documentError && !isMissingPolicyDocumentVersionsTableError(documentError.code, documentError.message)) {
    if (isTransientPolicyFetchError(documentError.message)) {
      return null;
    }

    throw new Error(`Failed to load active policy document change: ${documentError.message}`);
  }

  if (documentChange) {
    const policy = POLICY_DOCUMENT_META[documentChange.type];
    return {
      id: documentChange.id,
      type: documentChange.type,
      summary: documentChange.summary,
      effectiveAt: documentChange.effective_at,
      href: policy.href,
      label: policy.title
    };
  }

  const { data, error } = await supabase
    .from("policy_changes")
    .select("id, type, summary, effective_at")
    .lte("published_at", now)
    .gt("effective_at", now)
    .order("published_at", { ascending: false })
    .limit(1)
    .maybeSingle<PolicyChangeRow>();

  if (error) {
    if (isMissingPolicyChangesTableError(error.code, error.message)) {
      return null;
    }

    if (isTransientPolicyFetchError(error.message)) {
      return null;
    }

    throw new Error(`Failed to load active policy change: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  const policy = POLICY_DOCUMENT_META[data.type];
  return {
    id: data.id,
    type: data.type,
    summary: data.summary,
    effectiveAt: data.effective_at,
    href: policy.href,
    label: policy.title
  };
};
