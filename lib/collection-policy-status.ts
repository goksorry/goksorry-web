import "server-only";

import { unstable_cache } from "next/cache";
import { getServiceSupabaseClient } from "@/lib/supabase/service";

export const COLLECTION_POLICY_CACHE_TAG = "collection-policy-status";

export type FooterCollectionPolicySource = {
  sourceName: string;
  siteKey: string | null;
  checkedAt: string | null;
  allowFetch: boolean;
  allowDetail: boolean;
  postponed: boolean;
  reason: string | null;
  robotsUrl: string | null;
  termsUrl: string | null;
  articleCount: number | null;
  collectionProblem: boolean;
};

export type FooterCollectionPolicy = {
  checkedAt: string | null;
  refreshHours: number;
  sources: FooterCollectionPolicySource[];
};

type CollectionPolicyRow = {
  collection_policy: unknown;
};

const isMissingCollectionPolicyFieldError = (code: string | null | undefined, message: string): boolean => {
  return (
    code === "42P01" ||
    code === "42703" ||
    code === "PGRST204" ||
    code === "PGRST205" ||
    message.includes("detector_status") ||
    message.includes("collection_policy") ||
    message.includes("schema cache")
  );
};

const isTransientPolicyFetchError = (message: string): boolean => {
  return message.includes("fetch failed") || message.includes("TypeError: fetch failed");
};

const parseIso = (value: unknown): string | null => {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return null;
  }

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
};

const textOrNull = (value: unknown): string | null => {
  const text = String(value ?? "").trim();
  return text ? text : null;
};

const numberOrNull = (value: unknown): number | null => {
  const num = Number(value);
  return Number.isFinite(num) ? Math.max(0, Math.floor(num)) : null;
};

const normalizePolicyPayload = (value: unknown): FooterCollectionPolicy | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const payload = value as Record<string, unknown>;
  const rawSources = Array.isArray(payload.sources) ? payload.sources : [];
  const sources = rawSources.flatMap((item): FooterCollectionPolicySource[] => {
    if (!item || typeof item !== "object") {
      return [];
    }

    const source = item as Record<string, unknown>;
    const sourceName = textOrNull(source.source_name);
    if (!sourceName) {
      return [];
    }

    const articleCount = numberOrNull(source.article_count);
    const allowFetch = Boolean(source.allow_fetch);
    const postponed = Boolean(source.postponed);
    const collectionProblem =
      Boolean(source.collection_problem) || !allowFetch || postponed || articleCount === 0;

    return [
      {
        sourceName,
        siteKey: textOrNull(source.site_key),
        checkedAt: parseIso(source.checked_at),
        allowFetch,
        allowDetail: Boolean(source.allow_detail),
        postponed,
        reason: textOrNull(source.reason),
        robotsUrl: textOrNull(source.robots_url),
        termsUrl: textOrNull(source.terms_url),
        articleCount,
        collectionProblem
      }
    ];
  });

  const refreshHours = Number(payload.refresh_hours);
  const sourceCheckedAtValues = sources
    .map((source) => source.checkedAt)
    .filter((value): value is string => Boolean(value))
    .sort();
  return {
    checkedAt: parseIso(payload.checked_at) ?? sourceCheckedAtValues[sourceCheckedAtValues.length - 1] ?? null,
    refreshHours: Number.isFinite(refreshHours) && refreshHours > 0 ? Math.floor(refreshHours) : 24,
    sources
  };
};

const loadFooterCollectionPolicy = async (): Promise<FooterCollectionPolicy | null> => {
  const service = getServiceSupabaseClient();
  const { data, error } = await service
    .from("detector_status")
    .select("collection_policy")
    .eq("singleton", true)
    .maybeSingle<CollectionPolicyRow>();

  if (error) {
    if (isMissingCollectionPolicyFieldError(error.code, error.message)) {
      return null;
    }

    if (isTransientPolicyFetchError(error.message)) {
      return null;
    }

    console.error("collection policy status lookup failed", error);
    return null;
  }

  return normalizePolicyPayload(data?.collection_policy);
};

export const getFooterCollectionPolicy = unstable_cache(
  loadFooterCollectionPolicy,
  ["collection-policy-status"],
  {
    revalidate: 300,
    tags: [COLLECTION_POLICY_CACHE_TAG]
  }
);
