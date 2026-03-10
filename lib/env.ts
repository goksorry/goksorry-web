const required = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

export const getServerEnv = () => {
  return {
    NEXT_PUBLIC_SUPABASE_URL: required("NEXT_PUBLIC_SUPABASE_URL"),
    SUPABASE_SERVICE_ROLE_KEY: required("SUPABASE_SERVICE_ROLE_KEY"),
    NEXTAUTH_SECRET: required("NEXTAUTH_SECRET"),
    GOOGLE_CLIENT_ID: required("GOOGLE_CLIENT_ID"),
    GOOGLE_CLIENT_SECRET: required("GOOGLE_CLIENT_SECRET"),
    DETECTOR_WRITE_TOKEN: required("DETECTOR_WRITE_TOKEN"),
    ADMIN_EMAIL: process.env.ADMIN_EMAIL ?? "",
    APP_VERSION: process.env.APP_VERSION ?? "1.0.0",
    DEFAULT_TIMEZONE: process.env.DEFAULT_TIMEZONE ?? "Asia/Seoul"
  };
};

export const getTimezone = (): string => {
  return process.env.DEFAULT_TIMEZONE ?? "Asia/Seoul";
};
