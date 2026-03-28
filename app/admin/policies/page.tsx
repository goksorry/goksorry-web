"use client";

import { useEffect, useMemo, useState } from "react";
import { formatKstDateTime } from "@/lib/date-time";

type PolicyType = "terms" | "privacy";
type PolicyStatus = "current" | "pending" | "historical" | "superseded";

type PolicyHistoryRow = {
  id: string;
  type: PolicyType;
  summary: string;
  body: string;
  is_adverse: boolean;
  published_at: string;
  effective_at: string;
  updated_at: string;
  superseded_at: string | null;
  created_at: string;
  status: PolicyStatus;
};

type PolicyDocumentSnapshot = {
  type: PolicyType;
  title: string;
  current: PolicyHistoryRow;
  pending: PolicyHistoryRow | null;
  history: PolicyHistoryRow[];
};

type PolicyPayload = {
  documents: Record<PolicyType, PolicyDocumentSnapshot>;
};

const POLICY_TYPES: PolicyType[] = ["terms", "privacy"];

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

const formatDateTime = (value: string | null): string => {
  if (!value) {
    return "-";
  }
  return formatKstDateTime(value);
};

const STATUS_LABEL: Record<PolicyStatus, string> = {
  current: "현재 적용",
  pending: "공지 중",
  historical: "과거 버전",
  superseded: "대체됨"
};

export default function AdminPoliciesPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedType, setSelectedType] = useState<PolicyType>("terms");
  const [documents, setDocuments] = useState<Record<PolicyType, PolicyDocumentSnapshot> | null>(null);
  const [summary, setSummary] = useState("");
  const [body, setBody] = useState("");
  const [isAdverse, setIsAdverse] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const selectedDocument = documents?.[selectedType] ?? null;

  const resetEditor = (type: PolicyType, nextDocuments: Record<PolicyType, PolicyDocumentSnapshot>) => {
    const doc = nextDocuments[type];
    const base = doc.pending ?? doc.current;
    setSummary(doc.pending?.summary ?? "");
    setBody(base.body);
    setIsAdverse(Boolean(doc.pending?.is_adverse));
  };

  const load = async (typeToKeep: PolicyType = selectedType) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/policies", {
        cache: "no-store"
      });
      const rawText = await response.text();
      const payload = parsePayload(rawText) as PolicyPayload;

      if (!response.ok || !payload.documents) {
        throw new Error(String((payload as Record<string, unknown>).error ?? rawText ?? "정책 문서를 불러오지 못했습니다."));
      }

      setDocuments(payload.documents);
      resetEditor(typeToKeep, payload.documents);
    } catch (loadError) {
      setDocuments(null);
      setError(String(loadError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!documents) {
      return;
    }

    resetEditor(selectedType, documents);
  }, [selectedType, documents]);

  const expectedEffectiveAt = useMemo(() => {
    if (!isAdverse) {
      return "즉시 적용";
    }

    return "저장 시점부터 7일 공지 후 시행";
  }, [isAdverse]);

  const onSave = async () => {
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/policies", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          type: selectedType,
          summary,
          body,
          is_adverse: isAdverse
        })
      });
      const rawText = await response.text();
      const payload = parsePayload(rawText);

      if (!response.ok) {
        throw new Error(String(payload.error ?? rawText ?? "정책 문서를 저장하지 못했습니다."));
      }

      setMessage(isAdverse ? "정책 문서를 저장했고 7일 공지 후 시행되도록 예약했습니다." : "정책 문서를 즉시 반영했습니다.");
      await load(selectedType);
    } catch (saveError) {
      setError(String(saveError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="panel">
      <h1>정책 문서 관리</h1>
      <p className="muted">
        이용약관과 개인정보처리방침을 Markdown으로 편집합니다. 지원 문법: <code>## 제목</code>, 빈 줄 문단 구분, <code>- 목록</code>,{" "}
        <code>[링크](url)</code>
      </p>
      <p className="muted">
        개인정보처리방침에서 광고 동의 버튼 위치를 유지하려면 <code>[[CONSENT_SETTINGS_BUTTON]]</code> 토큰을 본문에 포함하세요.
      </p>

      <div className="actions">
        {POLICY_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            className={selectedType === type ? "btn-secondary" : undefined}
            onClick={() => setSelectedType(type)}
            disabled={loading || saving}
          >
            {documents?.[type]?.title ?? (type === "terms" ? "이용약관" : "개인정보처리방침")}
          </button>
        ))}
      </div>

      {loading ? <p className="muted">불러오는 중...</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {message ? <p className="success">{message}</p> : null}

      {!loading && selectedDocument ? (
        <div className="grid">
          <article className="card">
            <h2>현재 적용 버전</h2>
            <p className="muted">효력 발생: {formatDateTime(selectedDocument.current.effective_at)}</p>
            <p className="muted">최종 수정: {formatDateTime(selectedDocument.current.updated_at)}</p>
            <p>{selectedDocument.current.summary}</p>
          </article>

          <article className="card">
            <h2>대기 중 버전</h2>
            {selectedDocument.pending ? (
              <>
                <p className="muted">공지 시작: {formatDateTime(selectedDocument.pending.published_at)}</p>
                <p className="muted">효력 발생: {formatDateTime(selectedDocument.pending.effective_at)}</p>
                <p>{selectedDocument.pending.summary}</p>
              </>
            ) : (
              <p className="muted">현재 대기 중인 버전이 없습니다.</p>
            )}
          </article>

          <article className="card">
            <h2>편집</h2>
            <label className="form-row">
              <span>변경 요약</span>
              <input value={summary} onChange={(event) => setSummary(event.target.value)} maxLength={120} />
            </label>
            <label className="form-row">
              <span>문서 본문</span>
              <textarea value={body} onChange={(event) => setBody(event.target.value)} rows={24} />
            </label>
            <label className="form-row-checkbox">
              <input type="checkbox" checked={isAdverse} onChange={(event) => setIsAdverse(event.target.checked)} />
              <span>불리조항 추가</span>
            </label>
            <p className="muted">{expectedEffectiveAt}</p>
            <div className="actions">
              <button type="button" onClick={() => void onSave()} disabled={saving || !summary.trim() || !body.trim()}>
                {saving ? "저장 중..." : isAdverse ? "7일 공지 후 시행 예약" : "즉시 반영"}
              </button>
            </div>
          </article>

          <article className="card">
            <h2>히스토리</h2>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>상태</th>
                    <th>요약</th>
                    <th>공지 시작</th>
                    <th>효력 발생</th>
                    <th>최종 수정</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedDocument.history.map((row) => (
                    <tr key={row.id}>
                      <td>{STATUS_LABEL[row.status]}</td>
                      <td>
                        {row.summary}
                        {row.is_adverse ? (
                          <>
                            <br />
                            <span className="muted">불리조항 추가</span>
                          </>
                        ) : null}
                      </td>
                      <td>{formatDateTime(row.published_at)}</td>
                      <td>{formatDateTime(row.effective_at)}</td>
                      <td>{formatDateTime(row.updated_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        </div>
      ) : null}
    </section>
  );
}
