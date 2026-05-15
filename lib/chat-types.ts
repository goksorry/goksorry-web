import { SERVER_COOKIE_DEFINITIONS } from "@/lib/persistence-registry";

export const CHAT_DEFAULT_FILTER = "all" as const;
export const CHAT_RECENT_LIMIT = 30;
export const CHAT_MESSAGE_MAX_LENGTH = 300;
export const CHAT_GUEST_NICKNAME_MAX_LENGTH = 20;
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

export type ChatClientEvent = ChatSendEvent | ChatFilterSetEvent | ChatPingEvent;

export type ChatSessionReadyEvent = {
  type: "session.ready";
  viewer: ChatSessionViewer;
  recent: ChatMessage[];
  connections: number;
};

export type ChatMessageEvent = {
  type: "chat.message";
  message: ChatMessage;
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

export type ChatServerEvent =
  | ChatSessionReadyEvent
  | ChatMessageEvent
  | ChatFilterUpdatedEvent
  | ChatPongEvent
  | ChatPresenceCountEvent
  | ChatSystemErrorEvent;
