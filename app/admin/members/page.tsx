"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatKstDateTime } from "@/lib/date-time";

type MemberTokenRow = {
  id: string;
  name: string;
  token_prefix: string | null;
  scope: string;
  approval_status: "pending" | "approved" | "rejected";
  approval_requested_at: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  approval_note: string | null;
  created_at: string | null;
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  token_claimed: boolean;
  claim_ready: boolean;
};

type MemberRow = {
  id: string;
  email: string;
  nickname: string;
  role: "admin" | "user";
  created_at: string | null;
  nickname_confirmed_at: string | null;
  nickname_changed_at: string | null;
  is_current_user: boolean;
  active_token_count: number;
  total_token_count: number;
  tokens: MemberTokenRow[];
};

const formatDateTime = (iso: string | null): string => {
  if (!iso) {
    return "-";
  }
  return formatKstDateTime(iso);
};

const parsePayload = (rawText: string): Record<string, unknown> => {
  if (!rawText) {
    return {};
  }

  try {
    return JSON.parse(rawText) as Record<string, unknown>;
  } catch {
    return {};
  }
};

const tokenStatusLabel = (token: MemberTokenRow): string => {
  if (token.revoked_at) {
    return "폐기됨";
  }
  if (token.approval_status === "pending") {
    return "승인 대기";
  }
  if (token.approval_status === "rejected") {
    return "반려";
  }
  if (token.claim_ready) {
    return "승인 완료 · 발급 대기";
  }
  return "사용 가능";
};

export default function AdminMembersPage() {
  const [loading, setLoading] = useState(true);
  const [actingKey, setActingKey] = useState<string | null>(null);
  const [confirmWithdrawId, setConfirmWithdrawId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [draftNicknames, setDraftNicknames] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/members", {
        cache: "no-store"
      });
      const rawText = await response.text();
      const payload = parsePayload(rawText);
      if (!response.ok) {
        setMembers([]);
        setDraftNicknames({});
        setError(String(payload.error ?? payload.message ?? rawText ?? "회원 목록을 불러오지 못했습니다."));
        return;
      }

      const nextMembers = Array.isArray(payload.members) ? (payload.members as MemberRow[]) : [];
      setMembers(nextMembers);
      setDraftNicknames(
        nextMembers.reduce<Record<string, string>>((acc, member) => {
          acc[member.id] = member.nickname;
          return acc;
        }, {})
      );
    } catch (loadError) {
      setMembers([]);
      setDraftNicknames({});
      setError(String(loadError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filteredMembers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return members;
    }

    return members.filter((member) => {
      return member.email.toLowerCase().includes(normalized) || member.nickname.toLowerCase().includes(normalized);
    });
  }, [members, query]);

  const onChangeNickname = async (member: MemberRow) => {
    const nickname = String(draftNicknames[member.id] ?? "").trim();
    if (!nickname) {
      setError("닉네임을 입력하세요.");
      return;
    }

    setActingKey(`nickname:${member.id}`);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/members/${member.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          nickname
        })
      });
      const rawText = await response.text();
      const payload = parsePayload(rawText);
      if (!response.ok) {
        setError(String(payload.error ?? payload.message ?? rawText ?? "닉네임 변경에 실패했습니다."));
        return;
      }

      setMessage(`${member.email}의 닉네임을 변경했습니다.`);
      await load();
    } catch (updateError) {
      setError(String(updateError));
    } finally {
      setActingKey(null);
    }
  };

  const onWithdrawMember = async (member: MemberRow) => {
    setActingKey(`withdraw:${member.id}`);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/members/${member.id}`, {
        method: "DELETE"
      });
      const rawText = await response.text();
      const payload = parsePayload(rawText);
      if (!response.ok) {
        setError(String(payload.error ?? payload.message ?? rawText ?? "회원 탈퇴 처리에 실패했습니다."));
        return;
      }

      setMessage(`${member.email} 계정을 탈퇴 처리했습니다.`);
      setConfirmWithdrawId(null);
      await load();
    } catch (withdrawError) {
      setError(String(withdrawError));
    } finally {
      setActingKey(null);
    }
  };

  const onDeleteToken = async (member: MemberRow, token: MemberTokenRow) => {
    setActingKey(`token:${token.id}`);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/tokens/${token.id}`, {
        method: "DELETE"
      });
      const rawText = await response.text();
      const payload = parsePayload(rawText);
      if (!response.ok) {
        setError(String(payload.error ?? payload.message ?? rawText ?? "토큰 삭제에 실패했습니다."));
        return;
      }

      setMessage(`${member.email}의 토큰을 삭제했습니다.`);
      await load();
    } catch (deleteError) {
      setError(String(deleteError));
    } finally {
      setActingKey(null);
    }
  };

  return (
    <section className="panel">
      <h1>회원 관리</h1>
      <p className="muted">이메일, 닉네임, 토큰만 관리합니다. 관리자 계정은 조회만 가능하고 강제 변경/탈퇴/토큰삭제는 막습니다.</p>

      <div className="actions">
        <Link href="/admin/tokens" className="btn btn-secondary">
          토큰 승인으로 이동
        </Link>
      </div>

      <label className="form-row">
        <span>검색</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="이메일 또는 닉네임"
          disabled={loading}
        />
      </label>

      {loading ? <p className="muted">불러오는 중...</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {message ? <p className="success">{message}</p> : null}

      {!loading && !error ? (
        <div className="admin-member-list">
          {filteredMembers.length === 0 ? (
            <div className="card">
              <p className="muted">조건에 맞는 회원이 없습니다.</p>
            </div>
          ) : null}

          {filteredMembers.map((member) => {
            const draftNickname = draftNicknames[member.id] ?? member.nickname;
            const nicknameDirty = draftNickname.trim() !== member.nickname;
            const withdrawPending = actingKey === `withdraw:${member.id}`;

            return (
              <article key={member.id} className="card admin-member-card">
                <div className="admin-member-head">
                  <div className="admin-member-copy">
                    <h2>{member.nickname}</h2>
                    <p className="muted">{member.email}</p>
                  </div>
                  <div className="actions">
                    <span className="tag">{member.role === "admin" ? "관리자" : "회원"}</span>
                    {member.is_current_user ? <span className="tag">현재 로그인</span> : null}
                    <span className="tag">활성 토큰 {member.active_token_count}</span>
                    <span className="tag">전체 토큰 {member.total_token_count}</span>
                  </div>
                </div>

                <div className="admin-member-meta">
                  <p>
                    <strong>가입</strong> {formatDateTime(member.created_at)}
                  </p>
                  <p>
                    <strong>닉네임 확정</strong> {formatDateTime(member.nickname_confirmed_at)}
                  </p>
                  <p>
                    <strong>최근 닉변</strong> {formatDateTime(member.nickname_changed_at)}
                  </p>
                </div>

                {member.role === "admin" ? (
                  <p className="muted">관리자 계정은 조회만 가능합니다.</p>
                ) : (
                  <>
                    <div className="admin-member-edit-grid">
                      <label className="form-row">
                        <span>강제 닉네임 변경</span>
                        <input
                          value={draftNickname}
                          onChange={(event) =>
                            setDraftNicknames((current) => ({
                              ...current,
                              [member.id]: event.target.value
                            }))
                          }
                          maxLength={30}
                          disabled={Boolean(actingKey)}
                        />
                      </label>

                      <div className="actions admin-member-actions">
                        <button
                          type="button"
                          onClick={() => void onChangeNickname(member)}
                          disabled={Boolean(actingKey) || !nicknameDirty || !draftNickname.trim()}
                        >
                          {actingKey === `nickname:${member.id}` ? "저장 중..." : "닉네임 저장"}
                        </button>

                        {confirmWithdrawId === member.id ? (
                          <>
                            <button
                              type="button"
                              className="btn-danger"
                              onClick={() => void onWithdrawMember(member)}
                              disabled={Boolean(actingKey)}
                            >
                              {withdrawPending ? "탈퇴 처리 중..." : "정말 탈퇴 처리"}
                            </button>
                            <button
                              type="button"
                              className="btn-secondary"
                              onClick={() => setConfirmWithdrawId(null)}
                              disabled={Boolean(actingKey)}
                            >
                              취소
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="btn-danger"
                            onClick={() => setConfirmWithdrawId(member.id)}
                            disabled={Boolean(actingKey)}
                          >
                            회원탈퇴 처리
                          </button>
                        )}
                      </div>
                    </div>

                    {confirmWithdrawId === member.id ? (
                      <p className="error">
                        이 회원의 프로필, 글/댓글, 신고, 표, API 토큰이 함께 삭제되고 같은 이메일은 7일 동안 재가입할 수 없습니다.
                      </p>
                    ) : null}
                  </>
                )}

                <div className="admin-member-token-section">
                  <h3>토큰 관리</h3>

                  {member.tokens.length === 0 ? (
                    <p className="muted">보유 토큰이 없습니다.</p>
                  ) : (
                    <div className="table-wrap">
                      <table className="table">
                        <thead>
                          <tr>
                            <th>이름</th>
                            <th>상태</th>
                            <th>Prefix</th>
                            <th>요청/처리</th>
                            <th>마지막 사용</th>
                            <th>만료</th>
                            <th>동작</th>
                          </tr>
                        </thead>
                        <tbody>
                          {member.tokens.map((token) => (
                            <tr key={token.id}>
                              <td>
                                {token.name}
                                {token.approval_note ? <p className="muted">{token.approval_note}</p> : null}
                              </td>
                              <td>{tokenStatusLabel(token)}</td>
                              <td>{token.token_prefix ?? "-"}</td>
                              <td>
                                요청: {formatDateTime(token.approval_requested_at)}
                                <br />
                                처리: {formatDateTime(token.approved_at ?? token.rejected_at)}
                              </td>
                              <td>{formatDateTime(token.last_used_at)}</td>
                              <td>{formatDateTime(token.expires_at)}</td>
                              <td>
                                {member.role === "admin" ? (
                                  <span className="muted">관리자 보호</span>
                                ) : (
                                  <button
                                    type="button"
                                    className="btn-secondary"
                                    onClick={() => void onDeleteToken(member, token)}
                                    disabled={Boolean(actingKey)}
                                  >
                                    {actingKey === `token:${token.id}` ? "삭제 중..." : "강제 삭제"}
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
