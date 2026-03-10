"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { formatKstDateTime } from "@/lib/date-time";

export function ProfileForm({
  email,
  initialNickname,
  canEditNickname,
  nicknameNeedsSetup,
  nicknameAvailableAt,
  isAdmin,
  nextPath
}: {
  email: string;
  initialNickname: string;
  canEditNickname: boolean;
  nicknameNeedsSetup: boolean;
  nicknameAvailableAt: string | null;
  isAdmin: boolean;
  nextPath: string | null;
}) {
  const router = useRouter();
  const { update } = useSession();
  const [nickname, setNickname] = useState(initialNickname);
  const [loading, setLoading] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

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
          nickname
        })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload.error ?? "프로필 저장에 실패했습니다.");
        return;
      }

      setMessage("닉네임이 저장되었습니다.");
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
          onChange={(event) => setNickname(event.target.value)}
          maxLength={30}
          placeholder="닉네임을 입력하세요"
          required
          disabled={!canEditNickname && !nicknameNeedsSetup}
        />
      </label>

      {nicknameNeedsSetup ? <p className="muted">최초 로그인 설정입니다. 닉네임을 확정해야 계속 이용할 수 있습니다.</p> : null}
      {!nicknameNeedsSetup && !canEditNickname && nicknameAvailableAt ? (
        <p className="muted">
          닉네임은 7일에 한 번만 변경할 수 있습니다. 다음 변경 가능 시각:{" "}
          {formatKstDateTime(nicknameAvailableAt)}
        </p>
      ) : null}
      {isAdmin ? <p className="muted">관리자는 닉네임 변경 주기 제한을 받지 않습니다.</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {message ? <p className="muted">{message}</p> : null}

      <div className="actions">
        <button type="submit" disabled={loading || (!canEditNickname && !nicknameNeedsSetup)}>
          {loading ? "저장 중..." : "저장"}
        </button>
      </div>

      <div className="profile-danger-zone">
        <p className="muted">
          회원 탈퇴 시 프로필, 작성한 글/댓글, 신고 및 발급한 API 토큰이 함께 삭제되며 같은 이메일로는 다시 가입할 수 없습니다.
        </p>

        {!confirmWithdraw ? (
          <div className="actions">
            <button type="button" className="btn-danger" onClick={() => setConfirmWithdraw(true)} disabled={withdrawing}>
              회원탈퇴
            </button>
          </div>
        ) : (
          <div className="grid">
            <p className="error">정말 탈퇴할까요? 이 작업은 되돌릴 수 없습니다.</p>
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
      </div>
    </form>
  );
}
