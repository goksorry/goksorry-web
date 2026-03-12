import { buildRawTextApiDocs } from "@/lib/api-docs";

export function GET() {
  return new Response(buildRawTextApiDocs(), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "private, no-store"
    }
  });
}
