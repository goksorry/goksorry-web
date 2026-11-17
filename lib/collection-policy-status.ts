import "server-only";
import { normalizeAggregateBuckets, type CommunityAggregate } from "./community-aggregates";

import { unstable_cache } from "next/cache";
import { getServiceSupabaseClient } from "@/lib/supabase/service";
import { getSourceGroupId, matchesSourceName } from "@/lib/feed-source-groups";

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
  contentSince?: string | null;
  allowTitles?: boolean;
};

export type FooterCollectionPolicy = {
  checkedAt: string | null;
  refreshHours: number;
  sources: FooterCollectionPolicySource[];
  aggregateBuckets?: CommunityAggregate[];
  processingMode?: string;
};

export function filterReviewedSourceRows<T extends { source: string; analyzed_at: string }>(rows: T[], policy: FooterCollectionPolicy | null): T[] {
  if (!policy?.sources.length) throw new Error("collection policy unavailable");
  const allowed = policy.sources.filter(source => source.allowTitles && source.allowFetch && !source.postponed
    && (source.reason !== "reviewed_limited_use" || Boolean(source.contentSince)));
  return rows.filter(row => allowed.some(source => matchesSourceName(row.source, source.sourceName)
    && (!source.contentSince || Date.parse(row.analyzed_at) >= Date.parse(source.contentSince))));
}

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

export const normalizePolicyPayload = (value: unknown): FooterCollectionPolicy | null => {
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
        allowTitles: (source.display_mode === "titles" || source.reason === "reviewed_limited_use" || source.reason === "operator_limited_use") && Boolean(parseIso(source.content_since)) && Boolean(getSourceGroupId(sourceName)),
        siteKey: textOrNull(source.site_key),
        checkedAt: parseIso(source.checked_at),
        allowFetch,
        allowDetail: Boolean(source.allow_detail),
        postponed,
        reason: textOrNull(source.reason),
        robotsUrl: textOrNull(source.robots_url),
        termsUrl: textOrNull(source.terms_url),
        articleCount,
        collectionProblem,
        contentSince: parseIso(source.content_since)
      }
    ];
  });

  const refreshHours = Number(payload.refresh_hours);
  const sourceCheckedAtValues = sources
    .map((source) => source.checkedAt)
    .filter((value): value is string => Boolean(value))
    .sort();
  return {
    processingMode: payload.processing_mode === "scoped_titles" ? "scoped_titles" : payload.processing_mode === "aggregate_only" ? "aggregate_only" : "legacy",
    aggregateBuckets: normalizeAggregateBuckets(payload.aggregate_buckets),
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
