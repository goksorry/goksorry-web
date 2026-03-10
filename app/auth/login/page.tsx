import Link from "next/link";

export default function LoginPage() {
  return (
    <section className="panel">
      <h1>로그인</h1>
      <p className="muted">
        우측 상단의 <strong>구글 로그인</strong> 버튼을 사용하세요. 현재 로그인은 NextAuth 기반 Google OAuth만 연결합니다.
      </p>
      <Link className="btn btn-secondary" href="/community">
        커뮤니티로 돌아가기
      </Link>
    </section>
  );
}
