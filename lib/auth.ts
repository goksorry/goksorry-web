import "server-only";

import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import type { JWT } from "next-auth/jwt";
import { getServerEnv } from "@/lib/env";
import {
  ACCOUNT_REJOIN_COOLDOWN_DAYS,
  buildLegacyProfileIdFromEmail,
  buildNickname,
  buildStableProfileIdFromGoogleSub,
  findProfileByIdentity,
  getProfileSetupState,
  getWithdrawalHoldUntil,
  isAdminEmail,
  normalizeGoogleSub,
  syncProfileIdentity,
  type SyncedProfile
} from "@/lib/profile-sync";

const applyProfileToToken = (token: JWT, profile: SyncedProfile | null): JWT => {
  if (!profile) {
    return token;
  }

  token.email = profile.email;
  token.googleSub = profile.google_sub;
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
    googleSub?: string | null;
  }
): JWT => {
  const email = String(user?.email ?? token.email ?? "").trim().toLowerCase();
  const googleSub = (() => {
    const value = user?.googleSub ?? (typeof token.googleSub === "string" ? token.googleSub : null);
    return typeof value === "string" && value.trim() ? normalizeGoogleSub(value) : null;
  })();

  if (!email && !googleSub) {
    return token;
  }

  const nicknameSeed = email || (googleSub ? `google-${googleSub}` : "user");
  token.email = email || (typeof token.email === "string" ? token.email : null);
  token.googleSub = googleSub;
  token.name = user?.name ?? (typeof token.name === "string" ? token.name : null);
  token.nickname =
    typeof token.nickname === "string" && token.nickname.trim()
      ? token.nickname
      : buildNickname(nicknameSeed, user?.name ?? (typeof token.name === "string" ? token.name : null));
  token.role = token.role === "admin" || isAdminEmail(email) ? "admin" : "user";
  token.appUserId =
    typeof token.appUserId === "string" && token.appUserId.trim()
      ? token.appUserId
      : googleSub
        ? buildStableProfileIdFromGoogleSub(googleSub)
        : buildLegacyProfileIdFromEmail(email);
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
    async signIn({ user, account }) {
      const email = String(user.email ?? "").trim().toLowerCase();
      const googleSub =
        account?.provider === "google" && typeof account.providerAccountId === "string" && account.providerAccountId.trim()
          ? normalizeGoogleSub(account.providerAccountId)
          : null;

      if (!email || !googleSub) {
        return false;
      }

      try {
        const holdUntil = await getWithdrawalHoldUntil({
          email,
          googleSub
        });
        if (holdUntil) {
          return `/auth/login?error=withdrawn&days=${ACCOUNT_REJOIN_COOLDOWN_DAYS}&until=${encodeURIComponent(holdUntil)}`;
        }
      } catch (error) {
        console.error("withdrawn account lookup failed during sign-in", error);
        return "/auth/login?error=unavailable";
      }

      return true;
    },
    async jwt({ token, user, account }) {
      const seededToken = seedTokenIdentity(token, {
        email: user?.email ?? null,
        name: user?.name ?? null,
        googleSub: account?.provider === "google" ? account.providerAccountId : null
      });

      let profileFromDb = await findProfileByIdentity({
        googleSub: typeof seededToken.googleSub === "string" ? seededToken.googleSub : null,
        id: typeof seededToken.appUserId === "string" ? seededToken.appUserId : null,
        email: typeof seededToken.email === "string" ? seededToken.email : null
      });

      if (profileFromDb) {
        profileFromDb = await syncProfileIdentity(profileFromDb, {
          googleSub: typeof seededToken.googleSub === "string" ? seededToken.googleSub : null,
          email: typeof seededToken.email === "string" ? seededToken.email : null
        });
        return applyProfileToToken(seededToken, profileFromDb);
      }

      return seededToken;
    },
    async session({ session, token }) {
      if (!session.user) {
        return session;
      }

      session.user.id = String(token.appUserId ?? "");
      session.user.google_sub = typeof token.googleSub === "string" ? token.googleSub : null;
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
