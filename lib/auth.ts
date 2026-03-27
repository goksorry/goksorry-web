import "server-only";

import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import type { JWT } from "next-auth/jwt";
import { getServerEnv } from "@/lib/env";
import {
  ACCOUNT_REJOIN_COOLDOWN_DAYS,
  buildNickname,
  buildStableProfileId,
  findProfileByIdentity,
  getProfileSetupState,
  getWithdrawalHoldUntil,
  isAdminEmail,
  type SyncedProfile
} from "@/lib/profile-sync";

const applyProfileToToken = (token: JWT, profile: SyncedProfile | null): JWT => {
  if (!profile) {
    return token;
  }

  token.email = profile.email;
  token.name = profile.nickname;
  token.appUserId = profile.id;
  token.role = profile.role;
  token.nickname = profile.nickname;
  token.profileCreatedAt = profile.created_at;
  token.nicknameConfirmedAt = profile.nickname_confirmed_at;
  token.nicknameChangedAt = profile.nickname_changed_at;
  token.profileSetupRequired = getProfileSetupState(profile).needs_setup;
  return token;
};

const seedTokenIdentity = (
  token: JWT,
  user?: {
    email?: string | null;
    name?: string | null;
  }
): JWT => {
  const email = String(user?.email ?? token.email ?? "").trim().toLowerCase();
  if (!email) {
    return token;
  }

  token.email = email;
  token.name = user?.name ?? (typeof token.name === "string" ? token.name : null);
  token.nickname =
    typeof token.nickname === "string" && token.nickname.trim()
      ? token.nickname
      : buildNickname(email, user?.name ?? (typeof token.name === "string" ? token.name : null));
  token.role = token.role === "admin" || isAdminEmail(email) ? "admin" : "user";
  token.appUserId = typeof token.appUserId === "string" && token.appUserId.trim() ? token.appUserId : buildStableProfileId(email);
  token.profileCreatedAt =
    typeof token.profileCreatedAt === "string" && token.profileCreatedAt.trim()
      ? token.profileCreatedAt
      : new Date().toISOString();
  token.nicknameConfirmedAt =
    typeof token.nicknameConfirmedAt === "string" && token.nicknameConfirmedAt.trim()
      ? token.nicknameConfirmedAt
      : null;
  token.nicknameChangedAt =
    typeof token.nicknameChangedAt === "string" && token.nicknameChangedAt.trim()
      ? token.nicknameChangedAt
      : null;
  token.profileSetupRequired = token.profileSetupRequired === false ? false : true;
  return token;
};

export const authOptions: NextAuthOptions = {
  secret: getServerEnv().NEXTAUTH_SECRET,
  session: {
    strategy: "jwt"
  },
  pages: {
    signIn: "/auth/login"
  },
  providers: [
    GoogleProvider({
      clientId: getServerEnv().GOOGLE_CLIENT_ID,
      clientSecret: getServerEnv().GOOGLE_CLIENT_SECRET
    })
  ],
  callbacks: {
    async signIn({ user }) {
      const email = String(user.email ?? "").trim().toLowerCase();
      if (!email) {
        return false;
      }

      try {
        const holdUntil = await getWithdrawalHoldUntil(email);
        if (holdUntil) {
          return `/auth/login?error=withdrawn&days=${ACCOUNT_REJOIN_COOLDOWN_DAYS}&until=${encodeURIComponent(holdUntil)}`;
        }
      } catch (error) {
        console.error("withdrawn account lookup failed during sign-in", error);
        return "/auth/login?error=unavailable";
      }

      return true;
    },
    async jwt({ token, user }) {
      const seededToken = seedTokenIdentity(token, user);

      const profileFromDb = await findProfileByIdentity({
        id: typeof seededToken.appUserId === "string" ? seededToken.appUserId : null,
        email: typeof seededToken.email === "string" ? seededToken.email : null
      });

      if (profileFromDb) {
        return applyProfileToToken(seededToken, profileFromDb);
      }

      return seededToken;
    },
    async session({ session, token }) {
      if (!session.user) {
        return session;
      }

      session.user.id = String(token.appUserId ?? "");
      session.user.role = token.role === "admin" ? "admin" : "user";
      session.user.nickname = typeof token.nickname === "string" ? token.nickname : null;
      session.user.created_at =
        typeof token.profileCreatedAt === "string" ? token.profileCreatedAt : new Date().toISOString();
      session.user.nickname_confirmed_at =
        typeof token.nicknameConfirmedAt === "string" ? token.nicknameConfirmedAt : null;
      session.user.nickname_changed_at = typeof token.nicknameChangedAt === "string" ? token.nicknameChangedAt : null;
      session.user.profile_setup_required = Boolean(token.profileSetupRequired);
      session.user.name = typeof token.name === "string" ? token.name : session.user.name ?? null;
      session.user.email = typeof token.email === "string" ? token.email : session.user.email ?? null;
      return session;
    }
  }
};
