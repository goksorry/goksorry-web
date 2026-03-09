"use client";

import { useEffect, useState } from "react";

type ReportRow = {
  id: string;
  target_type: string;
  target_id: string;
  reason: string;
  status: string;
  created_at: string;
  reporter_id: string;
  reporter_nickname: string | null;
  reporter_email: string | null;
};

export default function AdminReportsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reports, setReports] = useState<ReportRow[]>([]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/admin/reports", {
        cache: "no-store"
      });

      const payload = await response.json().catch(() => ({}));
      if (!active) {
        return;
      }

      if (!response.ok) {
        setError(payload.error ?? "신고 목록을 불러오지 못했습니다.");
        setReports([]);
      } else {
        setReports(Array.isArray(payload.reports) ? payload.reports : []);
      }
      setLoading(false);
    };

    load().catch((loadError) => {
      if (!active) {
        return;
      }
      setError(String(loadError));
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="panel">
      <h1>신고 관리</h1>
      <p className="muted">
        <code>ADMIN_EMAIL</code>에 등록된 계정만 이 화면을 볼 수 있습니다.
      </p>

      {loading ? <p className="muted">불러오는 중...</p> : null}
      {error ? <p className="error">{error}</p> : null}

      {!loading && !error ? (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>접수 시각</th>
                <th>대상</th>
                <th>사유</th>
                <th>신고자</th>
                <th>상태</th>
              </tr>
            </thead>
            <tbody>
              {reports.length === 0 ? (
                <tr>
                  <td colSpan={5} className="muted">
                    접수된 신고가 없습니다.
                  </td>
                </tr>
              ) : null}

              {reports.map((row) => (
                <tr key={row.id}>
                  <td>{new Date(row.created_at).toLocaleString("ko-KR")}</td>
                  <td>
                    {row.target_type} / {row.target_id}
                  </td>
                  <td>{row.reason}</td>
                  <td>
                    {row.reporter_nickname ?? "알 수 없음"}
                    <br />
                    <span className="muted">{row.reporter_email ?? row.reporter_id}</span>
                  </td>
                  <td>{row.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
