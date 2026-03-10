import Link from "next/link";
import { GoogleSignInButton } from "@/components/google-sign-in-button";
import { ProfileForm } from "@/components/profile-form";
import { getUserFromAuthorization } from "@/lib/auth-server";
import { getNicknamePolicy } from "@/lib/profile-sync";

export const dynamic = "force-dynamic";

export default async function ProfilePage({
  searchParams
}: {
  searchParams?: { next?: string };
}) {
  const user = await getUserFromAuthorization();
  const nextPath = typeof searchParams?.next === "string" && searchParams.next.startsWith("/") ? searchParams.next : null;
  const profileCallbackUrl = nextPath ? `/profile?next=${encodeURIComponent(nextPath)}` : "/profile";

  if (!user || !user.email) {
    return (
      <section className="panel">
        <h1>내 프로필</h1>
        <p className="muted">프로필을 관리하려면 먼저 로그인해야 합니다.</p>
        <GoogleSignInButton callbackUrl={profileCallbackUrl} />
      </section>
    );
  }

  const nicknamePolicy = getNicknamePolicy(user);

  return (
    <section className="panel">
      <h1>내 프로필</h1>
      <p className="muted">현재는 닉네임만 관리할 수 있습니다. 닉네임은 다른 회원과 중복될 수 없습니다.</p>
      <ProfileForm
        email={user.email}
        initialNickname={user.nickname ?? ""}
        canEditNickname={nicknamePolicy.can_change}
        nicknameNeedsSetup={nicknamePolicy.needs_setup}
        nicknameAvailableAt={nicknamePolicy.available_at}
        isAdmin={user.role === "admin"}
        nextPath={nextPath}
      />
      <p>
        <Link href={nextPath ?? "/community"}>돌아가기</Link>
      </p>
    </section>
  );
}
