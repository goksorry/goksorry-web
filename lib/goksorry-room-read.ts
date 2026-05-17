import "server-only";

import {
  canManageGoksorryRoomItem,
  resolveExistingGoksorryRoomActor
} from "@/lib/goksorry-room";
import type {
  GoksorryRoomEntryPayload,
  GoksorryRoomPayload,
  GoksorryRoomReplyPayload
} from "@/lib/goksorry-room-types";
import { getServiceSupabaseClient } from "@/lib/supabase/service";

type GoksorryRoomActor = Awaited<ReturnType<typeof resolveExistingGoksorryRoomActor>>["actor"];

const ENTRY_SELECT_WITH_REPLY_COUNT =
  "id,author_kind,author_id,guest_owner_hash,author_label,content,created_at,reply_count";
const ENTRY_SELECT_FALLBACK = "id,author_kind,author_id,guest_owner_hash,author_label,content,created_at";
const REPLY_SELECT = "id,entry_id,author_kind,author_id,guest_owner_hash,author_label,content,created_at";

const isMissingReplyCountError = (error: { code?: string | null; message?: string | null } | null): boolean => {
  const message = error?.message ?? "";
  return error?.code === "42703" || error?.code === "PGRST204" || message.includes("reply_count");
};

const mapReply = (reply: any, actor: GoksorryRoomActor): GoksorryRoomReplyPayload => ({
  id: String(reply.id),
  entry_id: String(reply.entry_id),
  content: String(reply.content),
  author_kind: reply.author_kind === "member" ? "member" : "guest",
  author_label: String(reply.author_label ?? "익명"),
  created_at: String(reply.created_at),
  can_delete: canManageGoksorryRoomItem(actor, {
    author_kind: String(reply.author_kind ?? ""),
    author_id: reply.author_id ? String(reply.author_id) : null,
    guest_owner_hash: reply.guest_owner_hash ? String(reply.guest_owner_hash) : null
  })
});

const mapEntry = (
  entry: any,
  actor: GoksorryRoomActor,
  replyCount: number,
  replies: GoksorryRoomReplyPayload[] = []
): GoksorryRoomEntryPayload => ({
  id: String(entry.id),
  content: String(entry.content),
  author_kind: entry.author_kind === "member" ? "member" : "guest",
  author_label: String(entry.author_label ?? "익명"),
  created_at: String(entry.created_at),
  reply_count: replyCount,
  can_delete: canManageGoksorryRoomItem(actor, {
    author_kind: String(entry.author_kind ?? ""),
    author_id: entry.author_id ? String(entry.author_id) : null,
    guest_owner_hash: entry.guest_owner_hash ? String(entry.guest_owner_hash) : null
  }),
  replies
});

const countRepliesByEntryId = async (entryIds: string[]): Promise<Map<string, number>> => {
  if (entryIds.length === 0) {
    return new Map();
  }

  const service = getServiceSupabaseClient();
  const { data, error } = await service
    .from("goksorry_room_replies")
    .select("entry_id")
    .in("entry_id", entryIds)
    .eq("is_deleted", false);

  if (error || !data) {
    return new Map();
  }

  const counts = new Map<string, number>();
  for (const reply of data) {
    const entryId = String((reply as any).entry_id ?? "");
    if (entryId) {
      counts.set(entryId, (counts.get(entryId) ?? 0) + 1);
    }
  }

  return counts;
};

const readEntryRows = async ({
  cursor,
  limit
}: {
  cursor?: string | null;
  limit: number;
}): Promise<{
  entries: any[];
  replyCounts: Map<string, number> | null;
  error: any;
}> => {
  const service = getServiceSupabaseClient();
  const buildQuery = (select: string) => {
    let query = service
      .from("goksorry_room_entries")
      .select(select)
      .eq("is_deleted", false)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (cursor) {
      query = query.lt("created_at", cursor);
    }

    return query;
  };

  const withReplyCount = await buildQuery(ENTRY_SELECT_WITH_REPLY_COUNT);
  if (!withReplyCount.error) {
    return {
      entries: withReplyCount.data ?? [],
      replyCounts: null,
      error: null
    };
  }

  if (!isMissingReplyCountError(withReplyCount.error)) {
    return {
      entries: [],
      replyCounts: null,
      error: withReplyCount.error
    };
  }

  const fallback = await buildQuery(ENTRY_SELECT_FALLBACK);
  if (fallback.error) {
    return {
      entries: [],
      replyCounts: null,
      error: fallback.error
    };
  }

  const entries = fallback.data ?? [];
  return {
    entries,
    replyCounts: await countRepliesByEntryId(entries.map((entry: any) => String(entry.id))),
    error: null
  };
};

export const readGoksorryRoomEntries = async ({
  request,
  cursor,
  limit
}: {
  request: Request;
  cursor?: string | null;
  limit: number;
}): Promise<{ payload: GoksorryRoomPayload; error: any; actor: GoksorryRoomActor }> => {
  const { actor } = await resolveExistingGoksorryRoomActor(request);
  const { entries, replyCounts, error } = await readEntryRows({ cursor, limit });
  if (error) {
    return {
      payload: {
        entries: [],
        next_cursor: null
      },
      error,
      actor
    };
  }

  const mappedEntries = entries.map((entry: any) =>
    mapEntry(entry, actor, replyCounts?.get(String(entry.id)) ?? Number(entry.reply_count ?? 0), [])
  );
  const lastEntry = mappedEntries[mappedEntries.length - 1];

  return {
    payload: {
      entries: mappedEntries,
      next_cursor: mappedEntries.length === limit && lastEntry ? lastEntry.created_at : null
    },
    error: null,
    actor
  };
};

export const readGoksorryRoomReplies = async ({
  request,
  entryId
}: {
  request: Request;
  entryId: string;
}): Promise<{ replies: GoksorryRoomReplyPayload[]; error: any }> => {
  const { actor } = await resolveExistingGoksorryRoomActor(request);
  const service = getServiceSupabaseClient();
  const { data, error } = await service
    .from("goksorry_room_replies")
    .select(REPLY_SELECT)
    .eq("entry_id", entryId)
    .eq("is_deleted", false)
    .order("created_at", { ascending: true });

  if (error) {
    return {
      replies: [],
      error
    };
  }

  return {
    replies: (data ?? []).map((reply: any) => mapReply(reply, actor)),
    error: null
  };
};
