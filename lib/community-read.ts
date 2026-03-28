import "server-only";

import { unstable_cache } from "next/cache";
import { fetchCommentCountsByPostId, formatPinnedNoticeTitle } from "@/lib/community-posts";
import { getServiceSupabaseClient } from "@/lib/supabase/service";
import { COMMUNITY_CACHE_TAGS } from "@/lib/community-cache";

const COMMUNITY_REVALIDATE_SEC = 30;
const COMMUNITY_BOARDS_REVALIDATE_SEC = 300;

export type CommunityBoardSummary = {
  id: string;
  slug: string;
  name: string;
};

export type CommunityPostListItem = {
  id: string;
  href: string;
  title: string;
  createdAt: string | null;
  authorNickname: string | null;
  commentCount: number;
  boardLabel?: string | null;
};

export type CommunityHomeData = {
  boards: CommunityBoardSummary[];
  boardsError: string | null;
  recentPosts: CommunityPostListItem[];
  postsError: string | null;
};

export type CommunityBoardPageData = {
  board: {
    id: string;
    slug: string;
    name: string;
    description: string | null;
  } | null;
  posts: CommunityPostListItem[];
  postsError: string | null;
};

export type CommunityPostDetailData = {
  post: {
    id: string;
    title: string;
    content: string;
    created_at: string;
    is_pinned_notice: boolean;
    author_id: string;
    author_nickname: string | null;
    board: {
      id: string;
      slug: string;
      name: string;
    };
  } | null;
  comments: Array<{
    id: string;
    content: string;
    created_at: string;
    author_nickname: string | null;
  }>;
  commentsError: string | null;
};

const mapAuthorNickname = (value: any): string | null => {
  const author = Array.isArray(value) ? value[0] : value;
  return typeof author?.nickname === "string" ? author.nickname : null;
};

export const getCachedCommunityHomeData = unstable_cache(
  async (): Promise<CommunityHomeData> => {
    const service = getServiceSupabaseClient();
    const [{ data: boards, error: boardsError }, { data: recentPosts, error: postsError }] = await Promise.all([
      service.from("boards").select("id,slug,name,sort_order").order("sort_order", { ascending: true }),
      service
        .from("community_posts")
        .select("id,title,created_at,board_id,author_id,is_pinned_notice,boards(slug,name),profiles(nickname)")
        .eq("is_deleted", false)
        .order("created_at", { ascending: false })
        .limit(30)
    ]);

    const commentCounts = await fetchCommentCountsByPostId(
      service,
      (recentPosts ?? []).map((post: any) => String(post.id))
    );

    return {
      boards: (boards ?? []).map((board: any) => ({
        id: String(board.id),
        slug: String(board.slug),
        name: String(board.name)
      })),
      boardsError: boardsError?.message ?? null,
      recentPosts: (recentPosts ?? [])
        .map((post: any) => {
          const board = Array.isArray(post.boards) ? post.boards[0] : post.boards;
          if (!board?.slug) {
            return null;
          }

          return {
            id: String(post.id),
            href: `/community/${board.slug}/${post.id}`,
            title: formatPinnedNoticeTitle(String(post.title ?? ""), Boolean(post.is_pinned_notice)),
            createdAt: post.created_at ? String(post.created_at) : null,
            authorNickname: mapAuthorNickname(post.profiles),
            commentCount: commentCounts.get(String(post.id)) ?? 0,
            boardLabel: board.name ? String(board.name) : String(board.slug)
          };
        })
        .filter(Boolean) as CommunityPostListItem[],
      postsError: postsError?.message ?? null
    };
  },
  ["community-home-data"],
  {
    revalidate: COMMUNITY_REVALIDATE_SEC,
    tags: [COMMUNITY_CACHE_TAGS.home, COMMUNITY_CACHE_TAGS.boards, COMMUNITY_CACHE_TAGS.recent]
  }
);

export const getCachedCommunityBoardPageData = async (
  boardSlug: string
): Promise<CommunityBoardPageData> =>
  unstable_cache(
    async (): Promise<CommunityBoardPageData> => {
      const service = getServiceSupabaseClient();
      const { data: board, error: boardError } = await service
        .from("boards")
        .select("id,slug,name,description")
        .eq("slug", boardSlug)
        .maybeSingle();

      if (boardError || !board) {
        return {
          board: null,
          posts: [],
          postsError: boardError?.message ?? null
        };
      }

      const [postsResult, pinnedNoticesResult] = await Promise.all([
        service
          .from("community_posts")
          .select("id,title,created_at,author_id,is_pinned_notice,profiles(nickname)")
          .eq("board_id", board.id)
          .eq("is_deleted", false)
          .order(board.slug === "notice" ? "is_pinned_notice" : "created_at", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(200),
        board.slug === "notice"
          ? Promise.resolve({ data: [], error: null })
          : service
              .from("community_posts")
              .select("id,title,created_at,author_id,is_pinned_notice,profiles(nickname),boards!inner(slug)")
              .eq("boards.slug", "notice")
              .eq("is_deleted", false)
              .eq("is_pinned_notice", true)
              .order("created_at", { ascending: false })
              .limit(20)
      ]);

      const posts = postsResult.data ?? [];
      const pinnedNoticeRows = board.slug === "notice" ? [] : pinnedNoticesResult.data ?? [];
      const mergedPosts = [...pinnedNoticeRows, ...posts];
      const commentCounts = await fetchCommentCountsByPostId(
        service,
        mergedPosts.map((post: any) => String(post.id))
      );

      return {
        board: {
          id: String(board.id),
          slug: String(board.slug),
          name: String(board.name),
          description: typeof board.description === "string" ? board.description : null
        },
        posts: mergedPosts.map((post: any) => {
          const isPinnedNotice = Boolean(post.is_pinned_notice);
          const hrefBoardSlug = isPinnedNotice && board.slug !== "notice" ? "notice" : board.slug;

          return {
            id: String(post.id),
            href: `/community/${hrefBoardSlug}/${post.id}`,
            title: formatPinnedNoticeTitle(String(post.title ?? ""), isPinnedNotice),
            createdAt: post.created_at ? String(post.created_at) : null,
            authorNickname: mapAuthorNickname(post.profiles),
            commentCount: commentCounts.get(String(post.id)) ?? 0
          };
        }),
        postsError: postsResult.error?.message ?? null
      };
    },
    [`community-board-page:${boardSlug}`],
    {
      revalidate: COMMUNITY_REVALIDATE_SEC,
      tags: [COMMUNITY_CACHE_TAGS.board(boardSlug)]
    }
  )();

export const getCachedCommunityPostDetailData = async (
  boardSlug: string,
  postId: string
): Promise<CommunityPostDetailData> =>
  unstable_cache(
    async (): Promise<CommunityPostDetailData> => {
      const service = getServiceSupabaseClient();
      const [postResult, commentsResult] = await Promise.all([
        service
          .from("community_posts")
          .select("id,title,content,created_at,is_deleted,is_pinned_notice,author_id,profiles(nickname),boards!inner(id,slug,name)")
          .eq("id", postId)
          .eq("boards.slug", boardSlug)
          .maybeSingle(),
        service
          .from("community_comments")
          .select("id,content,created_at,author_id,is_deleted,profiles(nickname)")
          .eq("post_id", postId)
          .eq("is_deleted", false)
          .order("created_at", { ascending: true })
      ]);

      const post = postResult.data;
      if (postResult.error || !post || post.is_deleted) {
        return {
          post: null,
          comments: [],
          commentsError: commentsResult.error?.message ?? null
        };
      }

      const board = Array.isArray(post.boards) ? post.boards[0] : post.boards;
      if (!board) {
        return {
          post: null,
          comments: [],
          commentsError: commentsResult.error?.message ?? null
        };
      }

      return {
        post: {
          id: String(post.id),
          title: String(post.title),
          content: String(post.content),
          created_at: String(post.created_at),
          is_pinned_notice: Boolean(post.is_pinned_notice),
          author_id: String(post.author_id),
          author_nickname: mapAuthorNickname(post.profiles),
          board: {
            id: String(board.id),
            slug: String(board.slug),
            name: String(board.name)
          }
        },
        comments: (commentsResult.data ?? []).map((comment: any) => ({
          id: String(comment.id),
          content: String(comment.content),
          created_at: String(comment.created_at),
          author_nickname: mapAuthorNickname(comment.profiles)
        })),
        commentsError: commentsResult.error?.message ?? null
      };
    },
    [`community-post-detail:${boardSlug}:${postId}`],
    {
      revalidate: COMMUNITY_REVALIDATE_SEC,
      tags: [COMMUNITY_CACHE_TAGS.board(boardSlug), COMMUNITY_CACHE_TAGS.post(postId)]
    }
  )();

export const getCachedCommunityBoards = unstable_cache(
  async (): Promise<CommunityBoardSummary[]> => {
    const service = getServiceSupabaseClient();
    const { data } = await service.from("boards").select("id,slug,name,sort_order").order("sort_order", { ascending: true });

    return (data ?? []).map((board: any) => ({
      id: String(board.id),
      slug: String(board.slug),
      name: String(board.name)
    }));
  },
  ["community-boards"],
  {
    revalidate: COMMUNITY_BOARDS_REVALIDATE_SEC,
    tags: [COMMUNITY_CACHE_TAGS.boards]
  }
);
