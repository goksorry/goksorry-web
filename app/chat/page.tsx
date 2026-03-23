import { LiveChat } from "@/components/live-chat";
import { getChatServerEnv } from "@/lib/env";

export default function ChatPage() {
  const chatEnv = getChatServerEnv();

  return (
    <section className="panel chat-page-panel">
      <LiveChat enabled={chatEnv.enabled} />
    </section>
  );
}
