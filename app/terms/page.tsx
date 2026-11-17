import type { Metadata } from "next";
import { PolicyDocumentPage } from "@/components/policy-document-page";
import { POLICY_DOCUMENT_META } from "@/lib/policy-defaults";
import { getCurrentPolicyDocument } from "@/lib/policy-documents";
import { buildPageMetadata, summarizeText } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  try {
    const document = await getCurrentPolicyDocument("terms");

    return buildPageMetadata({
      title: document.title,
      description: summarizeText(document.summary || `${document.title} 안내 페이지입니다.`),
      path: POLICY_DOCUMENT_META.terms.href
    });
  } catch {
    return buildPageMetadata({
      title: POLICY_DOCUMENT_META.terms.title,
      description: "곡소리닷컴 이용약관 안내 페이지입니다.",
      path: POLICY_DOCUMENT_META.terms.href
    });
  }
}

export default function TermsPage({ searchParams }: { searchParams: { version?: string | string[] } }) {
  const version = typeof searchParams.version === "string" ? searchParams.version : undefined;
  return <PolicyDocumentPage type="terms" version={version} />;
}
