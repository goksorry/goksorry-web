const NEXTAUTH_SESSION_COOKIE_PATTERN = /(?:^|;\s*)(?:__Secure-)?next-auth\.session-token(?:\.\d+)?=/;

export const hasNextAuthSessionCookie = (cookieHeader: string): boolean => {
  return NEXTAUTH_SESSION_COOKIE_PATTERN.test(cookieHeader);
};
