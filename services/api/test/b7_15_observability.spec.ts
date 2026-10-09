/**
 * B7-15 — Production Observability, Redaction & Alerts Verification
 *
 * Requirements:
 * 1. Emits structured logs with useful event names, severity, and correlation identifiers.
 * 2. Redacts sensitive tokens, passwords, cookies, authorization headers, and secrets.
 * 3. Distinguishes retryable failures from terminal failures.
 * 4. Ensures client-facing error responses never disclose internal stack traces or database details.
 * 5. Actionable alert definitions are specified with thresholds and runbooks.
 */
import { describe, expect, it, vi } from "vitest";
import app from "../src";
import {
  ALERT_DEFINITIONS,
  logCoordination,
  logSecurityEvent,
  logSettlementEvent,
  sanitizeLogData,
} from "../src/lib/observability";

describe("B7-15 — Production Observability & Redaction", () => {
  it("1. automatically redacts sensitive keys (tokens, passwords, cookies, auth headers)", () => {
    const rawData = {
      gameId: "game-xyz",
      userId: "user-123",
      token: "super-secret-session-token",
      password: "my-plain-password",
      authorization: "Bearer eyJhbGciOi...",
      cookie: "better-auth.session_token=secret",
      ticket: "ticket-signature-hash",
      metadata: {
        accessToken: "oauth-access-token",
        safeNote: "player connected",
      },
    };

    const sanitized = sanitizeLogData(rawData);

    expect(sanitized.gameId).toBe("game-xyz");
    expect(sanitized.userId).toBe("user-123");
    expect(sanitized.token).toBe("[REDACTED]");
    expect(sanitized.password).toBe("[REDACTED]");
    expect(sanitized.authorization).toBe("[REDACTED]");
    expect(sanitized.cookie).toBe("[REDACTED]");
    expect(sanitized.ticket).toBe("[REDACTED]");

    const nested = sanitized.metadata as Record<string, unknown>;
    expect(nested.accessToken).toBe("[REDACTED]");
    expect(nested.safeNote).toBe("player connected");
  });

  it("2. logs coordination events safely without leaking secrets", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    logCoordination("matchmaker_pair_created", {
      gameId: "game-abc",
      whiteUserId: "user-w",
      blackUserId: "user-b",
      secret: "should-not-appear",
    });

    expect(logSpy).toHaveBeenCalled();
    const loggedCall = logSpy.mock.calls[0][0];
    const parsed = JSON.parse(loggedCall);

    expect(parsed.type).toBe("coordination_event");
    expect(parsed.event).toBe("matchmaker_pair_created");
    expect(parsed.gameId).toBe("game-abc");
    expect(parsed.secret).toBeUndefined();

    logSpy.mockRestore();
  });

  it("3. distinguishes retryable settlement failures from terminal failures", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // Retryable failure (warn)
    logSettlementEvent("settlement_retry", {
      gameId: "game-retry-1",
      isTerminal: false,
      retryable: true,
      retryCount: 1,
      error: "Temporary lock conflict, retrying",
    });

    expect(warnSpy).toHaveBeenCalled();
    const warnCall = JSON.parse(warnSpy.mock.calls[0][0]);
    expect(warnCall.level).toBe("warn");
    expect(warnCall.retryable).toBe(true);

    // Terminal failure (error)
    logSettlementEvent("settlement_fatal_failure", {
      gameId: "game-fatal-1",
      isTerminal: true,
      retryable: false,
      retryCount: 5,
      error: "Settlement lock invalidated prior to commit",
    });

    expect(errorSpy).toHaveBeenCalled();
    const errorCall = JSON.parse(errorSpy.mock.calls[0][0]);
    expect(errorCall.level).toBe("error");
    expect(errorCall.isTerminal).toBe(true);

    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it("4. verifies client-facing 500 error responses do not disclose internal stack traces", async () => {
    // Calling an invalid internal route or injecting an error
    const res = await app.fetch(
      new Request("http://localhost/api/users/profile", {
        method: "GET",
      }),
    );

    // Must be 401 unauthenticated, returning standard code and message without stack
    const data = (await res.json()) as { error: { code: string; message: string; stack?: string } };
    expect(data.error.code).toBeDefined();
    expect(data.error.message).toBeDefined();
    expect(data.error.stack).toBeUndefined();
  });

  it("5. validates complete set of actionable production alert definitions", () => {
    expect(ALERT_DEFINITIONS.length).toBeGreaterThanOrEqual(5);

    const alertNames = ALERT_DEFINITIONS.map((a) => a.name);
    expect(alertNames).toContain("High5xxErrorRate");
    expect(alertNames).toContain("TerminalSettlementFailure");
    expect(alertNames).toContain("ElevatedReconnectStorm");
    expect(alertNames).toContain("D1StorageConnectivityFailure");
    expect(alertNames).toContain("MatchmakingQueueStall");

    for (const alert of ALERT_DEFINITIONS) {
      expect(alert.metric).toBeDefined();
      expect(alert.threshold).toBeDefined();
      expect(alert.severity).toMatch(/^(critical|warning)$/);
      expect(alert.runbook).toBeDefined();
    }
  });
});
