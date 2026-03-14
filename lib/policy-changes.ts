import "server-only";

import { getServiceSupabaseClient } from "@/lib/supabase/service";

export type ActivePolicyChange = {
  id: string;
  type: "terms" | "privacy";
  summary: string;
  effectiveAt: string;
  href: string;
  label: string;
};

type PolicyChangeRow = {
  id: string;
  type: "terms" | "privacy";
  summary: string;
  effective_at: string;
};

const POLICY_PAGE_BY_TYPE = {
  terms: {
    href: "/terms",
    label: "이용약관"
  },
  privacy: {
    href: "/privacy",
    label: "개인정보처리방침"
  }
} as const;

export const getActivePolicyChange = async (): Promise<ActivePolicyChange | null> => {
  const supabase = getServiceSupabaseClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("policy_changes")
    .select("id, type, summary, effective_at")
    .lte("published_at", now)
    .gt("effective_at", now)
    .order("published_at", { ascending: false })
    .limit(1)
    .maybeSingle<PolicyChangeRow>();

  if (error) {
    if (error.code === "42P01") {
      return null;
    }

    throw new Error(`Failed to load active policy change: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  const policy = POLICY_PAGE_BY_TYPE[data.type];
  return {
    id: data.id,
    type: data.type,
    summary: data.summary,
    effectiveAt: data.effective_at,
    href: policy.href,
    label: policy.label
  };
};
