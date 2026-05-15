import type { MetadataRoute } from "next";
import { getCachedCommunityBoards, getCachedCommunitySitemapEntries } from "@/lib/community-read";
import { SITE_URL } from "@/lib/seo";

const STATIC_PATHS = ["/", "/community", "/goksorry-room", "/docs", "/terms", "/privacy"] as const;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [boards, posts] = await Promise.all([getCachedCommunityBoards(), getCachedCommunitySitemapEntries()]);
  const now = new Date();
  const staticEntries: MetadataRoute.Sitemap = STATIC_PATHS.map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified: now,
    changeFrequency: path === "/" ? "hourly" : "daily",
    priority: path === "/" ? 1 : 0.8
  }));

  return [
    ...staticEntries,
    ...boards.map((board) => ({
      url: `${SITE_URL}/community/${board.slug}`,
      changeFrequency: "hourly" as const,
      priority: 0.8
    })),
    ...posts.map((post) => ({
      url: `${SITE_URL}${post.href}`,
      ...(post.lastModified ? { lastModified: post.lastModified } : {}),
      changeFrequency: "hourly" as const,
      priority: 0.7
    }))
  ];
}
