"use client";

import {
  startTransition,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import {
  CHAT_MESSAGE_MAX_LENGTH,
  CHAT_GUEST_NICKNAME_MAX_LENGTH,
  CHAT_RECENT_LIMIT,
  type ChatClientEvent,
  type ChatMessage,
  type ChatServerEvent,
  type ChatSessionResponse,
  type ChatSessionViewer
} from "@/lib/chat-types";
import { cleanGuestChatNicknameInput, normalizeGuestChatNickname } from "@/lib/chat-guest-nickname";
import {
  readClientCookieValue,
  removeClientCookie,
  writeClientCookieValue
} from "@/lib/browser-persistence";
import { CLIENT_PERSISTENCE_DEFINITIONS } from "@/lib/persistence-registry";

type ConnectionState = "idle" | "connecting" | "open" | "reconnecting" | "error";

type LiveChatProps = {
  enabled: boolean;
  className?: string;
  title?: string;
  headerActions?: ReactNode;
};

const SEND_COOLDOWN_MS = 500;

const statusLabel: Record<ConnectionState, string> = {
  idle: "대기 중",
  connecting: "연결 중",
  open: "실시간 연결됨",
  reconnecting: "재연결 중",
  error: "연결 오류"
};

const mergeMessages = (current: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] => {
  const byId = new Map<string, ChatMessage>();

  for (const message of current) {
    byId.set(message.id, message);
  }

  for (const message of incoming) {
    byId.set(message.id, message);
  }

  return [...byId.values()]
    .sort((left, right) => left.sent_at.localeCompare(right.sent_at))
    .slice(-CHAT_RECENT_LIMIT);
};

const formatTime = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "--:--";
  }

  const now = new Date();
  const sameDay =
    now.getFullYear() === date.getFullYear() && now.getMonth() === date.getMonth() && now.getDate() === date.getDate();

  return new Intl.DateTimeFormat("ko-KR", {
    ...(sameDay ? {} : { month: "numeric", day: "numeric" }),
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
};

const isScrolledToBottom = (element: HTMLDivElement | null): boolean => {
  if (!element) {
    return true;
  }

  return element.scrollHeight - element.scrollTop - element.clientHeight <= 24;
};

export function LiveChat({ enabled, className, title = "전체 채팅", headerActions = null }: LiveChatProps) {
  const [viewer, setViewer] = useState<ChatSessionViewer | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [connectionCount, setConnectionCount] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [guestNickname, setGuestNickname] = useState("");
  const [guestNicknameReady, setGuestNicknameReady] = useState(false);
  const [notice, setNotice] = useState<string | null>(enabled ? null : "채팅 설정이 아직 배포되지 않았습니다.");
  const [state, setState] = useState<ConnectionState>(enabled ? "connecting" : "idle");
  const [cooldownRemainingMs, setCooldownRemainingMs] = useState(0);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const reconnectAttemptRef = useRef(0);
  const shouldReconnectRef = useRef(enabled);
  const logRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = useRef(true);
  const guestNicknameRef = useRef("");

  const applyViewer = (nextViewer: ChatSessionViewer) => {
    setViewer(nextViewer);
    if (nextViewer.kind !== "guest") {
      return;
    }

    setGuestNickname((current) => (current.trim() ? current : nextViewer.display_name));
  };

  useEffect(() => {
    if (cooldownRemainingMs <= 0) {
      return;
    }

    const startedAt = Date.now();
    const timer = window.setTimeout(() => {
      setCooldownRemainingMs((current) => Math.max(0, current - (Date.now() - startedAt)));
    }, 40);

    return () => {
      window.clearTimeout(timer);
    };
  }, [cooldownRemainingMs]);

  useEffect(() => {
    const storedNickname = normalizeGuestChatNickname(
      readClientCookieValue(CLIENT_PERSISTENCE_DEFINITIONS.guestChatNickname)
    );
    if (storedNickname) {
      setGuestNickname(storedNickname);
      guestNicknameRef.current = storedNickname;
    }
    setGuestNicknameReady(true);
  }, []);

  useEffect(() => {
    guestNicknameRef.current = guestNickname;
  }, [guestNickname]);

  useEffect(() => {
    if (!enabled || !guestNicknameReady) {
      return;
    }

    let cancelled = false;
    shouldReconnectRef.current = true;

    const clearReconnectTimer = () => {
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    const scheduleReconnect = (delayMs: number) => {
      clearReconnectTimer();
      if (cancelled || !shouldReconnectRef.current) {
        return;
      }

      reconnectTimerRef.current = window.setTimeout(() => {
        reconnectTimerRef.current = null;
        void connect("reconnecting");
      }, delayMs);
    };

    const connect = async (nextState: ConnectionState) => {
      if (cancelled) {
        return;
      }

      setState(nextState);

      try {
        const response = await fetch("/api/chat/session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            guest_nickname: normalizeGuestChatNickname(guestNicknameRef.current) ?? undefined
          })
        });

        const payload = (await response.json().catch(() => ({}))) as Partial<ChatSessionResponse> & {
          error?: string;
        };

        if (!response.ok || !payload.ws_url || !payload.viewer) {
          throw new Error(payload.error ?? "채팅 세션을 만들지 못했습니다.");
        }

        if (cancelled) {
          return;
        }

        setNotice(null);
        applyViewer(payload.viewer);

        const socket = new WebSocket(payload.ws_url);
        socketRef.current = socket;

        socket.onopen = () => {
          reconnectAttemptRef.current = 0;
          setState("open");
        };

        socket.onmessage = (event) => {
          let serverEvent: ChatServerEvent;
          try {
            serverEvent = JSON.parse(String(event.data)) as ChatServerEvent;
          } catch {
            return;
          }

          if (serverEvent.type === "session.ready") {
            applyViewer(serverEvent.viewer);
            setConnectionCount(serverEvent.connections);
            startTransition(() => {
              setMessages((current) => mergeMessages(current, serverEvent.recent));
            });

            return;
          }

          if (serverEvent.type === "presence.count") {
            setConnectionCount(serverEvent.connections);
            return;
          }

          if (serverEvent.type === "chat.message") {
            startTransition(() => {
              setMessages((current) => mergeMessages(current, [serverEvent.message]));
            });
            return;
          }

          if (serverEvent.type === "system.error") {
            setNotice(serverEvent.message);
          }
        };

        socket.onerror = () => {
          setNotice("채팅 연결에 문제가 발생했습니다.");
        };

        socket.onclose = () => {
          if (socketRef.current === socket) {
            socketRef.current = null;
          }

          if (cancelled || !shouldReconnectRef.current) {
            return;
          }

          reconnectAttemptRef.current += 1;
          setState("reconnecting");
          scheduleReconnect(Math.min(5000, 1000 * reconnectAttemptRef.current));
        };
      } catch (error) {
        if (cancelled) {
          return;
        }

        reconnectAttemptRef.current += 1;
        setState("error");
        setNotice(error instanceof Error ? error.message : "채팅 연결을 준비하지 못했습니다.");
        scheduleReconnect(Math.min(10000, 1500 * reconnectAttemptRef.current));
      }
    };

    void connect("connecting");

    return () => {
      cancelled = true;
      shouldReconnectRef.current = false;
      clearReconnectTimer();

      const socket = socketRef.current;
      socketRef.current = null;
      socket?.close();
    };
  }, [enabled, guestNicknameReady]);

  useEffect(() => {
    if (!stickToBottomRef.current) {
      return;
    }

    const log = logRef.current;
    if (!log) {
      return;
    }

    log.scrollTop = log.scrollHeight;
  }, [messages]);

  const normalizedGuestNickname = viewer?.kind === "guest" ? normalizeGuestChatNickname(guestNickname) : null;
  const guestNicknameInvalid = viewer?.kind === "guest" && guestNickname.trim().length > 0 && !normalizedGuestNickname;
  const canSend =
    state === "open" && Boolean(viewer?.can_send) && (viewer?.kind !== "guest" || Boolean(normalizedGuestNickname));
  const submitDisabled = !canSend || draft.trim().length === 0 || cooldownRemainingMs > 0;
  const cooldownProgressStyle = useMemo(() => {
    const progress = ((SEND_COOLDOWN_MS - cooldownRemainingMs) / SEND_COOLDOWN_MS) * 360;
    return {
      "--chat-send-progress": `${Math.max(0, Math.min(360, progress))}deg`
    } as CSSProperties;
  }, [cooldownRemainingMs]);

  const submitMessage = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!viewer?.can_send) {
      setNotice("채팅에 참여할 수 없습니다.");
      return;
    }

    if (viewer.kind === "guest" && !normalizedGuestNickname) {
      setNotice("비회원 닉네임을 입력하세요.");
      return;
    }

    if (cooldownRemainingMs > 0) {
      return;
    }

    const normalizedDraft = draft.replace(/\r\n?/g, "\n").trim();
    if (!normalizedDraft) {
      return;
    }

    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setNotice("채팅이 아직 연결되지 않았습니다.");
      return;
    }

    const nextEvent: ChatClientEvent = {
      type: "chat.send",
      client_id: crypto.randomUUID(),
      text: normalizedDraft,
      ...(viewer.kind === "guest" && normalizedGuestNickname ? { guest_nickname: normalizedGuestNickname } : {})
    };

    if (viewer.kind === "guest" && normalizedGuestNickname) {
      writeClientCookieValue(CLIENT_PERSISTENCE_DEFINITIONS.guestChatNickname, normalizedGuestNickname);
    }

    socket.send(JSON.stringify(nextEvent));
    setDraft("");
    setCooldownRemainingMs(SEND_COOLDOWN_MS);
  };

  const handleGuestNicknameChange = (value: string) => {
    const nextValue = cleanGuestChatNicknameInput(value);
    setGuestNickname(nextValue);

    const normalized = normalizeGuestChatNickname(nextValue);
    if (normalized) {
      writeClientCookieValue(CLIENT_PERSISTENCE_DEFINITIONS.guestChatNickname, normalized);
      return;
    }

    if (!nextValue.trim()) {
      removeClientCookie(CLIENT_PERSISTENCE_DEFINITIONS.guestChatNickname);
    }
  };

  return (
    <section className={className ? `chat-shell ${className}` : "chat-shell"}>
      <div className="chat-toolbar">
        <div className="chat-toolbar-main">
          <h2>{title}</h2>
          <span className={`tag chat-status-tag ${state === "open" ? "chat-status-live" : ""}`}>{statusLabel[state]}</span>
          {connectionCount !== null ? <span className="muted chat-presence-count">{connectionCount}명 접속</span> : null}
        </div>
        {headerActions ? <div className="chat-toolbar-actions">{headerActions}</div> : null}
      </div>

      {notice ? <p className="muted chat-notice">{notice}</p> : null}

      <div
        ref={logRef}
        className="chat-log"
        aria-live="polite"
        onScroll={(event) => {
          stickToBottomRef.current = isScrolledToBottom(event.currentTarget);
        }}
      >
        {messages.length === 0 ? <p className="muted chat-empty">아직 메시지가 없습니다.</p> : null}

        {messages.map((message) => (
          <article
            key={message.id}
            className={`chat-message ${message.author_kind === "member" ? "chat-message-member" : "chat-message-guest"}`}
          >
            <div className="chat-message-meta">
              <strong>
                {message.author_name}
                {message.author_kind === "guest" ? (
                  <span className="chat-guest-marker" aria-label="비회원">
                    *
                  </span>
                ) : null}
              </strong>
              <span className="muted">{formatTime(message.sent_at)}</span>
            </div>
            <p>{message.text}</p>
          </article>
        ))}

      </div>

      <form className="chat-form" onSubmit={submitMessage}>
        {viewer?.kind === "guest" ? (
          <label className="chat-nickname-wrap">
            <span className="chat-field-label">닉네임</span>
            <input
              type="text"
              value={guestNickname}
              onChange={(event) => handleGuestNicknameChange(event.target.value)}
              maxLength={CHAT_GUEST_NICKNAME_MAX_LENGTH}
              placeholder="닉네임"
              autoComplete="nickname"
              aria-invalid={guestNicknameInvalid}
            />
          </label>
        ) : null}
        <label className="chat-input-wrap">
          <span className="sr-only">메시지 입력</span>
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) {
                return;
              }

              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }}
            maxLength={CHAT_MESSAGE_MAX_LENGTH}
            rows={3}
            placeholder={viewer?.can_send ? "메시지를 입력하세요." : "채팅에 참여할 수 없습니다."}
            disabled={state !== "open" || !viewer?.can_send}
          />
        </label>
        <div className="chat-form-footer">
          <span className="muted">
            최근 {CHAT_RECENT_LIMIT}개만 유지 · {draft.length}/{CHAT_MESSAGE_MAX_LENGTH}
          </span>
          <div className="chat-submit-group">
            <button type="submit" disabled={submitDisabled}>
              {cooldownRemainingMs > 0 ? (
                <>
                  <span className="chat-send-spinner" aria-hidden="true" style={cooldownProgressStyle} />
                  대기
                </>
              ) : (
                "보내기"
              )}
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}
