import type { SupabaseClient } from "@supabase/supabase-js";

export const fetchCommentCountsByPostId = async (
  service: SupabaseClient,
  postIds: string[]
): Promise<Map<string, number>> => {
  const normalizedPostIds = [...new Set(postIds.map((postId) => String(postId).trim()).filter(Boolean))];
  if (normalizedPostIds.length === 0) {
    return new Map();
  }

  const { data, error } = await service
    .from("community_comments")
    .select("post_id")
    .in("post_id", normalizedPostIds)
    .eq("is_deleted", false);

  if (error || !data) {
    return new Map();
  }

  const counts = new Map<string, number>();
  for (const row of data) {
    const postId = String(row.post_id ?? "").trim();
    if (!postId) {
      continue;
    }
    counts.set(postId, (counts.get(postId) ?? 0) + 1);
  }

  return counts;
};

export const formatPinnedNoticeTitle = (title: string, isPinnedNotice: boolean): string => {
  return isPinnedNotice ? `[공지] ${title}` : title;
};
