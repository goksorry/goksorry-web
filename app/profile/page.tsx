import { GoogleSignInButton } from "@/components/google-sign-in-button";
import { ProfileForm } from "@/components/profile-form";
import { ProfileTokenManager } from "@/components/profile-token-manager";
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
  const profileTitle = user.profile_setup_required ? "계정 생성" : "내 프로필";
  const profileDescription = user.profile_setup_required
    ? "닉네임 설정과 정책 동의 후 계정을 생성합니다."
    : "닉네임과 TradingBot 토큰 요청을 관리할 수 있습니다. 토큰은 관리자 승인 후 사용할 수 있습니다.";

  return (
    <section className="panel">
      <h1>{profileTitle}</h1>
      <p className="muted">{profileDescription}</p>
      {user.profile_setup_required ? <p className="muted">생성을 취소하려면 우상단 로그아웃 버튼을 누르세요.</p> : null}
      <ProfileForm
        email={user.email}
        initialNickname={user.nickname ?? ""}
        canEditNickname={nicknamePolicy.can_change}
        profileSetupRequired={user.profile_setup_required}
        nicknameAvailableAt={nicknamePolicy.available_at}
        isAdmin={user.role === "admin"}
        nextPath={nextPath}
      />
      {user.profile_setup_required ? null : <ProfileTokenManager />}
    </section>
  );
}
