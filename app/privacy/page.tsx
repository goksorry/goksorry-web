import type { Metadata } from "next";
import { PolicyDocumentPage } from "@/components/policy-document-page";
import { POLICY_DOCUMENT_META } from "@/lib/policy-defaults";
import { getCurrentPolicyDocument } from "@/lib/policy-documents";
import { buildPageMetadata, summarizeText } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  try {
    const document = await getCurrentPolicyDocument("privacy");

    return buildPageMetadata({
      title: document.title,
      description: summarizeText(document.summary || `${document.title} 안내 페이지입니다.`),
      path: POLICY_DOCUMENT_META.privacy.href
    });
  } catch {
    return buildPageMetadata({
      title: POLICY_DOCUMENT_META.privacy.title,
      description: "곡소리닷컴 개인정보처리방침 안내 페이지입니다.",
      path: POLICY_DOCUMENT_META.privacy.href
    });
  }
}

export default function PrivacyPage({ searchParams }: { searchParams: { version?: string | string[] } }) {
  const version = typeof searchParams.version === "string" ? searchParams.version : undefined;
  return <PolicyDocumentPage type="privacy" version={version} />;
}
