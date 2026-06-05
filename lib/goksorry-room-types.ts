export type GoksorryRoomReplyPayload = {
  id: string;
  entry_id: string;
  content: string;
  author_kind: "member" | "guest";
  author_label: string;
  created_at: string;
  can_delete: boolean;
  is_mine: boolean;
};

export type GoksorryRoomEntryPayload = {
  id: string;
  content: string;
  author_kind: "member" | "guest";
  author_label: string;
  created_at: string;
  reply_count: number;
  can_delete: boolean;
  is_mine: boolean;
  replies: GoksorryRoomReplyPayload[];
};

export type GoksorryRoomViewerPayload =
  | {
      kind: "member";
    }
  | {
      kind: "guest";
      default_guest_nickname?: string;
    };

export type GoksorryRoomPayload = {
  viewer: GoksorryRoomViewerPayload;
  entries: GoksorryRoomEntryPayload[];
  next_cursor: string | null;
};
