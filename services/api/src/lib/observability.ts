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
