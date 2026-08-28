const required = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

const requiredWithLegacyFallback = (name: string, legacyName: string): string => {
  const value = process.env[name] ?? process.env[legacyName];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

export const getSupabaseServerEnv = () => {
  return {
    SUPABASE_URL: requiredWithLegacyFallback("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"),
    SUPABASE_SERVICE_ROLE_KEY: required("SUPABASE_SERVICE_ROLE_KEY")
  };
};

export const getAuthServerEnv = () => {
  return {
    NEXTAUTH_SECRET: required("NEXTAUTH_SECRET"),
    GOOGLE_CLIENT_ID: required("GOOGLE_CLIENT_ID"),
    GOOGLE_CLIENT_SECRET: required("GOOGLE_CLIENT_SECRET")
  };
};

export const getNextAuthSecret = (): string => required("NEXTAUTH_SECRET");

export const getDetectorWriteToken = (): string => required("DETECTOR_WRITE_TOKEN");

export const getAdminEmail = (): string => process.env.ADMIN_EMAIL ?? "";

export const getChatServerEnv = () => {
  const CHAT_TOKEN_SECRET = process.env.CHAT_TOKEN_SECRET ?? "";
  const CHAT_WS_BASE_URL = process.env.CHAT_WS_BASE_URL ?? "";

  return {
    CHAT_TOKEN_SECRET,
    CHAT_WS_BASE_URL,
    enabled: Boolean(CHAT_TOKEN_SECRET && CHAT_WS_BASE_URL)
  };
};

export const getTimezone = (): string => {
  return process.env.DEFAULT_TIMEZONE ?? "Asia/Seoul";
};
