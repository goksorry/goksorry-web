import Link from "next/link";

export default function LegacyAuthCallbackPage() {
  return (
    <section className="panel">
      <h1>로그인 경로가 변경되었습니다</h1>
      <p className="muted">
        현재 Google 로그인 콜백은 NextAuth가 <code>/api/auth/callback/google</code> 경로에서 처리합니다. 구글 로그인 버튼을
        다시 눌러 진행하거나, Google/Supabase 쪽에 남아 있는 예전 콜백 설정을 새 경로로 바꿔주세요.
      </p>
      <p>
        <Link href="/">홈으로 돌아가기</Link>
      </p>
    </section>
  );
}
