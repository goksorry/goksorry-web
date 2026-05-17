import { expect, test } from "@playwright/test";
import { hasNextAuthSessionCookie } from "../lib/nextauth-cookie";

test.describe("NextAuth session cookie detection", () => {
  test("detects standard, secure, and chunked session cookies", () => {
    expect(hasNextAuthSessionCookie("next-auth.session-token=abc")).toBe(true);
    expect(hasNextAuthSessionCookie("theme=light; __Secure-next-auth.session-token=abc")).toBe(true);
    expect(hasNextAuthSessionCookie("theme=light; next-auth.session-token.0=abc; next-auth.session-token.1=def")).toBe(true);
    expect(hasNextAuthSessionCookie("__Secure-next-auth.session-token.0=abc")).toBe(true);
  });

  test("does not match unrelated cookie names", () => {
    expect(hasNextAuthSessionCookie("")).toBe(false);
    expect(hasNextAuthSessionCookie("goksorry-next-auth.session-token=abc")).toBe(false);
    expect(hasNextAuthSessionCookie("next-auth.csrf-token=abc")).toBe(false);
  });
});
