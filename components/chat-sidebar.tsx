"use client";

import { useEffect, useId, useState } from "react";
import { usePathname } from "next/navigation";
import { readClientLocalStorageValue, writeClientLocalStorageValue } from "@/lib/browser-persistence";
import { CLIENT_PERSISTENCE_DEFINITIONS } from "@/lib/persistence-registry";
import { LiveChat } from "@/components/live-chat";
import { useMediaQuery } from "@/components/use-media-query";
import { useSessionSnapshot } from "@/components/use-session-snapshot";

const CHAT_SIDEBAR_OPEN_VALUE = "open";
const CHAT_SIDEBAR_COLLAPSED_VALUE = "collapsed";

export function ChatSidebar({ enabled }: { enabled: boolean }) {
  const pathname = usePathname();
  const { user } = useSessionSnapshot();
  const isDesktop = useMediaQuery("(min-width: 901px)");
  const panelId = useId();
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const storedState = readClientLocalStorageValue(CLIENT_PERSISTENCE_DEFINITIONS.chatSidebarState);
    if (storedState === CHAT_SIDEBAR_COLLAPSED_VALUE) {
      setOpen(false);
      return;
    }

    if (storedState === CHAT_SIDEBAR_OPEN_VALUE) {
      setOpen(true);
    }
  }, []);

  const toggleOpen = () => {
    setOpen((current) => {
      const nextOpen = !current;
      writeClientLocalStorageValue(
        CLIENT_PERSISTENCE_DEFINITIONS.chatSidebarState,
        nextOpen ? CHAT_SIDEBAR_OPEN_VALUE : CHAT_SIDEBAR_COLLAPSED_VALUE
      );
      return nextOpen;
    });
  };

  if (isDesktop !== true || !enabled || pathname === "/chat" || user?.profile_setup_required) {
    return null;
  }

  return (
    <aside
      className={`chat-sidebar-shell ${open ? "chat-sidebar-shell-open" : "chat-sidebar-shell-collapsed"}`}
      data-testid="desktop-chat-sidebar"
      data-state={open ? "open" : "collapsed"}
    >
      <button
        type="button"
        className="chat-sidebar-rail"
        aria-label={open ? "채팅 사이드바 닫기" : "채팅 사이드바 열기"}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={toggleOpen}
      >
        <span aria-hidden="true">{open ? ">" : "<"}</span>
      </button>
      {open ? (
        <div id={panelId} className="chat-sidebar-panel">
          <LiveChat enabled={enabled} className="chat-sidebar-live" />
        </div>
      ) : null}
    </aside>
  );
}
