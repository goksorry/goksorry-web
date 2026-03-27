"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { formatKstDateTime } from "@/lib/date-time";

type NicknameCheckStatus = "idle" | "checking" | "available" | "unavailable";

export function ProfileForm({
  email,
  initialNickname,
  canEditNickname,
  profileSetupRequired,
  nicknameAvailableAt,
  isAdmin,
  nextPath
}: {
  email: string;
  initialNickname: string;
  canEditNickname: boolean;
  profileSetupRequired: boolean;
  nicknameAvailableAt: string | null;
  isAdmin: boolean;
  nextPath: string | null;
}) {
  const router = useRouter();
  const { update } = useSession();
  const [nickname, setNickname] = useState(initialNickname);
  const [nicknameCheckStatus, setNicknameCheckStatus] = useState<NicknameCheckStatus>("idle");
  const [checkedNickname, setCheckedNickname] = useState<string | null>(null);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [privacyAgreed, setPrivacyAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const trimmedNickname = nickname.trim();
  const nicknameCheckConfirmed = nicknameCheckStatus === "available" && checkedNickname === trimmedNickname;
  const submitDisabled = profileSetupRequired
    ? loading || !trimmedNickname || !nicknameCheckConfirmed || !ageConfirmed || !termsAgreed || !privacyAgreed
    : loading || !canEditNickname;

  const handleNicknameChange = (value: string) => {
    setNickname(value);
    setError(null);
    setMessage(null);

    if (value.trim() !== checkedNickname) {
      setCheckedNickname(null);
      setNicknameCheckStatus("idle");
    }
  };

  const onCheckNickname = async () => {
    if (!trimmedNickname) {
      setError("닉네임을 입력한 뒤 중복확인을 진행해 주세요.");
      setCheckedNickname(null);
      setNicknameCheckStatus("idle");
      return;
    }

    setNicknameCheckStatus("checking");
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/profile/nickname?nickname=${encodeURIComponent(trimmedNickname)}`, {
        method: "GET",
        cache: "no-store"
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setCheckedNickname(null);
        setNicknameCheckStatus("idle");
        setError(payload.error ?? "닉네임 중복확인에 실패했습니다.");
        return;
      }

      setCheckedNickname(trimmedNickname);
      setNicknameCheckStatus(payload.available ? "available" : "unavailable");

      if (!payload.available) {
        setError("이미 사용 중인 닉네임입니다.");
        return;
      }

      setError(null);
      setMessage("사용 가능한 닉네임입니다.");
    } catch (checkError) {
      setCheckedNickname(null);
      setNicknameCheckStatus("idle");
      setError(String(checkError));
    }
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          nickname,
          age_confirmed: profileSetupRequired ? ageConfirmed : undefined,
          terms_agreed: profileSetupRequired ? termsAgreed : undefined,
          privacy_agreed: profileSetupRequired ? privacyAgreed : undefined
        })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload.error ?? "프로필 저장에 실패했습니다.");
        return;
      }

      setMessage(profileSetupRequired ? "가입 설정이 완료되었습니다." : "닉네임이 저장되었습니다.");
      await update();
      const destination = typeof nextPath === "string" && nextPath.startsWith("/") ? nextPath : "/profile";
      router.push(destination);
      router.refresh();
    } catch (submitError) {
      setError(String(submitError));
    } finally {
      setLoading(false);
    }
  };

  const onWithdraw = async () => {
    setWithdrawing(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/profile", {
        method: "DELETE"
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload.error ?? "회원 탈퇴에 실패했습니다.");
        return;
      }

      await signOut({
        callbackUrl: "/"
      });
    } catch (withdrawError) {
      setError(String(withdrawError));
    } finally {
      setWithdrawing(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="grid">
      <label className="form-row">
        <span>이메일</span>
        <input value={email} disabled />
      </label>

      <label className="form-row">
        <span>닉네임</span>
        <input
          name="nickname"
          value={nickname}
          onChange={(event) => handleNicknameChange(event.target.value)}
          maxLength={30}
          placeholder="닉네임을 입력하세요"
          required
          disabled={!canEditNickname && !profileSetupRequired}
        />
      </label>

      {profileSetupRequired ? (
        <>
          <div className="actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => void onCheckNickname()}
              disabled={nicknameCheckStatus === "checking" || !trimmedNickname}
            >
              {nicknameCheckStatus === "checking" ? "확인 중..." : "닉네임 중복확인"}
            </button>
          </div>
          <p className="muted">
            최초 가입 설정입니다. 닉네임 중복확인, 만 14세 이상 확인,{" "}
            <Link href="/terms" target="_blank" rel="noreferrer">
              이용약관
            </Link>{" "}
            및{" "}
            <Link href="/privacy" target="_blank" rel="noreferrer">
              개인정보처리방침
            </Link>{" "}
            동의를 완료해야 계속 이용할 수 있습니다.
          </p>
          <label className="form-row-checkbox">
            <input type="checkbox" checked={ageConfirmed} onChange={(event) => setAgeConfirmed(event.target.checked)} />
            <span>본인은 만 14세 이상입니다.</span>
          </label>
          <label className="form-row-checkbox">
            <input type="checkbox" checked={termsAgreed} onChange={(event) => setTermsAgreed(event.target.checked)} />
            <span>
              <Link href="/terms" target="_blank" rel="noreferrer">
                이용약관
              </Link>
              에 동의합니다.
            </span>
          </label>
          <label className="form-row-checkbox">
            <input
              type="checkbox"
              checked={privacyAgreed}
              onChange={(event) => setPrivacyAgreed(event.target.checked)}
            />
            <span>
              <Link href="/privacy" target="_blank" rel="noreferrer">
                개인정보처리방침
              </Link>
              에 동의합니다.
            </span>
          </label>
        </>
      ) : null}

      {!profileSetupRequired && !canEditNickname && nicknameAvailableAt ? (
        <p className="muted">
          닉네임은 7일에 한 번만 변경할 수 있습니다. 다음 변경 가능 시각:{" "}
          {formatKstDateTime(nicknameAvailableAt)}
        </p>
      ) : null}
      {isAdmin ? <p className="muted">관리자는 닉네임 변경 주기 제한을 받지 않습니다.</p> : null}
      {profileSetupRequired && nicknameCheckStatus === "available" ? <p className="muted">닉네임 중복확인이 완료되었습니다.</p> : null}
      {profileSetupRequired && nicknameCheckStatus === "unavailable" ? <p className="error">이미 사용 중인 닉네임입니다.</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {message ? <p className="muted">{message}</p> : null}

      <div className="actions">
        <button type="submit" disabled={submitDisabled}>
          {loading ? "저장 중..." : profileSetupRequired ? "가입 완료" : "저장"}
        </button>
      </div>

      <div className="profile-danger-zone">
        {isAdmin ? (
          <p className="muted">관리자 계정은 내 프로필 화면에서 회원탈퇴할 수 없습니다.</p>
        ) : (
          <>
            <p className="muted">
              회원 탈퇴 시 프로필, 작성한 글/댓글, 신고 및 발급한 API 토큰이 함께 삭제되며 같은 이메일은 탈퇴 후 7일이 지나야 다시 가입할 수 있습니다.
            </p>

            {!confirmWithdraw ? (
              <div className="actions">
                <button type="button" className="btn-danger" onClick={() => setConfirmWithdraw(true)} disabled={withdrawing}>
                  회원탈퇴
                </button>
              </div>
            ) : (
              <div className="grid">
                <p className="error">정말 탈퇴할까요? 이 작업은 되돌릴 수 없고, 같은 이메일로는 7일 뒤에야 다시 가입할 수 있습니다.</p>
                <div className="actions">
                  <button type="button" className="btn-danger" onClick={() => void onWithdraw()} disabled={withdrawing}>
                    {withdrawing ? "탈퇴 처리 중..." : "정말 탈퇴합니다"}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setConfirmWithdraw(false)}
                    disabled={withdrawing}
                  >
                    취소
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </form>
  );
}
