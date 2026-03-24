"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { LiveChat } from "@/components/live-chat";

export function ChatDock({ enabled }: { enabled: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  if (!enabled || pathname === "/chat") {
    return null;
  }

  return (
    <div className="chat-dock-shell">
      {open ? (
        <section id="global-chat-dock" className="panel chat-dock-panel chat-dock-panel-open" aria-hidden={false}>
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
      ) : (
        <button
          type="button"
          className="chat-dock-toggle"
          aria-expanded={false}
          aria-controls="global-chat-dock"
          onClick={() => setOpen(true)}
        >
          실시간 채팅
        </button>
      )}
    </div>
  );
}
