import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

type RevalidateCommunityPathsOptions = {
  boardSlug: string;
  postId?: string;
  includeEditPath?: boolean;
  includeAllBoards?: boolean;
};

export const revalidateCommunityPaths = async (
  service: SupabaseClient,
  { boardSlug, postId, includeEditPath = false, includeAllBoards = false }: RevalidateCommunityPathsOptions
) => {
  revalidatePath("/community");

  if (includeAllBoards) {
    const { data: boards } = await service.from("boards").select("slug");
    for (const board of boards ?? []) {
      const slug = typeof board.slug === "string" ? board.slug.trim() : "";
      if (slug) {
        revalidatePath(`/community/${slug}`);
      }
    }
  } else if (boardSlug) {
    revalidatePath(`/community/${boardSlug}`);
  }

  if (boardSlug && postId) {
    revalidatePath(`/community/${boardSlug}/${postId}`);
    if (includeEditPath) {
      revalidatePath(`/community/${boardSlug}/${postId}/edit`);
    }
  }
};
