export type AdminView =
  | "dashboard"
  | "users"
  | "verifications"
  | "bans"
  | "live-games"
  | "game-history"
  | "settlements"
  | "ratings-overview"
  | "rating-adjustments"
  | "friend-challenges"
  | "pending-invites"
  | "logs"
  | "analytics"
  | "settings";

export interface AdminMetrics {
  totalUsers: number;
  usersChange7d: number;
  activePlayers: number;
  activePlayersChange7d: number;
  gamesPlayed: number;
  gamesPlayedChange7d: number;
  onlineNow: number;
  onlineChangeHour: number;
  modes: {
    online: number;
    friend: number;
    computer: number;
    local: number;
  };
  growth: Array<{ date: string; users: number }>;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin";
  avatar?: string;
  isBanned: boolean;
  banReason?: string | null;
  banExpiresAt?: number | null;
  createdAt: number;
  ratings: {
    bullet: number;
    blitz: number;
    rapid: number;
    classical: number;
  };
  gamesPlayed: number;
}

export interface LiveGameItem {
  id: string;
  whiteId: string;
  whiteName: string;
  whiteRating: number;
  blackId: string;
  blackName: string;
  blackRating: number;
  timeControl: string;
  category: "bullet" | "blitz" | "rapid" | "classical";
  rated: boolean;
  plyCount: number;
  startedAt: number;
  fen: string;
}

export interface RecentGameItem {
  id: string;
  whiteName: string;
  whiteAvatar?: string;
  blackName: string;
  blackAvatar?: string;
  mode: string;
  timeControl: string;
  result: "1-0" | "0-1" | "1/2-1/2" | "aborted";
  termination: string;
  ratingChange: number;
  finishedAt: number;
  fen?: string;
  pgn?: string;
}

export interface ReportItem {
  id: string;
  reporterId: string;
  reporterName: string;
  reportedId: string;
  reportedName: string;
  gameId?: string;
  category: "cheating" | "harassment" | "stall" | "other";
  details?: string;
  status: "pending" | "investigating" | "resolved" | "dismissed";
  resolutionNotes?: string;
  resolvedBy?: string;
  createdAt: number;
}

export interface AuditLogItem {
  id: string;
  actorId: string;
  actorName?: string;
  action: string;
  targetType: string;
  targetId: string;
  details?: Record<string, unknown>;
  createdAt: number;
}

export interface SystemHealthStatus {
  status: "operational" | "degraded" | "down";
  components: {
    name: string;
    status: "Healthy" | "Degraded" | "Outage";
    uptimePct: number;
  }[];
}
