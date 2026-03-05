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
        setError(payload.error ?? "Failed to load reports");
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
      <h1>Admin Reports</h1>
      <p className="muted">Only ADMIN_EMAIL users can load this page.</p>

      {loading ? <p className="muted">Loading...</p> : null}
      {error ? <p className="error">{error}</p> : null}

      {!loading && !error ? (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Created</th>
                <th>Target</th>
                <th>Reason</th>
                <th>Reporter</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {reports.length === 0 ? (
                <tr>
                  <td colSpan={5} className="muted">
                    No reports.
                  </td>
                </tr>
              ) : null}

              {reports.map((row) => (
                <tr key={row.id}>
                  <td>{new Date(row.created_at).toLocaleString()}</td>
                  <td>
                    {row.target_type} / {row.target_id}
                  </td>
                  <td>{row.reason}</td>
                  <td>
                    {row.reporter_nickname ?? "unknown"}
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
