import type { Env } from "../types";

/**
 * Returns the secret key for signing and verifying WebSocket tickets.
 * Uses dedicated WS_TICKET_SECRET if configured, otherwise BETTER_AUTH_SECRET.
 * Fails closed if no secret is configured or if the key length is insufficient (<32 chars).
 */
export function getWsTicketSecret(env: Env): string {
  const secret = env.WS_TICKET_SECRET || env.BETTER_AUTH_SECRET;
  if (!secret || typeof secret !== "string" || secret.trim().length < 32) {
    throw new Error(
      "CRITICAL_SECURITY_ERROR: WS_TICKET_SECRET or BETTER_AUTH_SECRET must be configured with at least 32 characters. Refusing to operate with missing or insecure secret.",
    );
  }
  return secret.trim();
}

/**
 * Returns the Better Auth secret key.
 * Fails closed if missing or under 32 characters.
 */
export function getAuthSecret(env: Env): string {
  const secret = env.BETTER_AUTH_SECRET;
  if (!secret || typeof secret !== "string" || secret.trim().length < 32) {
    throw new Error(
      "CRITICAL_SECURITY_ERROR: BETTER_AUTH_SECRET must be configured with at least 32 characters. Refusing to operate with missing or insecure secret.",
    );
  }
  return secret.trim();
}
