import Link from "next/link";
import { formatKstDateTime } from "@/lib/date-time";

export default function LoginPage({
  searchParams
}: {
  searchParams?: { error?: string; days?: string; until?: string };
}) {
  const errorCode = typeof searchParams?.error === "string" ? searchParams.error : "";
  const holdDays = Number.parseInt(String(searchParams?.days ?? ""), 10);
  const holdUntil =
    typeof searchParams?.until === "string" && searchParams.until.trim()
      ? formatKstDateTime(searchParams.until)
      : null;
  const errorMessage =
    errorCode === "withdrawn"
      ? `탈퇴 처리된 계정입니다. 같은 이메일은 탈퇴 후 ${Number.isFinite(holdDays) ? holdDays : 7}일이 지나야 다시 가입할 수 있습니다.${
          holdUntil ? ` 다시 가입 가능한 시각: ${holdUntil}` : ""
        }`
      : errorCode === "unavailable"
        ? "로그인 확인 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요."
        : null;

  return (
    <section className="panel">
      <h1>로그인</h1>
      <p className="muted">
        우측 상단의 <strong>구글 로그인</strong> 버튼을 사용하세요. 현재 로그인은 NextAuth 기반 Google OAuth만 연결합니다.
      </p>
      {errorMessage ? <p className="error">{errorMessage}</p> : null}
      <p className="muted">
        로그인을 진행하면 <Link href="/terms">이용약관</Link> 및 <Link href="/privacy">개인정보처리방침</Link>에 따른
        서비스 이용에 동의한 것으로 봅니다.
      </p>
      <Link className="btn btn-secondary" href="/community">
        커뮤니티로 돌아가기
      </Link>
    </section>
  );
}
