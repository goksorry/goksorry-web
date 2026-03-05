const required = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

export const getPublicEnv = () => {
  return {
    NEXT_PUBLIC_SUPABASE_URL: required("NEXT_PUBLIC_SUPABASE_URL"),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: required("NEXT_PUBLIC_SUPABASE_ANON_KEY")
  };
};

export const getServerEnv = () => {
  return {
    ...getPublicEnv(),
    SUPABASE_SERVICE_ROLE_KEY: required("SUPABASE_SERVICE_ROLE_KEY"),
    INGEST_TOKEN: required("INGEST_TOKEN"),
    ADMIN_EMAIL: process.env.ADMIN_EMAIL ?? "",
    TRADINGBOT_API_TOKEN: process.env.TRADINGBOT_API_TOKEN ?? process.env.INGEST_TOKEN ?? "",
    APP_VERSION: process.env.APP_VERSION ?? "1.0.0",
    DEFAULT_TIMEZONE: process.env.DEFAULT_TIMEZONE ?? "Asia/Seoul"
  };
};

export const getTimezone = (): string => {
  return process.env.DEFAULT_TIMEZONE ?? "Asia/Seoul";
};
