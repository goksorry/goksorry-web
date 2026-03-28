import { PolicyMarkdown } from "@/components/policy-markdown";
import { formatPolicyDate } from "@/lib/policy-metadata";
import { getCurrentPolicyDocument } from "@/lib/policy-documents";

export const dynamic = "force-dynamic";

export default async function TermsPage() {
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
}
