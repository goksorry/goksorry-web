/** Bridges the viewer's own sent chat lines (layout tree) to the world page (page tree). */
const OWN_CHAT_MESSAGE_EVENT = "goksorry:chat-own-message";

export const emitOwnChatMessage = (text: string) => {
  window.dispatchEvent(new CustomEvent<string>(OWN_CHAT_MESSAGE_EVENT, { detail: text }));
};

export const onOwnChatMessage = (listener: (text: string) => void) => {
  const handle = (event: Event) => listener((event as CustomEvent<string>).detail);
  window.addEventListener(OWN_CHAT_MESSAGE_EVENT, handle);
  return () => window.removeEventListener(OWN_CHAT_MESSAGE_EVENT, handle);
};
