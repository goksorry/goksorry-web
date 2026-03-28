import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath, revalidateTag } from "next/cache";

type RevalidateCommunityPathsOptions = {
  boardSlug: string;
  postId?: string;
  includeEditPath?: boolean;
  includeAllBoards?: boolean;
};

export const COMMUNITY_CACHE_TAGS = {
  boards: "community:boards",
  home: "community:home",
  recent: "community:recent",
  board: (boardSlug: string) => `community:board:${boardSlug}`,
  post: (postId: string) => `community:post:${postId}`
} as const;

export const revalidateCommunityPaths = async (
  service: SupabaseClient,
  { boardSlug, postId, includeEditPath = false, includeAllBoards = false }: RevalidateCommunityPathsOptions
) => {
  revalidatePath("/community");
  revalidateTag(COMMUNITY_CACHE_TAGS.home);
  revalidateTag(COMMUNITY_CACHE_TAGS.recent);
  revalidateTag(COMMUNITY_CACHE_TAGS.boards);

  if (includeAllBoards) {
    const { data: boards } = await service.from("boards").select("slug");
    for (const board of boards ?? []) {
      const slug = typeof board.slug === "string" ? board.slug.trim() : "";
      if (slug) {
        revalidatePath(`/community/${slug}`);
        revalidateTag(COMMUNITY_CACHE_TAGS.board(slug));
      }
    }
  } else if (boardSlug) {
    revalidatePath(`/community/${boardSlug}`);
    revalidateTag(COMMUNITY_CACHE_TAGS.board(boardSlug));
  }

  if (boardSlug && postId) {
    revalidatePath(`/community/${boardSlug}/${postId}`);
    revalidateTag(COMMUNITY_CACHE_TAGS.post(postId));
    if (includeEditPath) {
      revalidatePath(`/community/${boardSlug}/${postId}/edit`);
    }
  }
};
