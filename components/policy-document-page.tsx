import Link from "next/link";
import { notFound } from "next/navigation";
import { PolicyMarkdown } from "@/components/policy-markdown";
import { POLICY_DOCUMENT_META, type PolicyDocumentType } from "@/lib/policy-defaults";
import { getCurrentPolicyDocument, listPolicyDocumentVersions } from "@/lib/policy-documents";
import { formatPolicyDate } from "@/lib/policy-metadata";
import { formatKstDateTime } from "@/lib/date-time";

export async function PolicyDocumentPage({ type, version }: { type: PolicyDocumentType; version?: string }) {
  const meta = POLICY_DOCUMENT_META[type];
  const result = await Promise.all([getCurrentPolicyDocument(type), listPolicyDocumentVersions(type)]).catch(() => null);
  if (!result) {
    return <section className="panel legal-page"><h1>{meta.title}</h1><p className="error">문서를 불러오는 중 오류가 발생했습니다.</p></section>;
  }

  const [current, history] = result;
  const document = version ? history.find((item) => item.id === version) : current;
  if (!document) notFound();
  const now = Date.now();
  const pending = history.filter((item) => !item.superseded_at && Date.parse(item.effective_at) > now);
  const status = (item: typeof document) => item.superseded_at ? "철회된 버전" : item.id === current.id ? "현재 적용 중" : Date.parse(item.effective_at) > now ? "시행 예정" : "이전 버전";

  return (
    <section className="panel legal-page">
      <h1>{document.title}</h1>
      <p><strong>{status(document)}</strong></p>
      <p className="muted">공고일: {formatPolicyDate(document.published_at)} | 시행일: {formatKstDateTime(document.effective_at)} (한국 시간)</p>
      <p className="muted">최종수정일: {formatPolicyDate(document.updated_at)}</p>
      <p>변경 요약: {document.summary}</p>
      {document.id !== current.id && <p>현재 적용되는 문서는 <Link href={meta.href}>현행 {meta.title}</Link>에서 확인할 수 있습니다. 시행 예정 문서는 표시된 시행시각부터 적용됩니다.</p>}
      {pending.length > 0 && (
        <aside aria-label="개정 사전 안내">
          <p>개정 예정 문서가 있습니다. 시행 전까지 기존 문서를 적용합니다.</p>
          <ul>{pending.map((item) => <li key={item.id}><Link href={`${meta.href}?version=${item.id}`}>{formatPolicyDate(item.effective_at)} 시행 예정 전문</Link> — {item.summary}</li>)}</ul>
        </aside>
      )}
      <PolicyMarkdown source={document.body} />
      <details className="legal-history">
        <summary>변경 이력 · 이전 문서</summary>
        <ul>{history.map((item) => <li key={item.id}><Link href={`${meta.href}?version=${item.id}`}>{formatPolicyDate(item.effective_at)} · {status(item)}</Link> — {item.summary}</li>)}</ul>
      </details>
    </section>
  );
}
