export function collectionPolicyReasonText(reason: string | null): string {
  const labels: Record<string, string> = {
    operator_limited_use: "공개 제목·링크 제한 표시",
    terms_disallow: "출처 약관의 수집 제한",
    reviewed_limited_use: "공개 제목만 제한 수집",
    robots_disallow: "출처의 자동 접근 제한",
    terms_review_required: "수집·분석·표시 범위 확인 중",
    terms_unavailable: "출처 약관 확인 대기",
    terms_restriction_detected: "약관의 제한 조건 검토 중",
    terms_changed: "변경된 약관 검토 중",
    terms_scope_mismatch: "허용된 이용 범위와 현재 기능 불일치",
    terms_review_expired: "이용 범위 재확인 필요",
    robots_unavailable: "자동 접근 정책 확인 대기",
    no_policy_targets: "출처 정책 미등록",
    policy_checks_disabled: "정책 확인 중단",
    no_articles: "최근 수집된 글 없음"
  };
  return (reason ?? "").split(",").map((key) => labels[key] ?? "출처 정책 확인 중").join(" · ");
}
