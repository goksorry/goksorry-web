import type { Metadata } from "next";
import { LiveChat } from "@/components/live-chat";
import { getChatServerEnv } from "@/lib/env";
import { buildNoIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = buildNoIndexMetadata("채팅", "곡소리닷컴 회원 전용 실시간 채팅 화면입니다.");

export default function ChatPage() {
  const chatEnv = getChatServerEnv();

  return (
    <section className="panel chat-page-panel">
      <LiveChat enabled={chatEnv.enabled} title="전체 채팅" />
    </section>
  );
}
