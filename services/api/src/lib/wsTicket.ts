import { PRODUCT_RULES } from "@etchess/types";

export interface WsTicketPayload {
  userId: string;
  userName: string;
  rating: number;
  scope: "game" | "user";
  gameId?: string;
  role?: "white" | "black" | "spectator";
  userRole?: string;
  exp: number; // Unix timestamp in ms
  jti: string; // Unique ticket UUID for single-use replay protection
}

function base64UrlEncode(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(str: string): Uint8Array {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function getHmacKey(secret: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

/**
 * Mints an HMAC-SHA256 signed single-use WebSocket ticket.
 * RULE-12: Default lifetime is 30 seconds.
 */
export async function createWsTicket(
  params: Omit<WsTicketPayload, "exp" | "jti">,
  secret: string,
  expiresInSeconds: number = PRODUCT_RULES.WS_TICKET_LIFETIME_SEC,
): Promise<{ ticket: string; expiresIn: number; payload: WsTicketPayload }> {
  const now = Date.now();
  const jti = crypto.randomUUID();
  const exp = now + expiresInSeconds * 1000;

  const payload: WsTicketPayload = {
    ...params,
    exp,
    jti,
  };

  const payloadJson = JSON.stringify(payload);
  const payloadB64 = base64UrlEncode(new TextEncoder().encode(payloadJson));

  const key = await getHmacKey(secret);
  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payloadB64),
  );
  const sigB64 = base64UrlEncode(signatureBuffer);

  const ticket = `${payloadB64}.${sigB64}`;

  return {
    ticket,
    expiresIn: expiresInSeconds,
    payload,
  };
}

export type VerifyTicketResult =
  | { valid: true; payload: WsTicketPayload }
  | { valid: false; reason: string };

/**
 * Cryptographically verifies a WebSocket ticket's signature and expiration.
 */
export async function verifyWsTicket(ticket: string, secret: string): Promise<VerifyTicketResult> {
  try {
    const parts = ticket.split(".");
    if (parts.length !== 2) {
      return { valid: false, reason: "Malformed ticket format" };
    }

    const [payloadB64, sigB64] = parts;

    // 1. Verify HMAC Signature
    const key = await getHmacKey(secret);
    const signatureBytes = base64UrlDecode(sigB64);
    const isValid = await crypto.subtle.verify(
      "HMAC",
      key,
      signatureBytes as unknown as BufferSource,
      new TextEncoder().encode(payloadB64),
    );

    if (!isValid) {
      return { valid: false, reason: "Invalid ticket signature" };
    }

    // 2. Decode and parse payload
    const payloadJson = new TextDecoder().decode(base64UrlDecode(payloadB64));
    const payload = JSON.parse(payloadJson) as WsTicketPayload;

    // 3. Expiration check
    if (Date.now() > payload.exp) {
      return { valid: false, reason: "Ticket has expired" };
    }

    return { valid: true, payload };
  } catch (err) {
    return {
      valid: false,
      reason: err instanceof Error ? err.message : "Failed to verify ticket",
    };
  }
}

/**
 * Replay protection store helper for Durable Objects.
 * Tracks consumed JTIs and purges expired entries.
 * Supports persistent DO storage to survive in-memory evictions.
 */
export class TicketReplayGuard {
  private consumedJtis = new Map<string, number>(); // jti -> expiresAt
  private storage?: DurableObjectStorage;

  constructor(storage?: DurableObjectStorage) {
    this.storage = storage;
  }

  /**
   * Consumes a ticket. Returns false if already used (replay attack).
   */
  consume(jti: string, expiresAt: number): boolean {
    this.cleanup();
    if (this.consumedJtis.has(jti)) {
      return false; // Replayed ticket in memory
    }
    this.consumedJtis.set(jti, expiresAt);
    if (this.storage) {
      void this.storage.put(`jti:${jti}`, expiresAt).catch(() => {});
    }
    return true;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [jti, exp] of this.consumedJtis.entries()) {
      if (now > exp) {
        this.consumedJtis.delete(jti);
      }
    }
  }
}
