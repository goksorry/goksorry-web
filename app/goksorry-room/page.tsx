import type { Metadata } from "next";
import { headers } from "next/headers";
import { GoksorryRoomClient } from "@/components/goksorry-room/goksorry-room-client";
import { GOKSORRY_ROOM_DEFAULT_LIMIT } from "@/lib/goksorry-room";
import { readGoksorryRoomEntries } from "@/lib/goksorry-room-read";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "곡소리방",
  description: "제목 없이 한두 줄 의견과 덧글을 남기는 곡소리닷컴의 짧은 의견 공간입니다.",
  path: "/goksorry-room"
});

const buildRoomRequest = () => {
  const headerStore = headers();
  const cookie = headerStore.get("cookie") ?? "";
  const proto = headerStore.get("x-forwarded-proto") ?? "https";
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host") ?? "localhost";

  return new Request(`${proto}://${host}/goksorry-room`, {
    headers: cookie ? { cookie } : undefined
  });
};

export default async function GoksorryRoomPage() {
  const shouldLoadInitialPayload = process.env.NODE_ENV === "production";
  const { payload: initialPayload, error: initialError } = shouldLoadInitialPayload
    ? await readGoksorryRoomEntries({
        request: buildRoomRequest(),
        limit: GOKSORRY_ROOM_DEFAULT_LIMIT
      }).catch(() => ({
        payload: null,
        error: true
      }))
    : {
        payload: null,
        error: null
      };

  return (
    <section className="panel goksorry-room-panel">
      <h1>곡소리방</h1>
      <GoksorryRoomClient
        initialPayload={initialError ? null : initialPayload}
        initialError={initialError ? "곡소리방을 불러오지 못했습니다. 다시 시도합니다." : null}
      />
    </section>
  );
}
