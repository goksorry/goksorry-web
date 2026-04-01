export type PolicyDocumentType = "terms" | "privacy";

export const POLICY_DOCUMENT_META: Record<PolicyDocumentType, { title: string; href: string }> = {
  terms: {
    title: "이용약관",
    href: "/terms"
  },
  privacy: {
    title: "개인정보처리방침",
    href: "/privacy"
  }
};
