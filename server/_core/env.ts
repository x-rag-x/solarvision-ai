import crypto from "crypto";

function resolveCookieSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (
    secret &&
    secret.trim().length >= 32 &&
    !secret.includes("replace-with") &&
    secret !== "solarvision-ai-operator-session-secret-key-32chars-min!"
  ) {
    return secret.trim();
  }

  // Generate a cryptographically secure random 256-bit ephemeral secret
  const generated = crypto.randomBytes(32).toString("hex");
  if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = generated;
  }
  return generated;
}

export const ENV = {
  appId: process.env.VITE_APP_ID || "solarvision-ai",
  cookieSecret: resolveCookieSecret(),
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
};

