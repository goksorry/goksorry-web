"use client";

import { useEffect, useState } from "react";
import { formatKstDateTime } from "@/lib/date-time";

type TokenRow = {
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

type RevealedToken = {
  id: string;
  name: string;
  value: string;
  expires_at: string | null;
};

const defaultTokenName = () => `tradingbot-${new Date().toISOString().slice(0, 10)}`;

const formatDateTime = (iso: string | null): string => {
  if (!iso) {
    return "-";
  }
  return formatKstDateTime(iso);
};

const tokenStatusLabel = (token: TokenRow): string => {
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

export function ProfileTokenManager() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [tokenName, setTokenName] = useState(defaultTokenName);
  const [expiresAt, setExpiresAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [revealedToken, setRevealedToken] = useState<RevealedToken | null>(null);

  const loadTokens = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/v1/tokens", {
        cache: "no-store"
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setTokens([]);
        setError(payload.message ?? payload.error ?? "토큰 목록을 불러오지 못했습니다.");
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
    void loadTokens();
  }, []);

  const onRequestToken = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setMessage(null);
    setRevealedToken(null);

    try {
      const response = await fetch("/api/v1/tokens", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: tokenName,
          expires_at: expiresAt ? new Date(expiresAt).toISOString() : null
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload.message ?? payload.error ?? "토큰 요청에 실패했습니다.");
        return;
      }

      setMessage("토큰 요청이 접수되었습니다. 관리자 승인 후 이 화면에서 실제 토큰 값을 확인할 수 있습니다.");
      setTokenName(defaultTokenName());
      setExpiresAt("");
      await loadTokens();
    } catch (requestError) {
      setError(String(requestError));
    } finally {
      setSubmitting(false);
    }
  };

  const onClaimToken = async (tokenId: string) => {
    setActingId(tokenId);
    setError(null);
    setMessage(null);
    setRevealedToken(null);

    try {
      const response = await fetch(`/api/v1/tokens/${tokenId}/claim`, {
        method: "POST"
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload.message ?? payload.error ?? "토큰 값을 발급하지 못했습니다.");
        return;
      }

      const token = payload.token ?? {};
      setRevealedToken({
        id: String(token.id ?? tokenId),
        name: String(token.name ?? ""),
        value: String(token.value ?? ""),
        expires_at: token.expires_at ? String(token.expires_at) : null
      });
      setMessage("토큰 값이 발급되었습니다. 이 값은 지금만 확인할 수 있습니다.");
      await loadTokens();
    } catch (claimError) {
      setError(String(claimError));
    } finally {
      setActingId(null);
    }
  };

  const onRevokeToken = async (tokenId: string) => {
    setActingId(tokenId);
    setError(null);
    setMessage(null);
    setRevealedToken(null);

    try {
      const response = await fetch(`/api/v1/tokens/${tokenId}/revoke`, {
        method: "POST"
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload.message ?? payload.error ?? "토큰 폐기에 실패했습니다.");
        return;
      }

      setMessage("토큰 또는 요청이 폐기되었습니다.");
      await loadTokens();
    } catch (revokeError) {
      setError(String(revokeError));
    } finally {
      setActingId(null);
    }
  };

  return (
    <section className="card">
      <div className="grid">
        <div>
          <h2>TradingBot 토큰</h2>
          <p className="muted">공식 시세가 아니라 곡소리닷컴의 커뮤니티 지수를 읽는 용도입니다. 요청 후 관리자 승인 절차가 필요합니다.</p>
        </div>

        <form className="grid" onSubmit={onRequestToken}>
          <label className="form-row">
            <span>토큰 이름</span>
            <input
              name="token_name"
              value={tokenName}
              onChange={(event) => setTokenName(event.target.value)}
              maxLength={80}
              placeholder="예: tradingbot-main"
              required
              disabled={submitting}
            />
          </label>

          <label className="form-row">
            <span>만료 시각 (선택)</span>
            <input
              type="datetime-local"
              name="expires_at"
              value={expiresAt}
              onChange={(event) => setExpiresAt(event.target.value)}
              disabled={submitting}
            />
          </label>

          <div className="actions">
            <button type="submit" disabled={submitting}>
              {submitting ? "요청 중..." : "토큰 요청"}
            </button>
          </div>
        </form>

        {error ? <p className="error">{error}</p> : null}
        {message ? <p className="success">{message}</p> : null}

        {revealedToken ? (
          <div className="card">
            <p className="error">아래 토큰 값은 지금만 보입니다. 봇 설정에 저장한 뒤 이 화면을 벗어나면 다시 확인할 수 없습니다.</p>
            <p>
              <strong>{revealedToken.name}</strong>
            </p>
            <p>
              <code>{revealedToken.value}</code>
            </p>
            <p className="muted">만료 시각: {formatDateTime(revealedToken.expires_at)}</p>
          </div>
        ) : null}

        {loading ? <p className="muted">토큰 목록을 불러오는 중...</p> : null}

        {!loading ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>이름</th>
                  <th>상태</th>
                  <th>토큰 Prefix</th>
                  <th>요청/처리 시각</th>
                  <th>마지막 사용</th>
                  <th>만료</th>
                  <th>동작</th>
                </tr>
              </thead>
              <tbody>
                {tokens.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="muted">
                      아직 요청한 토큰이 없습니다.
                    </td>
                  </tr>
                ) : null}

                {tokens.map((token) => (
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
                      <div className="actions">
                        {token.claim_ready ? (
                          <button
                            type="button"
                            onClick={() => void onClaimToken(token.id)}
                            disabled={actingId === token.id}
                          >
                            {actingId === token.id ? "발급 중..." : "토큰 보기"}
                          </button>
                        ) : null}

                        {!token.revoked_at ? (
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => void onRevokeToken(token.id)}
                            disabled={actingId === token.id}
                          >
                            {actingId === token.id ? "처리 중..." : token.approval_status === "pending" ? "요청 취소" : "폐기"}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </section>
  );
}
