"use client";

import { useCallback, useEffect, useState } from "react";
import type { ChatMessage } from "@/lib/chat-types";

export default function AdminChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/chat/messages", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "불러오지 못했습니다.");
      setMessages(data.messages ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "불러오지 못했습니다.");
    } finally { setBusy(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function remove(message: ChatMessage) {
    if (!window.confirm("이 채팅 메시지를 삭제할까요? 삭제 후 복구할 수 없습니다.")) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/chat/messages", {
        method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: message.id })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "삭제하지 못했습니다.");
      setMessages((current) => current.filter((item) => item.id !== message.id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "삭제하지 못했습니다.");
    } finally { setBusy(false); }
  }

  return <section className="panel">
    <h1>채팅 관리</h1>
    <p className="muted">최근 24시간 내 메시지 중 최대 30건을 보관합니다. 삭제 요청이 접수된 메시지를 여기서 삭제할 수 있습니다.</p>
    <button type="button" onClick={() => void load()} disabled={busy}>새로고침</button>
    {error ? <p role="alert" className="error">{error}</p> : null}
    {busy ? <p role="status">처리 중...</p> : null}
    {!busy && !error && !messages.length ? <p>보관 중인 메시지가 없습니다.</p> : null}
    <div className="table-wrap"><table className="table"><thead><tr><th>시각</th><th>닉네임</th><th>내용</th><th>관리</th></tr></thead>
      <tbody>{messages.map((message) => <tr key={message.id}>
        <td>{new Date(message.sent_at).toLocaleString("ko-KR")}</td><td>{message.author_name}</td><td>{message.text}</td>
        <td><button type="button" onClick={() => void remove(message)} disabled={busy} aria-label={`${message.author_name} 메시지 삭제`}>삭제</button></td>
      </tr>)}</tbody></table></div>
  </section>;
}
