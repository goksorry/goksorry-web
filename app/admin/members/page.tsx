"use client";

import Link from "next/link";
import { startTransition, useDeferredValue, useEffect, useMemo, useState } from "react";
import { formatKstDateTime } from "@/lib/date-time";

type MemberListRow = {
  id: string;
  email: string;
  nickname: string;
  role: "admin" | "user";
  created_at: string | null;
  is_current_user: boolean;
};

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

type MemberDetail = MemberListRow & {
  nickname_confirmed_at: string | null;
  nickname_changed_at: string | null;
  active_token_count: number;
  total_token_count: number;
  tokens: MemberTokenRow[];
};

type PaginationPayload = {
  page: number;
  page_size: number;
  total_count: number;
  total_pages: number;
  has_prev: boolean;
  has_next: boolean;
};

const DEFAULT_PAGINATION: PaginationPayload = {
  page: 1,
  page_size: 20,
  total_count: 0,
  total_pages: 1,
  has_prev: false,
  has_next: false
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

const fetchMemberList = async ({ page, query }: { page: number; query: string }) => {
  const params = new URLSearchParams();
  params.set("page", String(page));
  if (query.trim()) {
    params.set("q", query.trim());
  }

  const response = await fetch(`/api/admin/members?${params.toString()}`, {
    cache: "no-store"
  });
  const rawText = await response.text();
  const payload = parsePayload(rawText);

  if (!response.ok) {
    throw new Error(String(payload.error ?? payload.message ?? rawText ?? "회원 목록을 불러오지 못했습니다."));
  }

  return {
    members: Array.isArray(payload.members) ? (payload.members as MemberListRow[]) : [],
    pagination: (payload.pagination ?? DEFAULT_PAGINATION) as PaginationPayload
  };
};

const fetchMemberDetail = async (memberId: string): Promise<MemberDetail> => {
  const response = await fetch(`/api/admin/members/${memberId}`, {
    cache: "no-store"
  });
  const rawText = await response.text();
  const payload = parsePayload(rawText);

  if (!response.ok) {
    throw new Error(String(payload.error ?? payload.message ?? rawText ?? "회원 상세를 불러오지 못했습니다."));
  }

  return payload.member as MemberDetail;
};

export default function AdminMembersPage() {
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actingKey, setActingKey] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [members, setMembers] = useState<MemberListRow[]>([]);
  const [pagination, setPagination] = useState<PaginationPayload>(DEFAULT_PAGINATION);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [selectedMemberSummary, setSelectedMemberSummary] = useState<MemberListRow | null>(null);
  const [selectedMemberDetail, setSelectedMemberDetail] = useState<MemberDetail | null>(null);
  const [draftNickname, setDraftNickname] = useState("");
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const payload = await fetchMemberList({
          page,
          query: deferredQuery
        });
        if (!active) {
          return;
        }

        setMembers(payload.members);
        setPagination(payload.pagination);
        if (payload.pagination.page !== page) {
          setPage(payload.pagination.page);
        }
      } catch (loadError) {
        if (!active) {
          return;
        }
        setMembers([]);
        setPagination(DEFAULT_PAGINATION);
        setError(String(loadError));
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [page, deferredQuery]);

  useEffect(() => {
    if (!selectedMemberId) {
      return;
    }

    let active = true;

    const loadDetail = async () => {
      setDetailLoading(true);
      setDetailError(null);

      try {
        const detail = await fetchMemberDetail(selectedMemberId);
        if (!active) {
          return;
        }

        setSelectedMemberDetail(detail);
        setSelectedMemberSummary({
          id: detail.id,
          email: detail.email,
          nickname: detail.nickname,
          role: detail.role,
          created_at: detail.created_at,
          is_current_user: detail.is_current_user
        });
        setDraftNickname(detail.nickname);
      } catch (loadError) {
        if (!active) {
          return;
        }
        setSelectedMemberDetail(null);
        setDetailError(String(loadError));
      } finally {
        if (active) {
          setDetailLoading(false);
        }
      }
    };

    void loadDetail();

    return () => {
      active = false;
    };
  }, [selectedMemberId]);

  useEffect(() => {
    if (!selectedMemberId) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedMemberId(null);
        setSelectedMemberSummary(null);
        setSelectedMemberDetail(null);
        setDetailError(null);
        setConfirmWithdraw(false);
      }
    };

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [selectedMemberId]);

  const openMemberModal = (member: MemberListRow) => {
    setSelectedMemberId(member.id);
    setSelectedMemberSummary(member);
    setSelectedMemberDetail(null);
    setDraftNickname(member.nickname);
    setDetailError(null);
    setConfirmWithdraw(false);
  };

  const closeMemberModal = () => {
    setSelectedMemberId(null);
    setSelectedMemberSummary(null);
    setSelectedMemberDetail(null);
    setDraftNickname("");
    setDetailError(null);
    setConfirmWithdraw(false);
  };

  const refreshListAndDetail = async (memberId?: string) => {
    const listPayload = await fetchMemberList({
      page,
      query: deferredQuery
    });
    setMembers(listPayload.members);
    setPagination(listPayload.pagination);
    if (listPayload.pagination.page !== page) {
      setPage(listPayload.pagination.page);
    }

    if (memberId) {
      const detail = await fetchMemberDetail(memberId);
      setSelectedMemberDetail(detail);
      setSelectedMemberSummary({
        id: detail.id,
        email: detail.email,
        nickname: detail.nickname,
        role: detail.role,
        created_at: detail.created_at,
        is_current_user: detail.is_current_user
      });
      setDraftNickname(detail.nickname);
    }
  };

  const onChangeNickname = async () => {
    if (!selectedMemberDetail) {
      return;
    }

    const nickname = draftNickname.trim();
    if (!nickname) {
      setDetailError("닉네임을 입력하세요.");
      return;
    }

    setActingKey(`nickname:${selectedMemberDetail.id}`);
    setError(null);
    setDetailError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/members/${selectedMemberDetail.id}`, {
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
        setDetailError(String(payload.error ?? payload.message ?? rawText ?? "닉네임 변경에 실패했습니다."));
        return;
      }

      setMessage(`${selectedMemberDetail.email}의 닉네임을 변경했습니다.`);
      await refreshListAndDetail(selectedMemberDetail.id);
    } catch (updateError) {
      setDetailError(String(updateError));
    } finally {
      setActingKey(null);
    }
  };

  const onWithdrawMember = async () => {
    if (!selectedMemberDetail) {
      return;
    }

    setActingKey(`withdraw:${selectedMemberDetail.id}`);
    setError(null);
    setDetailError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/members/${selectedMemberDetail.id}`, {
        method: "DELETE"
      });
      const rawText = await response.text();
      const payload = parsePayload(rawText);
      if (!response.ok) {
        setDetailError(String(payload.error ?? payload.message ?? rawText ?? "회원 탈퇴 처리에 실패했습니다."));
        return;
      }

      setMessage(`${selectedMemberDetail.email} 계정을 탈퇴 처리했습니다.`);
      closeMemberModal();
      await refreshListAndDetail();
    } catch (withdrawError) {
      setDetailError(String(withdrawError));
    } finally {
      setActingKey(null);
    }
  };

  const onDeleteToken = async (token: MemberTokenRow) => {
    if (!selectedMemberDetail) {
      return;
    }

    setActingKey(`token:${token.id}`);
    setError(null);
    setDetailError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/tokens/${token.id}`, {
        method: "DELETE"
      });
      const rawText = await response.text();
      const payload = parsePayload(rawText);
      if (!response.ok) {
        setDetailError(String(payload.error ?? payload.message ?? rawText ?? "토큰 삭제에 실패했습니다."));
        return;
      }

      setMessage(`${selectedMemberDetail.email}의 토큰을 삭제했습니다.`);
      await refreshListAndDetail(selectedMemberDetail.id);
    } catch (deleteError) {
      setDetailError(String(deleteError));
    } finally {
      setActingKey(null);
    }
  };

  const paginationItems = useMemo(() => {
    const totalPages = pagination.total_pages || 1;
    const currentPage = pagination.page || 1;
    const start = Math.max(1, currentPage - 2);
    const end = Math.min(totalPages, start + 4);
    const adjustedStart = Math.max(1, end - 4);

    return Array.from({ length: end - adjustedStart + 1 }, (_, index) => adjustedStart + index);
  }, [pagination.page, pagination.total_pages]);

  const detailMember = selectedMemberDetail ?? selectedMemberSummary;
  const nicknameDirty = selectedMemberDetail
    ? draftNickname.trim().length > 0 && draftNickname.trim() !== selectedMemberDetail.nickname
    : false;

  return (
    <>
      <section className="panel">
        <h1>회원 관리</h1>
        <p className="muted">이메일 또는 닉네임으로 회원을 검색하고, 목록에서 상세 관리를 열어 닉변/탈퇴/토큰 삭제를 처리합니다.</p>

        <div className="actions">
          <Link href="/admin/tokens" className="btn btn-secondary">
            토큰 승인으로 이동
          </Link>
        </div>

        <div className="admin-member-toolbar">
          <label className="form-row">
            <span>회원 검색</span>
            <input
              value={query}
              onChange={(event) => {
                const nextValue = event.target.value;
                startTransition(() => {
                  setQuery(nextValue);
                  setPage(1);
                });
              }}
              placeholder="이메일 또는 닉네임"
            />
          </label>

          <div className="admin-member-toolbar-meta">
            <span className="tag">총 {pagination.total_count}명</span>
            <span className="tag">
              {pagination.page} / {pagination.total_pages} 페이지
            </span>
          </div>
        </div>

        {loading ? <p className="muted">불러오는 중...</p> : null}
        {error ? <p className="error">{error}</p> : null}
        {message ? <p className="success">{message}</p> : null}

        {!loading && !error ? (
          <>
            <div className="table-wrap">
              <table className="table admin-member-table">
                <thead>
                  <tr>
                    <th>이메일</th>
                    <th>닉네임</th>
                    <th>가입일</th>
                    <th>역할</th>
                  </tr>
                </thead>
                <tbody>
                  {members.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="muted">
                        조건에 맞는 회원이 없습니다.
                      </td>
                    </tr>
                  ) : null}

                  {members.map((member) => (
                    <tr
                      key={member.id}
                      className="admin-member-row"
                      role="button"
                      tabIndex={0}
                      aria-label={`${member.email} 상세 관리 열기`}
                      onClick={() => openMemberModal(member)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          openMemberModal(member);
                        }
                      }}
                    >
                      <td>
                        {member.email}
                        {member.is_current_user ? (
                          <>
                            <br />
                            <span className="muted">현재 로그인</span>
                          </>
                        ) : null}
                      </td>
                      <td>{member.nickname}</td>
                      <td>{formatDateTime(member.created_at)}</td>
                      <td>{member.role === "admin" ? "관리자" : "회원"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="actions admin-member-pagination">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={loading || !pagination.has_prev}
              >
                이전
              </button>

              {paginationItems.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={item === pagination.page ? "" : "btn-secondary"}
                  onClick={() => setPage(item)}
                  disabled={loading}
                >
                  {item}
                </button>
              ))}

              <button
                type="button"
                className="btn-secondary"
                onClick={() => setPage((current) => Math.min(pagination.total_pages, current + 1))}
                disabled={loading || !pagination.has_next}
              >
                다음
              </button>
            </div>
          </>
        ) : null}
      </section>

      {selectedMemberId ? (
        <div className="overview-modal-backdrop" role="presentation" onClick={closeMemberModal}>
          <div className="overview-modal admin-member-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <div className="overview-modal-head">
              <div>
                <p className="overview-kicker">회원 상세 관리</p>
                <h3>{detailMember?.nickname ?? "회원 로딩 중"}</h3>
                <p className="muted">{detailMember?.email ?? ""}</p>
              </div>
              <button type="button" className="btn btn-secondary" onClick={closeMemberModal}>
                닫기
              </button>
            </div>

            {detailLoading ? <p className="muted">상세 정보를 불러오는 중...</p> : null}
            {detailError ? <p className="error">{detailError}</p> : null}

            {!detailLoading && selectedMemberDetail ? (
              <div className="admin-member-detail-shell">
                <div className="admin-member-detail-meta">
                  <span className="tag">{selectedMemberDetail.role === "admin" ? "관리자" : "회원"}</span>
                  {selectedMemberDetail.is_current_user ? <span className="tag">현재 로그인</span> : null}
                  <span className="tag">가입 {formatDateTime(selectedMemberDetail.created_at)}</span>
                  <span className="tag">활성 토큰 {selectedMemberDetail.active_token_count}</span>
                  <span className="tag">전체 토큰 {selectedMemberDetail.total_token_count}</span>
                </div>

                <div className="admin-member-detail-grid">
                  <div className="card">
                    <h3>회원 정보</h3>
                    <p>
                      <strong>이메일</strong>
                      <br />
                      {selectedMemberDetail.email}
                    </p>
                    <p>
                      <strong>닉네임 확정</strong>
                      <br />
                      {formatDateTime(selectedMemberDetail.nickname_confirmed_at)}
                    </p>
                    <p>
                      <strong>최근 닉변</strong>
                      <br />
                      {formatDateTime(selectedMemberDetail.nickname_changed_at)}
                    </p>
                  </div>

                  <div className="card">
                    <h3>관리 액션</h3>

                    {selectedMemberDetail.role === "admin" ? (
                      <p className="muted">관리자 계정은 상세 조회만 가능합니다.</p>
                    ) : (
                      <>
                        <label className="form-row">
                          <span>강제 닉네임 변경</span>
                          <input
                            value={draftNickname}
                            onChange={(event) => setDraftNickname(event.target.value)}
                            maxLength={30}
                            disabled={Boolean(actingKey)}
                          />
                        </label>

                        <div className="actions">
                          <button
                            type="button"
                            onClick={() => void onChangeNickname()}
                            disabled={Boolean(actingKey) || !nicknameDirty}
                          >
                            {actingKey === `nickname:${selectedMemberDetail.id}` ? "저장 중..." : "닉네임 저장"}
                          </button>

                          {confirmWithdraw ? (
                            <>
                              <button
                                type="button"
                                className="btn-danger"
                                onClick={() => void onWithdrawMember()}
                                disabled={Boolean(actingKey)}
                              >
                                {actingKey === `withdraw:${selectedMemberDetail.id}` ? "탈퇴 처리 중..." : "정말 탈퇴 처리"}
                              </button>
                              <button
                                type="button"
                                className="btn-secondary"
                                onClick={() => setConfirmWithdraw(false)}
                                disabled={Boolean(actingKey)}
                              >
                                취소
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              className="btn-danger"
                              onClick={() => setConfirmWithdraw(true)}
                              disabled={Boolean(actingKey)}
                            >
                              회원탈퇴 처리
                            </button>
                          )}
                        </div>

                        {confirmWithdraw ? (
                          <p className="error">
                            이 회원의 프로필, 글/댓글, 신고, 표, API 토큰이 함께 삭제되고 같은 이메일은 7일 동안 재가입할 수 없습니다.
                          </p>
                        ) : null}
                      </>
                    )}
                  </div>
                </div>

                <div className="card admin-member-token-card">
                  <h3>토큰 관리</h3>

                  {selectedMemberDetail.tokens.length === 0 ? (
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
                          {selectedMemberDetail.tokens.map((token) => (
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
                                {selectedMemberDetail.role === "admin" ? (
                                  <span className="muted">관리자 보호</span>
                                ) : (
                                  <button
                                    type="button"
                                    className="btn-secondary"
                                    onClick={() => void onDeleteToken(token)}
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
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
