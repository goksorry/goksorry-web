import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/v1/",
          "/admin/",
          "/auth/",
          "/profile",
          "/chat",
          "/openapi.json",
          "/docs.txt",
          "/community/*/new",
          "/community/*/*/edit"
        ]
      }
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL
  };
}
