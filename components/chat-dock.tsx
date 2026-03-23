"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { LiveChat } from "@/components/live-chat";

const openChatWindow = () => {
  const url = new URL("/chat", window.location.origin).toString();
  window.open(
    url,
    "goksorry-chat-popup",
    "popup=yes,width=440,height=760,left=80,top=80,resizable=yes,scrollbars=yes"
  );
};

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
      <section
        id="global-chat-dock"
        className={`panel chat-dock-panel ${open ? "chat-dock-panel-open" : ""}`}
        aria-hidden={!open}
      >
        {open ? (
          <LiveChat
            enabled={enabled}
            className="chat-dock-live"
            headerActions={
              <button type="button" className="btn btn-secondary" onClick={openChatWindow}>
                작은 창
              </button>
            }
          />
        ) : null}
      </section>

      <button
        type="button"
        className={`chat-dock-toggle ${open ? "chat-dock-toggle-open" : ""}`}
        aria-expanded={open}
        aria-controls="global-chat-dock"
        onClick={() => setOpen((current) => !current)}
      >
        {open ? "채팅 닫기" : "실시간 채팅"}
      </button>
    </div>
  );
}
