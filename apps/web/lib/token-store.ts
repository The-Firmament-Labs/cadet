import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { createControlClient } from "@/lib/server";
import { refreshAccessToken } from "@/lib/vercel-auth";
import { getServerEnv } from "@/lib/env";
import { sqlEscape } from "@/lib/sql";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is required for token encryption");
  return scryptSync(secret, "cadet-token-store", 32);
}

function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf-8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Format: iv:authTag:ciphertext (all base64)
  return `${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted.toString("base64")}`;
}

function decrypt(encoded: string): string {
  const key = getEncryptionKey();
  const [ivB64, tagB64, dataB64] = encoded.split(":");
  if (!ivB64 || !tagB64 || !dataB64) throw new Error("Invalid encrypted token format");
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(tagB64, "base64");
  const data = Buffer.from(dataB64, "base64");
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf-8");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generic provider token store. Keyed by `${provider}_${operatorId}` so
 * multiple providers (vercel, elizaos, …) can coexist without collisions.
 */
export async function storeProviderTokens(
  operatorId: string,
  provider: string,
  accessToken: string,
  refreshToken: string,
  expiresAtMs: number,
): Promise<void> {
  const client = createControlClient();
  // Composite key: provider_operatorId (both parts are alphanumeric-safe)
  const tokenKey = `${provider}_${operatorId}`;
  await client.callReducer("upsert_operator_token", [
    tokenKey,
    provider,
    encrypt(accessToken),
    encrypt(refreshToken),
    expiresAtMs * 1000, // store as micros
  ]);
}

export async function storeVercelTokens(
  operatorId: string,
  accessToken: string,
  refreshToken: string,
  expiresAtMs: number,
): Promise<void> {
  const client = createControlClient();
  await client.callReducer("upsert_operator_token", [
    operatorId,
    "vercel",
    encrypt(accessToken),
    encrypt(refreshToken),
    expiresAtMs * 1000, // store as micros
  ]);
}

/**
 * Get a valid Vercel access token for the operator.
 * Auto-refreshes if expired.
 */
export async function getVercelAccessToken(operatorId: string): Promise<string | null> {
  const client = createControlClient();
  const rows = (await client.sql(
    `SELECT access_token_encrypted, refresh_token_encrypted, expires_at_micros FROM operator_token WHERE operator_id = '${sqlEscape(operatorId)}'`,
  )) as Record<string, unknown>[];

  if (rows.length === 0) return null;

  const row = rows[0]!;
  const expiresAtMs = Number(row.expires_at_micros) / 1000;
  const accessTokenEnc = String(row.access_token_encrypted);
  const refreshTokenEnc = String(row.refresh_token_encrypted);

  // If token is still valid (with 60s buffer), return it
  if (Date.now() < expiresAtMs - 60_000) {
    return decrypt(accessTokenEnc);
  }

  // Token expired — try to refresh
  const env = getServerEnv();
  if (!env.vercelClientId || !env.vercelClientSecret) {
    return null;
  }

  try {
    const refreshToken = decrypt(refreshTokenEnc);
    const tokens = await refreshAccessToken({
      refreshToken,
      clientId: env.vercelClientId,
      clientSecret: env.vercelClientSecret,
    });

    // Store updated tokens
    await storeVercelTokens(
      operatorId,
      tokens.access_token,
      tokens.refresh_token ?? refreshToken,
      Date.now() + tokens.expires_in * 1000,
    );

    return tokens.access_token;
  } catch {
    return null;
  }
}
