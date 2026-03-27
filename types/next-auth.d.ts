import type { DefaultSession } from "next-auth";
import type { JWT as DefaultJWT } from "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      role: "admin" | "user";
      nickname: string | null;
      created_at: string | null;
      nickname_confirmed_at: string | null;
      nickname_changed_at: string | null;
      profile_setup_required: boolean;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    appUserId?: string;
    role?: "admin" | "user";
    nickname?: string | null;
    profileCreatedAt?: string | null;
    nicknameConfirmedAt?: string | null;
    nicknameChangedAt?: string | null;
    profileSetupRequired?: boolean;
  }
}
