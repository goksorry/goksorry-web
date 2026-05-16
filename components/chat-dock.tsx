"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { LiveChat } from "@/components/live-chat";
import { useMediaQuery } from "@/components/use-media-query";
import { useSessionSnapshot } from "@/components/use-session-snapshot";

export function ChatDock({ enabled }: { enabled: boolean }) {
  const pathname = usePathname();
  const { user } = useSessionSnapshot();
  const isMobileChatViewport = useMediaQuery("(max-width: 900px)");
  const [open, setOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  if (isMobileChatViewport !== true || !enabled || pathname === "/chat" || user?.profile_setup_required) {
    return null;
  }

  return (
    <div className="chat-dock-shell">
      {hasOpened ? (
        <section
          id="global-chat-dock"
          className={`panel chat-dock-panel ${open ? "chat-dock-panel-open" : ""}`}
          aria-hidden={!open}
        >
          <LiveChat
            enabled={enabled}
            className="chat-dock-live"
            headerActions={
              <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>
                채팅 닫기
              </button>
            }
          />
        </section>
      ) : null}

      {!open ? (
        <button
          type="button"
          className="chat-dock-toggle"
          aria-expanded={open}
          aria-controls="global-chat-dock"
          onClick={() => {
            setHasOpened(true);
            setOpen(true);
          }}
        >
          실시간 채팅
        </button>
      ) : null}
    </div>
  );
}
