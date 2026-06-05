import { expect, test } from "@playwright/test";
import { buildGoksorryIndexApiPayload } from "../lib/goksorry-index-api";
import { buildOpenApiSpec, buildOpenApiSpecForRole, buildRawTextApiDocs, filterApiDocs } from "../lib/api-docs";

test.describe("public API surface", () => {
  test("documents only the public goksorry index endpoint", () => {
    const docs = filterApiDocs(true);

    expect(docs.map((doc) => `${doc.method} ${doc.path}`)).toEqual(["GET /api/overview"]);
    expect(docs[0].responseExample).toEqual({
      goksorry_index: 4.8,
      generated_at: "2026-04-08T09:30:00.000Z",
      ttl_sec: 60
    });
  });

  test("openapi and raw text docs hide internal and token APIs", () => {
    const publicSpec = buildOpenApiSpec() as { paths: Record<string, unknown> };
    const adminSpec = buildOpenApiSpecForRole(true) as { paths: Record<string, unknown> };
    const rawText = buildRawTextApiDocs();

    expect(Object.keys(publicSpec.paths)).toEqual(["/api/overview"]);
    expect(Object.keys(adminSpec.paths)).toEqual(["/api/overview"]);
    expect(rawText).toContain("GET /api/overview");

    for (const hiddenPath of [
      "/api/community-indicators",
      "/api/analysis/latest",
      "/api/v1/health",
      "/api/v1/signals/latest",
      "/api/v1/tokens",
      "/api/admin/tokens",
      "/api/v1/detector/register"
    ]) {
      expect(rawText).not.toContain(hiddenPath);
      expect(publicSpec.paths[hiddenPath]).toBeUndefined();
      expect(adminSpec.paths[hiddenPath]).toBeUndefined();
    }
  });

  test("builds the minimal goksorry index payload", () => {
    expect(
      buildGoksorryIndexApiPayload({
        generated_at: "2026-06-05T12:00:00.000Z",
        overall_goksorry_index: 7.24
      })
    ).toEqual({
      goksorry_index: 7.2,
      generated_at: "2026-06-05T12:00:00.000Z",
      ttl_sec: 60
    });
  });
});
