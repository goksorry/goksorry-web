import { getAdsenseAdsTxt } from "@/lib/adsense";

export function GET() {
  const adsTxt = getAdsenseAdsTxt();
  if (!adsTxt) {
    return new Response("Not Found", {
      status: 404,
      headers: {
        "content-type": "text/plain; charset=utf-8"
      }
    });
  }

  return new Response(`${adsTxt}\n`, {
    headers: {
      "cache-control": "public, max-age=300, s-maxage=300",
      "content-type": "text/plain; charset=utf-8"
    }
  });
}
