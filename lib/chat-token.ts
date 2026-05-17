import { randomUUID, timingSafeEqual, webcrypto } from "node:crypto";
import {
  CHAT_GUEST_COOKIE_TTL_SECONDS,
  CHAT_SESSION_TTL_SECONDS,
  type ChatViewerKind
} from "@/lib/chat-types";

const CHAT_JWT_HEADER = {
  alg: "HS256",
  typ: "JWT"
} as const;

const encoder = new TextEncoder();
const subtle = globalThis.crypto?.subtle ?? webcrypto.subtle;
const hmacKeyCache = new Map<string, Promise<CryptoKey>>();

type SignedPayload = {
  sub: string;
  kind: string;
  iat: number;
  exp: number;
};

export type ChatTokenPayload = SignedPayload & {
  kind: ChatViewerKind;
  display_name: string;
  can_filter_guests: boolean;
  can_send: boolean;
};

type GuestCookiePayload = SignedPayload & {
  kind: "guest_cookie";
};

const base64UrlEncode = (value: Uint8Array | string): string => {
  const buffer = typeof value === "string" ? Buffer.from(value, "utf8") : Buffer.from(value);
  return buffer.toString("base64url");
};

const base64UrlDecode = (value: string): string => {
  return Buffer.from(value, "base64url").toString("utf8");
};

const importHmacKey = (secret: string): Promise<CryptoKey> => {
  const cached = hmacKeyCache.get(secret);
  if (cached) {
    return cached;
  }

  const imported = subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  hmacKeyCache.set(secret, imported);
  imported.catch(() => {
    hmacKeyCache.delete(secret);
  });
  return imported;
};

const signEncodedToken = async (header: string, payload: string, secret: string): Promise<string> => {
  const key = await importHmacKey(secret);
  const signature = await subtle.sign("HMAC", key, encoder.encode(`${header}.${payload}`));
  return base64UrlEncode(new Uint8Array(signature));
};

const safeEqual = (left: string, right: string): boolean => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return timingSafeEqual(leftBuffer, rightBuffer);
};

const createSignedToken = async <T extends SignedPayload>(payload: T, secret: string): Promise<string> => {
  const encodedHeader = base64UrlEncode(JSON.stringify(CHAT_JWT_HEADER));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = await signEncodedToken(encodedHeader, encodedPayload, secret);
  return `${encodedHeader}.${encodedPayload}.${signature}`;
};

const verifySignedToken = async <T extends SignedPayload>(token: string, secret: string): Promise<T | null> => {
  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  if (!encodedHeader || !encodedPayload || !encodedSignature) {
    return null;
  }

  const expectedSignature = await signEncodedToken(encodedHeader, encodedPayload, secret);
  if (!safeEqual(expectedSignature, encodedSignature)) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as T;
    if (typeof payload.exp !== "number" || typeof payload.iat !== "number") {
      return null;
    }

    if (Date.now() >= payload.exp * 1000) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
};

const buildExpiry = (ttlSeconds: number): { issuedAt: number; expiresAt: number; expiresAtIso: string } => {
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + ttlSeconds;

  return {
    issuedAt,
    expiresAt,
    expiresAtIso: new Date(expiresAt * 1000).toISOString()
  };
};

export const buildGuestChatDisplayName = (guestId: string): string => {
  const suffix = guestId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 4).toUpperCase().padEnd(4, "0");
  return `익명-${suffix}`;
};

export const createGuestChatCookie = async (
  secret: string,
  ttlSeconds: number = CHAT_GUEST_COOKIE_TTL_SECONDS
): Promise<{
  guestId: string;
  value: string;
  expiresAt: string;
}> => {
  const guestId = randomUUID();
  const expiry = buildExpiry(ttlSeconds);
  const payload: GuestCookiePayload = {
    sub: guestId,
    kind: "guest_cookie",
    iat: expiry.issuedAt,
    exp: expiry.expiresAt
  };

  return {
    guestId,
    value: await createSignedToken(payload, secret),
    expiresAt: expiry.expiresAtIso
  };
};

export const readGuestChatCookie = async (
  token: string,
  secret: string
): Promise<{
  guestId: string;
  displayName: string;
} | null> => {
  if (!token) {
    return null;
  }

  const payload = await verifySignedToken<GuestCookiePayload>(token, secret);
  if (!payload || payload.kind !== "guest_cookie" || !payload.sub) {
    return null;
  }

  return {
    guestId: payload.sub,
    displayName: buildGuestChatDisplayName(payload.sub)
  };
};

export const createChatSessionToken = async (
  input: {
    subject: string;
    kind: ChatViewerKind;
    displayName: string;
    canFilterGuests: boolean;
    canSend: boolean;
  },
  secret: string,
  ttlSeconds: number = CHAT_SESSION_TTL_SECONDS
): Promise<{ token: string; expiresAt: string }> => {
  const expiry = buildExpiry(ttlSeconds);
  const payload: ChatTokenPayload = {
    sub: input.subject,
    kind: input.kind,
    display_name: input.displayName,
    can_filter_guests: input.canFilterGuests,
    can_send: input.canSend,
    iat: expiry.issuedAt,
    exp: expiry.expiresAt
  };

  return {
    token: await createSignedToken(payload, secret),
    expiresAt: expiry.expiresAtIso
  };
};

export const readChatSessionToken = async (token: string, secret: string): Promise<ChatTokenPayload | null> => {
  const payload = await verifySignedToken<ChatTokenPayload>(token, secret);
  if (!payload) {
    return null;
  }

  if (payload.kind !== "member" && payload.kind !== "guest") {
    return null;
  }

  if (
    typeof payload.display_name !== "string" ||
    typeof payload.can_filter_guests !== "boolean" ||
    typeof payload.can_send !== "boolean"
  ) {
    return null;
  }

  return payload;
};
