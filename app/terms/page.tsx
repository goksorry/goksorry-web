import { PolicyMarkdown } from "@/components/policy-markdown";
import { formatPolicyDate } from "@/lib/policy-metadata";
import { POLICY_DOCUMENT_META } from "@/lib/policy-defaults";
import { getCurrentPolicyDocument } from "@/lib/policy-documents";

export const dynamic = "force-dynamic";

export default async function TermsPage() {
  try {
    const document = await getCurrentPolicyDocument("terms");

    return (
      <section className="panel legal-page">
        <h1>{document.title}</h1>
        <p className="muted">
          시행일: {formatPolicyDate(document.effective_at)} | 최종수정일: {formatPolicyDate(document.updated_at)}
        </p>
        <PolicyMarkdown source={document.body} />
      </section>
    );
  } catch {
    return (
      <section className="panel legal-page">
        <h1>{POLICY_DOCUMENT_META.terms.title}</h1>
        <p className="error">이용약관을 불러오는 중 오류가 발생했습니다.</p>
      </section>
    );
  }
}
