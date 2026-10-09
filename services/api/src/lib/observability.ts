/**
 * ET Chess Observability and Metrics Module
 * Emits structured metrics to Cloudflare logs and analytics.
 */

export interface MetricEvent {
  metric: string;
  value: number;
  tags?: Record<string, string | number | boolean>;
  timestamp?: number;
}

const counters = new Map<string, number>();

/**
 * Increment an observability counter and emit structured log.
 */
export function count(
  metric: string,
  value = 1,
  tags?: Record<string, string | number | boolean>,
): void {
  const current = (counters.get(metric) || 0) + value;
  counters.set(metric, current);

  // Emit structured log for Cloudflare Tail Workers / Logpush
  console.log(
    JSON.stringify({
      type: "metric_counter",
      timestamp: new Date().toISOString(),
      metric,
      value,
      cumulative: current,
      tags: tags ?? {},
    }),
  );
}

/**
 * Record a timing / duration histogram metric (e.g. queue wait time, move latency).
 */
export function timing(
  metric: string,
  durationMs: number,
  tags?: Record<string, string | number | boolean>,
): void {
  console.log(
    JSON.stringify({
      type: "metric_timing",
      timestamp: new Date().toISOString(),
      metric,
      durationMs,
      tags: tags ?? {},
    }),
  );
}

export const MetricsCollector = {
  count,
  timing,

  gamesStarted(tags?: { timeControl?: string; rated?: boolean }): void {
    count("games_started", 1, tags);
  },

  gamesEnded(termination: string, tags?: { rated?: boolean; result?: string }): void {
    count("games_ended", 1, { termination, ...tags });
  },

  movesTotal(ply: number, tags?: { gameId?: string }): void {
    count("moves_total", 1, { ply, ...tags });
  },

  disconnectsTotal(role?: string): void {
    count("disconnects_total", 1, { role: role ?? "unknown" });
  },

  reconnectsTotal(role?: string): void {
    count("reconnects_total", 1, { role: role ?? "unknown" });
  },

  alarmsFired(kind?: string): void {
    count("alarms_fired", 1, { kind: kind ?? "unknown" });
  },

  alarmsStaleDropped(kind?: string, reason?: string): void {
    count("alarms_stale_dropped", 1, {
      kind: kind ?? "unknown",
      reason: reason ?? "stale",
    });
  },

  matchmakerWaitTime(waitMs: number, tags?: { timeControl?: string; rated?: boolean }): void {
    timing("matchmaker_wait_ms", waitMs, tags);
  },

  matchmakerWaitMs(waitMs: number, tags?: { timeControl?: string; rated?: boolean }): void {
    timing("matchmaker_wait_ms", waitMs, tags);
  },
};

export const SENSITIVE_KEYS = new Set([
  "ticket",
  "password",
  "secret",
  "token",
  "accessToken",
  "refreshToken",
  "authorization",
  "cookie",
  "credentials",
  "signature",
  "hash",
  "privateKey",
]);

/**
 * Sanitizes arbitrary objects to prevent leaking credentials, tokens, or PII.
 */
export function sanitizeLogData(data: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase()) || SENSITIVE_KEYS.has(key)) {
      sanitized[key] = "[REDACTED]";
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      sanitized[key] = sanitizeLogData(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

/**
 * Structured coordination logger (B4-OBS-01).
 * Never logs passwords, auth tokens, WS tickets, or secrets.
 * Sensitive keys are stripped completely to prevent credential exposure.
 */
export function logCoordination(event: string, data: Record<string, unknown>): void {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    const lower = key.toLowerCase();
    if (
      !SENSITIVE_KEYS.has(key) &&
      !SENSITIVE_KEYS.has(lower) &&
      !lower.includes("token") &&
      !lower.includes("password") &&
      !lower.includes("secret") &&
      !lower.includes("ticket") &&
      !lower.includes("cookie") &&
      !lower.includes("authorization")
    ) {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        sanitized[key] = sanitizeLogData(value as Record<string, unknown>);
      } else {
        sanitized[key] = value;
      }
    }
  }

  console.log(
    JSON.stringify({
      type: "coordination_event",
      timestamp: new Date().toISOString(),
      event,
      ...sanitized,
    }),
  );
}

/**
 * Structured rating settlement logger (B7-15).
 * Distinguishes retryable failures from terminal failures.
 */
export function logSettlementEvent(
  event: string,
  context: {
    gameId: string;
    isTerminal?: boolean;
    retryable?: boolean;
    retryCount?: number;
    error?: string;
    lockId?: string;
    durationMs?: number;
  },
): void {
  const level = context.isTerminal ? "error" : context.error ? "warn" : "info";
  const payload = {
    level,
    type: "settlement_event",
    timestamp: new Date().toISOString(),
    event,
    ...sanitizeLogData(context as unknown as Record<string, unknown>),
  };

  if (level === "error") {
    console.error(JSON.stringify(payload));
  } else if (level === "warn") {
    console.warn(JSON.stringify(payload));
  } else {
    console.log(JSON.stringify(payload));
  }
}

/**
 * Structured security audit event logger (B7-15).
 */
export function logSecurityEvent(
  event: string,
  context: {
    action: string;
    outcome: "allowed" | "denied" | "rate_limited";
    requestId?: string;
    userId?: string;
    resourceId?: string;
    reason?: string;
  },
): void {
  const level =
    context.outcome === "denied" || context.outcome === "rate_limited" ? "warn" : "info";
  const payload = {
    level,
    type: "security_audit",
    timestamp: new Date().toISOString(),
    event,
    ...sanitizeLogData(context as unknown as Record<string, unknown>),
  };

  if (level === "warn") {
    console.warn(JSON.stringify(payload));
  } else {
    console.log(JSON.stringify(payload));
  }
}

/**
 * Actionable Production Alert Configurations (B7-15).
 */
export const ALERT_DEFINITIONS = [
  {
    name: "High5xxErrorRate",
    metric: "http_request_status_5xx",
    threshold: 0.01, // > 1% of total requests over 5m window
    severity: "critical",
    description: "Elevated internal server errors across Worker routes",
    runbook: "Check Cloudflare Tail logs for unhandled_exception and D1/DO failures",
  },
  {
    name: "TerminalSettlementFailure",
    metric: "settlement_terminal_failures_total",
    threshold: 1, // Any terminal failure triggers alert
    severity: "critical",
    description: "A completed game failed rating settlement and could not be retried",
    runbook: "Check ratingStorage error details and inspect fence locks in UserPresenceDO",
  },
  {
    name: "ElevatedReconnectStorm",
    metric: "reconnects_total",
    threshold: 50, // > 50 reconnects in 1 minute
    severity: "warning",
    description: "Rapid reconnections detected, possible network partition or DO instability",
    runbook: "Inspect GameSessionDO hibernation logs and client disconnect codes",
  },
  {
    name: "D1StorageConnectivityFailure",
    metric: "d1_errors_total",
    threshold: 5,
    severity: "critical",
    description: "D1 database query execution errors exceeding threshold",
    runbook: "Verify Cloudflare D1 service health, replication lag, and connection limits",
  },
  {
    name: "MatchmakingQueueStall",
    metric: "matchmaker_wait_ms",
    threshold: 30000, // p95 wait time > 30s
    severity: "warning",
    description: "Players waiting in matchmaking queue longer than expected",
    runbook: "Check MatchmakerDO queue counts, pool isolation, and ticket consumption",
  },
] as const;
