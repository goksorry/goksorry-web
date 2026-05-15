import type { Metadata } from "next";
import { GoksorryRoomClient } from "@/components/goksorry-room/goksorry-room-client";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "곡소리방",
  description: "제목 없이 한두 줄 의견과 덧글을 남기는 곡소리닷컴의 짧은 의견 공간입니다.",
  path: "/goksorry-room"
});

export default function GoksorryRoomPage() {
  return (
    <section className="panel goksorry-room-panel">
      <h1>곡소리방</h1>
      <GoksorryRoomClient />
    </section>
  );
}
