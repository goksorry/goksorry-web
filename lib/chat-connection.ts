"use client";

// One chat socket per tab, shared by every chat view (sidebar, dock, /chat) and the world plaza's presence.
// Users acquire it and release it; the socket opens with the first user and closes shortly after the last one leaves.
import { readClientCookieValue } from "@/lib/browser-persistence";
import { normalizeGuestChatNickname } from "@/lib/chat-guest-nickname";
import {
  CHAT_RECENT_LIMIT,
  type ChatClientEvent,
  type ChatMessage,
  type ChatServerEvent,
  type ChatSessionResponse,
  type ChatSessionViewer
} from "@/lib/chat-types";
import { CLIENT_PERSISTENCE_DEFINITIONS } from "@/lib/persistence-registry";

export type ChatConnectionState = "idle" | "connecting" | "open" | "reconnecting" | "error";

export type ChatConnectionSnapshot = {
  state: ChatConnectionState;
  viewer: ChatSessionViewer | null;
  messages: ChatMessage[];
  connections: number | null;
  notice: string | null;
};

/** Releases within this window keep the socket: a remount (route change, strict mode) does not reconnect. */
const RELEASE_GRACE_MS = 2_000;
/** Session answers that a retry cannot change: chat is not deployed, or this viewer may not join yet. */
const TERMINAL_STATUSES = new Set([403, 503]);

class TerminalSessionError extends Error {}

export const mergeChatMessages = (current: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] => {
  const byId = new Map<string, ChatMessage>();
  for (const message of current) byId.set(message.id, message);
  for (const message of incoming) byId.set(message.id, message);
  return [...byId.values()].sort((left, right) => left.sent_at.localeCompare(right.sent_at)).slice(-CHAT_RECENT_LIMIT);
};

const INITIAL: ChatConnectionSnapshot = { state: "idle", viewer: null, messages: [], connections: null, notice: null };

let snapshot = INITIAL;
let users = 0;
let socket: WebSocket | null = null;
let generation = 0; // bumped on every disconnect, so stale async work from an older socket stops
let attempt = 0;
let reconnectTimer: number | null = null;
let releaseTimer: number | null = null;
const listeners = new Set<() => void>();
const eventListeners = new Set<(event: ChatServerEvent) => void>();
const openListeners = new Set<() => void>();

const update = (patch: Partial<ChatConnectionSnapshot>) => {
  snapshot = { ...snapshot, ...patch };
  for (const listener of listeners) listener();
};

const clearTimer = (timer: number | null) => {
  if (timer !== null) window.clearTimeout(timer);
  return null;
};

const scheduleReconnect = (delayMs: number) => {
  reconnectTimer = clearTimer(reconnectTimer);
  const current = generation;
  reconnectTimer = window.setTimeout(() => {
    reconnectTimer = null;
    if (current === generation) void connect("reconnecting");
  }, delayMs);
};

const handleServerEvent = (event: ChatServerEvent) => {
  if (event.type === "session.ready") {
    // Reconnect must not resurrect messages removed while the client was offline.
    update({ viewer: event.viewer, connections: event.connections, messages: mergeChatMessages([], event.recent) });
  } else if (event.type === "presence.count") {
    update({ connections: event.connections });
  } else if (event.type === "chat.message") {
    update({ messages: mergeChatMessages(snapshot.messages, [event.message]) });
  } else if (event.type === "chat.removed") {
    const removed = new Set(event.ids);
    update({ messages: snapshot.messages.filter((message) => !removed.has(message.id)) });
  } else if (event.type === "system.error") {
    update({ notice: event.message });
  }

  for (const listener of eventListeners) listener(event);
};

async function connect(nextState: ChatConnectionState) {
  const current = generation;
  update({ state: nextState });

  try {
    const response = await fetch("/api/chat/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        guest_nickname: normalizeGuestChatNickname(readClientCookieValue(CLIENT_PERSISTENCE_DEFINITIONS.guestChatNickname)) ?? undefined
      })
    });
    const payload = (await response.json().catch(() => ({}))) as Partial<ChatSessionResponse> & { error?: string };

    if (!response.ok || !payload.ws_url || !payload.viewer) {
      const message = payload.error ?? "채팅 세션을 만들지 못했습니다.";
      throw TERMINAL_STATUSES.has(response.status) ? new TerminalSessionError(message) : new Error(message);
    }

    if (current !== generation) return;
    update({ notice: null, viewer: payload.viewer });

    const next = new WebSocket(payload.ws_url);
    socket = next;

    next.onopen = () => {
      if (socket !== next) return;
      attempt = 0;
      update({ state: "open" });
      for (const listener of openListeners) listener();
    };

    next.onmessage = (event) => {
      if (socket !== next) return;
      let serverEvent: ChatServerEvent;
      try {
        serverEvent = JSON.parse(String(event.data)) as ChatServerEvent;
      } catch {
        return;
      }
      handleServerEvent(serverEvent);
    };

    next.onerror = () => {
      if (socket === next) update({ notice: "채팅 연결에 문제가 발생했습니다." });
    };

    next.onclose = () => {
      if (socket !== next) return;
      socket = null;
      attempt += 1;
      update({ state: "reconnecting" });
      scheduleReconnect(Math.min(5000, 1000 * attempt));
    };
  } catch (error) {
    if (current !== generation) return;
    attempt += 1;
    update({ state: "error", notice: error instanceof Error ? error.message : "채팅 연결을 준비하지 못했습니다." });
    if (!(error instanceof TerminalSessionError)) scheduleReconnect(Math.min(10000, 1500 * attempt));
  }
}

const disconnect = () => {
  generation += 1;
  reconnectTimer = clearTimer(reconnectTimer);
  const closing = socket;
  socket = null;
  closing?.close();
  attempt = 0;
  update({ state: "idle" });
};

export const chatConnection = {
  getSnapshot: (): ChatConnectionSnapshot => snapshot,
  getServerSnapshot: (): ChatConnectionSnapshot => INITIAL,

  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  /** Every server event, after the snapshot has taken it in. */
  onEvent(listener: (event: ChatServerEvent) => void) {
    eventListeners.add(listener);
    return () => {
      eventListeners.delete(listener);
    };
  },

  /** Each time a socket opens (first connect and every reconnect). */
  onOpen(listener: () => void) {
    openListeners.add(listener);
    return () => {
      openListeners.delete(listener);
    };
  },

  isOpen: () => socket?.readyState === WebSocket.OPEN,

  /** Keeps the socket open until the returned release is called. */
  acquire(): () => void {
    users += 1;
    releaseTimer = clearTimer(releaseTimer);
    if (!socket && snapshot.state === "idle") void connect("connecting");

    let released = false;
    return () => {
      if (released) return;
      released = true;
      users -= 1;
      if (users > 0) return;
      releaseTimer = clearTimer(releaseTimer);
      releaseTimer = window.setTimeout(() => {
        releaseTimer = null;
        if (users === 0) disconnect();
      }, RELEASE_GRACE_MS);
    };
  },

  send(event: ChatClientEvent): boolean {
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    socket.send(JSON.stringify(event));
    return true;
  },

  setNotice(notice: string | null) {
    update({ notice });
  }
};
