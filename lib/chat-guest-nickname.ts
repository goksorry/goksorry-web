import { CHAT_GUEST_NICKNAME_MAX_LENGTH } from "@/lib/chat-types";

const ANGLE_BRACKET_PATTERN = /[<>]/;

export const normalizeGuestChatNickname = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized || normalized.length > CHAT_GUEST_NICKNAME_MAX_LENGTH) {
    return null;
  }

  if (ANGLE_BRACKET_PATTERN.test(normalized)) {
    return null;
  }

  return normalized;
};

export const cleanGuestChatNicknameInput = (value: string): string => {
  return value.replace(/\s+/g, " ").slice(0, CHAT_GUEST_NICKNAME_MAX_LENGTH);
};
