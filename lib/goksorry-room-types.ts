export type GoksorryRoomReplyPayload = {
  id: string;
  entry_id: string;
  content: string;
  author_kind: "member" | "guest";
  author_label: string;
  created_at: string;
  can_delete: boolean;
};

export type GoksorryRoomEntryPayload = {
  id: string;
  content: string;
  author_kind: "member" | "guest";
  author_label: string;
  created_at: string;
  reply_count: number;
  can_delete: boolean;
  replies: GoksorryRoomReplyPayload[];
};

export type GoksorryRoomPayload = {
  entries: GoksorryRoomEntryPayload[];
  next_cursor: string | null;
};
