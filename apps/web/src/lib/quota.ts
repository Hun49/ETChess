// ET-Chess Daily Usage & Quotas for Guest vs Registered Users

export interface DailyUsage {
  date: string; // YYYY-MM-DD
  onlineGames: number;
  botGames: number;
  analyses: number;
}

export interface QuotaLimits {
  maxOnlineGames: number;
  maxBotGames: number;
  maxAnalyses: number;
}

export const GUEST_LIMITS: QuotaLimits = {
  maxOnlineGames: 5,
  maxBotGames: 10,
  maxAnalyses: 1,
};

export const REGISTERED_LIMITS: QuotaLimits = {
  maxOnlineGames: Number.POSITIVE_INFINITY, // Unlimited
  maxBotGames: Number.POSITIVE_INFINITY, // Unlimited
  maxAnalyses: 10,
};

function getTodayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function getStorageKey(isGuest: boolean, userId?: string): string {
  const prefix = isGuest ? "guest" : `user_${userId || "me"}`;
  return `etchess_usage_${prefix}`;
}

export function getDailyUsage(isGuest: boolean, userId?: string): DailyUsage {
  if (typeof window === "undefined") {
    return { date: getTodayKey(), onlineGames: 0, botGames: 0, analyses: 0 };
  }

  const today = getTodayKey();
  const key = getStorageKey(isGuest, userId);
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw) as DailyUsage;
      if (parsed.date === today) {
        return parsed;
      }
    }
  } catch {}

  const initial: DailyUsage = {
    date: today,
    onlineGames: 0,
    botGames: 0,
    analyses: 0,
  };
  saveDailyUsage(initial, isGuest, userId);
  return initial;
}

function saveDailyUsage(usage: DailyUsage, isGuest: boolean, userId?: string): void {
  if (typeof window === "undefined") return;
  try {
    const key = getStorageKey(isGuest, userId);
    localStorage.setItem(key, JSON.stringify(usage));
  } catch {}
}

export function getQuotaRemaining(isGuest: boolean, userId?: string) {
  const usage = getDailyUsage(isGuest, userId);
  const limits = isGuest ? GUEST_LIMITS : REGISTERED_LIMITS;

  return {
    onlineGamesRemaining: Math.max(0, limits.maxOnlineGames - usage.onlineGames),
    botGamesRemaining: Math.max(0, limits.maxBotGames - usage.botGames),
    analysesRemaining: Math.max(0, limits.maxAnalyses - usage.analyses),
    onlineGamesUsed: usage.onlineGames,
    botGamesUsed: usage.botGames,
    analysesUsed: usage.analyses,
    limits,
  };
}

export function canPlayOnline(isGuest: boolean, userId?: string): boolean {
  if (!isGuest) return true;
  const usage = getDailyUsage(isGuest, userId);
  return usage.onlineGames < GUEST_LIMITS.maxOnlineGames;
}

export function canPlayBot(isGuest: boolean, userId?: string): boolean {
  if (!isGuest) return true;
  const usage = getDailyUsage(isGuest, userId);
  return usage.botGames < GUEST_LIMITS.maxBotGames;
}

export function canAnalyze(isGuest: boolean, userId?: string): boolean {
  const usage = getDailyUsage(isGuest, userId);
  const limits = isGuest ? GUEST_LIMITS : REGISTERED_LIMITS;
  return usage.analyses < limits.maxAnalyses;
}

export function incrementOnlineGame(isGuest: boolean, userId?: string): DailyUsage {
  const usage = getDailyUsage(isGuest, userId);
  usage.onlineGames += 1;
  saveDailyUsage(usage, isGuest, userId);
  return usage;
}

export function incrementBotGame(isGuest: boolean, userId?: string): DailyUsage {
  const usage = getDailyUsage(isGuest, userId);
  usage.botGames += 1;
  saveDailyUsage(usage, isGuest, userId);
  return usage;
}

export function incrementAnalysis(isGuest: boolean, userId?: string): DailyUsage {
  const usage = getDailyUsage(isGuest, userId);
  usage.analyses += 1;
  saveDailyUsage(usage, isGuest, userId);
  return usage;
}
