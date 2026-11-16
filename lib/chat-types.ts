import { SERVER_COOKIE_DEFINITIONS } from "@/lib/persistence-registry";

export const CHAT_DEFAULT_FILTER = "all" as const;
export const CHAT_RECENT_LIMIT = 30;
export const CHAT_MESSAGE_MAX_LENGTH = 100;
export const CHAT_GUEST_NICKNAME_MAX_LENGTH = 10;
export const CHAT_GUEST_COOKIE_TTL_SECONDS = SERVER_COOKIE_DEFINITIONS.guestChat.maxAgeSeconds;
export const CHAT_SESSION_TTL_SECONDS = 60 * 5;

export type ChatViewerKind = "member" | "guest";
export type ChatFilterMode = "all" | "members_only";

export type ChatSessionViewer = {
  kind: ChatViewerKind;
  display_name: string;
  can_filter_guests: boolean;
  can_send: boolean;
  default_filter: ChatFilterMode;
};

export type ChatMessage = {
  id: string;
  author_kind: ChatViewerKind;
  author_name: string;
  text: string;
  sent_at: string;
};

export type ChatSessionResponse = {
  ws_url: string;
  viewer: ChatSessionViewer;
  expires_at: string;
};

export type ChatSendEvent = {
  type: "chat.send";
  client_id: string;
  text: string;
  guest_nickname?: string;
};

export type ChatFilterSetEvent = {
  type: "filter.set";
  value: ChatFilterMode;
};

export type ChatPingEvent = {
  type: "ping";
  ts: number;
};

/** Plaza presence: the viewer's ant appears where it stands, and each later floor click sends the new destination. */
export type AntEnterEvent = { type: "ant.enter"; x: number; z: number; room?: number };
export type AntMoveEvent = { type: "ant.move"; x: number; z: number };
export type AntLeaveEvent = { type: "ant.leave" };
/** Rooms are 0-based on the wire and shown from 1. */
export type AntSwitchRoomEvent = { type: "ant.switch"; room: number };

export type ChatClientEvent = ChatSendEvent | ChatFilterSetEvent | ChatPingEvent | AntEnterEvent | AntMoveEvent | AntLeaveEvent | AntSwitchRoomEvent;

export type ChatSessionReadyEvent = {
  type: "session.ready";
  viewer: ChatSessionViewer;
  recent: ChatMessage[];
  connections: number;
};

export type ChatMessageEvent = {
  type: "chat.message";
  message: ChatMessage;
  /** The author's plaza ant, when the author was standing on the plaza. */
  ant_id?: string;
};

export type ChatFilterUpdatedEvent = {
  type: "filter.updated";
  value: ChatFilterMode;
};

export type ChatPongEvent = {
  type: "pong";
  ts: number;
};

export type ChatPresenceCountEvent = {
  type: "presence.count";
  connections: number;
};

export type ChatSystemErrorEvent = {
  type: "system.error";
  code: string;
  message: string;
};

export type PlazaPeer = { id: string; name: string; x: number; z: number };

/** Sent to the viewer that entered the plaza: its room and the others already in it. */
export type AntRoomEvent = { type: "ant.room"; room: number; self: string; peers: PlazaPeer[] };
export type AntJoinEvent = { type: "ant.join"; ant: PlazaPeer };
export type AntMovedEvent = { type: "ant.move"; id: string; x: number; z: number };
export type AntLeftEvent = { type: "ant.leave"; id: string };
/** A refused plaza request (full room, too many room switches, bad input). */
export type AntErrorEvent = { type: "ant.error"; code: string; message: string };
export type AntServerEvent = AntRoomEvent | AntJoinEvent | AntMovedEvent | AntLeftEvent | AntErrorEvent;

export type ChatServerEvent =
  | AntServerEvent
  | ChatSessionReadyEvent
  | ChatMessageEvent
  | ChatFilterUpdatedEvent
  | ChatPongEvent
  | ChatPresenceCountEvent
  | ChatSystemErrorEvent;
