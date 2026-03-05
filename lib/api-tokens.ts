import { createHash, randomBytes } from "node:crypto";

export type TokenScope = "tradingbot.read";

export const hashApiToken = (token: string): string => {
  return createHash("sha256").update(token).digest("hex");
};

export const generateTradingBotApiToken = (): {
  rawToken: string;
  tokenPrefix: string;
  tokenHash: string;
} => {
  const rawToken = `gkst_${randomBytes(32).toString("hex")}`;
  const tokenPrefix = rawToken.slice(0, 16);
  const tokenHash = hashApiToken(rawToken);

  return {
    rawToken,
    tokenPrefix,
    tokenHash
  };
};
