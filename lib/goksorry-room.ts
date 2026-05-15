import "server-only";

import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { NextResponse } from "next/server";
import { getCompletedProfileForUser, getUserFromAuthorization, isAdminEmail, type AppAuthUser } from "@/lib/auth-server";
import { getServerEnv } from "@/lib/env";
import { SERVER_COOKIE_DEFINITIONS } from "@/lib/persistence-registry";

export const GOKSORRY_ROOM_ENTRY_MAX_LENGTH = 160;
export const GOKSORRY_ROOM_REPLY_MAX_LENGTH = 300;
export const GOKSORRY_ROOM_DEFAULT_LIMIT = 50;
export const GOKSORRY_ROOM_MAX_LIMIT = 100;
export const GOKSORRY_ROOM_GUEST_LABEL = "익명";

type GoksorryRoomActor =
  | {
      kind: "member";
      id: string;
      label: string;
      isAdmin: boolean;
      guestOwnerHash: null;
      cookie: null;
    }
  | {
      kind: "guest";
      id: null;
      label: typeof GOKSORRY_ROOM_GUEST_LABEL;
      isAdmin: false;
      guestOwnerHash: string;
      cookie: { value: string; maxAgeSeconds: number } | null;
    };

type MaybeActor = {
  user: AppAuthUser | null;
  actor: GoksorryRoomActor | null;
};

const encoder = new TextEncoder();

const safeDecodeCookieValue = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return "";
  }
};

const readCookieValue = (request: Request, name: string): string => {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookieMatch = cookieHeader.match(new RegExp(`(?:^|; )${name}=([^;]+)`));
  return cookieMatch?.[1] ? safeDecodeCookieValue(cookieMatch[1]) : "";
};

const signOwnerId = (ownerId: string): string => {
  return createHmac("sha256", getServerEnv().NEXTAUTH_SECRET).update(ownerId).digest("base64url");
};

const createOwnerToken = (ownerId: string): string => {
  return `${ownerId}.${signOwnerId(ownerId)}`;
};

const readOwnerIdFromToken = (token: string): string | null => {
  const [ownerId, signature] = token.split(".");
  if (!ownerId || !signature) {
    return null;
  }

  const expected = signOwnerId(ownerId);
  const left = encoder.encode(signature);
  const right = encoder.encode(expected);
  if (left.length !== right.length) {
    return null;
  }

  return timingSafeEqual(left, right) ? ownerId : null;
};

const hashGuestOwnerId = (ownerId: string): string => {
  return createHmac("sha256", getServerEnv().NEXTAUTH_SECRET)
    .update(`goksorry-room:${ownerId}`)
    .digest("hex");
};

export const setGoksorryRoomGuestCookie = (
  response: NextResponse,
  cookie: { value: string; maxAgeSeconds: number } | null
) => {
  if (!cookie) {
    return;
  }

  response.cookies.set({
    name: SERVER_COOKIE_DEFINITIONS.goksorryRoomGuest.key,
    value: cookie.value,
    httpOnly: SERVER_COOKIE_DEFINITIONS.goksorryRoomGuest.httpOnly,
    sameSite: SERVER_COOKIE_DEFINITIONS.goksorryRoomGuest.sameSite.toLowerCase() as "lax",
    secure: process.env.NODE_ENV === "production",
    path: SERVER_COOKIE_DEFINITIONS.goksorryRoomGuest.path,
    maxAge: cookie.maxAgeSeconds
  });
};

export const resolveExistingGoksorryRoomActor = async (request: Request): Promise<MaybeActor> => {
  const user = await getUserFromAuthorization(request);
  if (user) {
    const profile = await getCompletedProfileForUser(user);
    if (profile) {
      return {
        user,
        actor: {
          kind: "member",
          id: profile.id,
          label: profile.nickname,
          isAdmin: profile.role === "admin" || isAdminEmail(user.email),
          guestOwnerHash: null,
          cookie: null
        }
      };
    }

    return { user, actor: null };
  }

  const cookieValue = readCookieValue(request, SERVER_COOKIE_DEFINITIONS.goksorryRoomGuest.key);
  const ownerId = cookieValue ? readOwnerIdFromToken(cookieValue) : null;
  if (!ownerId) {
    return { user: null, actor: null };
  }

  return {
    user: null,
    actor: {
      kind: "guest",
      id: null,
      label: GOKSORRY_ROOM_GUEST_LABEL,
      isAdmin: false,
      guestOwnerHash: hashGuestOwnerId(ownerId),
      cookie: null
    }
  };
};

export const resolveWritableGoksorryRoomActor = async (
  request: Request
): Promise<MaybeActor> => {
  const resolved = await resolveExistingGoksorryRoomActor(request);
  if (resolved.actor) {
    return {
      user: resolved.user,
      actor: resolved.actor
    };
  }

  if (resolved.user) {
    return {
      user: resolved.user,
      actor: null
    };
  }

  const ownerId = randomUUID();
  const token = createOwnerToken(ownerId);
  return {
    user: null,
    actor: {
      kind: "guest",
      id: null,
      label: GOKSORRY_ROOM_GUEST_LABEL,
      isAdmin: false,
      guestOwnerHash: hashGuestOwnerId(ownerId),
      cookie: {
        value: token,
        maxAgeSeconds: SERVER_COOKIE_DEFINITIONS.goksorryRoomGuest.maxAgeSeconds
      }
    }
  };
};

export const canManageGoksorryRoomItem = (
  actor: GoksorryRoomActor | null,
  item: { author_kind: string | null; author_id: string | null; guest_owner_hash: string | null }
): boolean => {
  if (!actor) {
    return false;
  }

  if (actor.isAdmin) {
    return true;
  }

  if (actor.kind === "member") {
    return item.author_kind === "member" && item.author_id === actor.id;
  }

  return item.author_kind === "guest" && Boolean(item.guest_owner_hash) && item.guest_owner_hash === actor.guestOwnerHash;
};
