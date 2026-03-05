import Link from "next/link";

export default function LoginPage() {
  return (
    <section className="panel">
      <h1>Login</h1>
      <p className="muted">
        Use the <strong>Google Login</strong> button in the top-right header. Only Google OAuth should be enabled in
        Supabase Auth provider settings.
      </p>
      <Link className="btn btn-secondary" href="/community">
        Back to community
      </Link>
    </section>
  );
}
