// Isolated PostgREST fixture; no production credentials or network access.
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
let activated = false;
const makeRows = () => ["terms", "privacy"].flatMap((type) => {
  const now = Date.now();
  const row = (id, days, body) => ({ id: `${type}-${id}`, type, summary: `${type} ${id} 변경 요약`, body,
    is_adverse: true, published_at: new Date(now - 9 * 864e5).toISOString(),
    effective_at: new Date(now + days * 864e5).toISOString(),
    updated_at: new Date(now - 9 * 864e5).toISOString(), created_at: new Date(now - 9 * 864e5).toISOString(), superseded_at: null });
  return [row("old", -30, "## 이전 문서\n\n이전 내용"), row("current", -10, "## 현행 문서\n\n현행 내용"),
    row("pending", activated ? -1 : 8, readFileSync(`docs/legal/${type}-2026-11-17.md`, "utf8")),
    { ...row("unpublished", -2, "비공개 초안"), published_at: new Date(now + 864e5).toISOString() }];
});
createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1:3103");
  const send = (data) => { res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify(data)); };
  if (url.pathname === "/_control") {
    if (req.method === "POST") activated = url.searchParams.get("activated") === "true";
    return send({ activated });
  }
  if (!url.pathname.endsWith("/policy_document_versions")) return send([]);
  let rows = makeRows();
  for (const [key, value] of url.searchParams) {
    const dot = value.indexOf("."), op = value.slice(0, dot), target = value.slice(dot + 1);
    if (["type", "published_at", "effective_at", "superseded_at"].includes(key)) {
      rows = rows.filter((row) => op === "eq" ? row[key] === target : op === "is" ? row[key] === null : op === "lte" ? row[key] <= target : op === "gt" ? row[key] > target : true);
    }
  }
  const order = (url.searchParams.get("order") || "").split(",");
  rows.sort((a, b) => { for (const item of order) { const [key, dir] = item.split("."); const diff = String(a[key]).localeCompare(String(b[key])); if (diff) return dir === "desc" ? -diff : diff; } return 0; });
  rows = rows.slice(0, Number(url.searchParams.get("limit") || 50));
  send(req.headers.accept?.includes("vnd.pgrst.object") ? rows[0] ?? null : rows);
}).listen(3103, "127.0.0.1");
