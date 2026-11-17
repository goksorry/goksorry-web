import "server-only";

import { unstable_cache } from "next/cache";
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

export const POLICY_CHANGE_CACHE_TAG = "policy-change-active";

const loadActivePolicyChanges = async (): Promise<ActivePolicyChange[]> => {
  const supabase = getServiceSupabaseClient();
  const now = new Date().toISOString();
  const { data: documentChange, error: documentError } = await supabase
    .from("policy_document_versions")
    .select("id, type, summary, effective_at")
    .is("superseded_at", null)
    .lte("published_at", now)
    .gt("effective_at", now)
    .order("effective_at", { ascending: true })
    .limit(50);

  if (documentError && !isMissingPolicyDocumentVersionsTableError(documentError.code, documentError.message)) {
    if (isTransientPolicyFetchError(documentError.message)) {
      return [];
    }

    throw new Error(`Failed to load active policy document change: ${documentError.message}`);
  }

  if (documentChange?.length) {
    return documentChange.map((change: PolicyChangeRow) => ({
      id: change.id,
      type: change.type,
      summary: change.summary,
      effectiveAt: change.effective_at,
      href: `${POLICY_DOCUMENT_META[change.type].href}?version=${change.id}`,
      label: POLICY_DOCUMENT_META[change.type].title
    }));
  }

  const { data, error } = await supabase
    .from("policy_changes")
    .select("id, type, summary, effective_at")
    .lte("published_at", now)
    .gt("effective_at", now)
    .order("published_at", { ascending: false })
    .limit(50);

  if (error) {
    if (isMissingPolicyChangesTableError(error.code, error.message)) {
      return [];
    }

    if (isTransientPolicyFetchError(error.message)) {
      return [];
    }

    throw new Error(`Failed to load active policy change: ${error.message}`);
  }

  return (data ?? []).map((change: PolicyChangeRow) => ({
    id: change.id,
    type: change.type,
    summary: change.summary,
    effectiveAt: change.effective_at,
    href: POLICY_DOCUMENT_META[change.type].href,
    label: POLICY_DOCUMENT_META[change.type].title
  }));
};

export const getActivePolicyChanges = unstable_cache(loadActivePolicyChanges, ["policy-changes-active-v2"], {
  revalidate: 60,
  tags: [POLICY_CHANGE_CACHE_TAG]
});
