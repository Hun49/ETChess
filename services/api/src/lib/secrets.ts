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

export interface EnvValidationResult {
  valid: boolean;
  missing: string[];
  errors: string[];
}

/**
 * Validates Cloudflare runtime environment bindings and security secrets (N2).
 */
export function validateEnvironment(env: Env): EnvValidationResult {
  const missing: string[] = [];
  const errors: string[] = [];

  if (!env.DB) missing.push("DB");
  if (!env.GAME_SESSION_DO) missing.push("GAME_SESSION_DO");
  if (!env.MATCHMAKER_DO) missing.push("MATCHMAKER_DO");
  if (!env.USER_PRESENCE_DO) missing.push("USER_PRESENCE_DO");

  if (!env.BETTER_AUTH_SECRET) {
    missing.push("BETTER_AUTH_SECRET");
  } else if (
    typeof env.BETTER_AUTH_SECRET !== "string" ||
    env.BETTER_AUTH_SECRET.trim().length < 32
  ) {
    errors.push("BETTER_AUTH_SECRET must be configured with at least 32 characters");
  }

  if (
    env.WS_TICKET_SECRET &&
    (typeof env.WS_TICKET_SECRET !== "string" || env.WS_TICKET_SECRET.trim().length < 32)
  ) {
    errors.push("WS_TICKET_SECRET must be configured with at least 32 characters if provided");
  }

  return {
    valid: missing.length === 0 && errors.length === 0,
    missing,
    errors,
  };
}
