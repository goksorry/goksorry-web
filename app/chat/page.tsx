import { LiveChat } from "@/components/live-chat";
import { getChatServerEnv } from "@/lib/env";

export default function ChatPage() {
  const chatEnv = getChatServerEnv();

  return (
    <section className="panel chat-page-panel">
      <div className="chat-page-copy">
        <h1>전체 채팅</h1>
        <p className="muted">
          로그인 사용자는 닉네임으로 글을 쓸 수 있고, 비로그인 사용자는 익명 이름으로 읽기만 할 수 있습니다. 로그인
          상태에서는 비로그인 메시지 숨기기를 켤 수 있습니다.
        </p>
        <p className="muted">최근 20개 메시지만 유지되며 첨부, DM, 읽음 표시는 제공하지 않습니다.</p>
      </div>
      <LiveChat enabled={chatEnv.enabled} />
    </section>
  );
}
