const NEXTAUTH_SESSION_COOKIE_PATTERN = /(?:^|; )(?:__Secure-)?next-auth\.session-token=/;

export const hasNextAuthSessionCookie = (cookieHeader: string): boolean => {
  return NEXTAUTH_SESSION_COOKIE_PATTERN.test(cookieHeader);
};
