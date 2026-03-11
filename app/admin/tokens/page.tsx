"use client";

import { useEffect, useState } from "react";

type AdminTokenRow = {
  id: string;
  requester_id: string;
  requester_nickname: string | null;
  requester_email: string | null;
  name: string;
  token_prefix: string | null;
  scope: string;
  approval_status: "pending" | "approved" | "rejected";
  approval_requested_at: string | null;
  approved_at: string | null;
  approved_by_nickname: string | null;
  rejected_at: string | null;
  rejected_by_nickname: string | null;
  approval_note: string | null;
  created_at: string | null;
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  token_claimed: boolean;
};

type FilterValue = "pending" | "approved" | "rejected" | "all";

const formatDateTime = (value: string | null): string => {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("ko-KR");
};

export default function AdminTokensPage() {
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterValue>("pending");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [tokens, setTokens] = useState<AdminTokenRow[]>([]);

  const load = async (nextFilter: FilterValue) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/tokens?status=${nextFilter}`, {
        cache: "no-store"
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setTokens([]);
        setError(payload.error ?? "토큰 요청 목록을 불러오지 못했습니다.");
        return;
      }

      setTokens(Array.isArray(payload.tokens) ? payload.tokens : []);
    } catch (loadError) {
      setTokens([]);
      setError(String(loadError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(filter);
  }, [filter]);

  const onDecision = async (tokenId: string, decision: "approve" | "reject") => {
    setActingId(tokenId);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/tokens/${tokenId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          decision
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload.error ?? "토큰 요청 처리에 실패했습니다.");
        return;
      }

      setMessage(decision === "approve" ? "토큰 요청을 승인했습니다." : "토큰 요청을 반려했습니다.");
      await load(filter);
    } catch (decisionError) {
      setError(String(decisionError));
    } finally {
      setActingId(null);
    }
  };

  return (
    <section className="panel">
      <h1>토큰 승인</h1>
      <p className="muted">관리자는 요청만 승인/반려합니다. 실제 토큰 원문은 승인 후 사용자가 내 프로필 화면에서 1회 확인합니다.</p>

      <label className="form-row">
        <span>필터</span>
        <select value={filter} onChange={(event) => setFilter(event.target.value as FilterValue)} disabled={loading}>
          <option value="pending">승인 대기</option>
          <option value="approved">승인 완료</option>
          <option value="rejected">반려</option>
          <option value="all">전체</option>
        </select>
      </label>

      {loading ? <p className="muted">불러오는 중...</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {message ? <p className="success">{message}</p> : null}

      {!loading && !error ? (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>요청 시각</th>
                <th>요청자</th>
                <th>이름</th>
                <th>상태</th>
                <th>발급 여부</th>
                <th>마지막 사용</th>
                <th>만료</th>
                <th>동작</th>
              </tr>
            </thead>
            <tbody>
              {tokens.length === 0 ? (
                <tr>
                  <td colSpan={8} className="muted">
                    표시할 요청이 없습니다.
                  </td>
                </tr>
              ) : null}

              {tokens.map((token) => (
                <tr key={token.id}>
                  <td>
                    {formatDateTime(token.approval_requested_at)}
                    <br />
                    <span className="muted">
                      승인: {formatDateTime(token.approved_at)} / 반려: {formatDateTime(token.rejected_at)}
                    </span>
                  </td>
                  <td>
                    {token.requester_nickname ?? "알 수 없음"}
                    <br />
                    <span className="muted">{token.requester_email ?? token.requester_id}</span>
                  </td>
                  <td>
                    {token.name}
                    <br />
                    <span className="muted">{token.scope}</span>
                  </td>
                  <td>
                    {token.approval_status}
                    {token.revoked_at ? (
                      <>
                        <br />
                        <span className="muted">폐기됨</span>
                      </>
                    ) : null}
                  </td>
                  <td>
                    {token.token_claimed ? "사용자 발급 완료" : token.approval_status === "approved" ? "사용자 발급 대기" : "-"}
                    {token.token_prefix ? (
                      <>
                        <br />
                        <span className="muted">{token.token_prefix}</span>
                      </>
                    ) : null}
                  </td>
                  <td>{formatDateTime(token.last_used_at)}</td>
                  <td>{formatDateTime(token.expires_at)}</td>
                  <td>
                    {token.approval_status === "pending" && !token.revoked_at ? (
                      <div className="actions">
                        <button type="button" onClick={() => void onDecision(token.id, "approve")} disabled={actingId === token.id}>
                          {actingId === token.id ? "처리 중..." : "승인"}
                        </button>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => void onDecision(token.id, "reject")}
                          disabled={actingId === token.id}
                        >
                          {actingId === token.id ? "처리 중..." : "반려"}
                        </button>
                      </div>
                    ) : (
                      <span className="muted">처리 완료</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
