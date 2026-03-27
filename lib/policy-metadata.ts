export const POLICY_SUPPORT_EMAIL = "admin@goksorry.com";

export const TERMS_POLICY_METADATA = {
  effectiveDate: "2026-03-27",
  updatedDate: "2026-03-28"
} as const;

export const PRIVACY_POLICY_METADATA = {
  effectiveDate: "2026-03-27",
  updatedDate: "2026-03-28"
} as const;

export const formatPolicyDate = (value: string): string => {
  const date = new Date(`${value}T00:00:00+09:00`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
};
