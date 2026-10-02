export type BotTier = "beginner" | "intermediate" | "advanced" | "master";

export interface BotConfig {
  tier: BotTier;
  name: string;
  elo: number;
  skillLevel: number; // 0 to 20 Stockfish skill level
  depthLimit: number;
  timeLimitMs: number;
}

export const BOT_TIERS: Record<BotTier, BotConfig> = {
  beginner: {
    tier: "beginner",
    name: "Sparky",
    elo: 800,
    skillLevel: 1,
    depthLimit: 3,
    timeLimitMs: 400,
  },
  intermediate: {
    tier: "intermediate",
    name: "Rooki",
    elo: 1300,
    skillLevel: 6,
    depthLimit: 7,
    timeLimitMs: 800,
  },
  advanced: {
    tier: "advanced",
    name: "Grandmaster Bot",
    elo: 2000,
    skillLevel: 14,
    depthLimit: 12,
    timeLimitMs: 1500,
  },
  master: {
    tier: "master",
    name: "Stockfish Max",
    elo: 2800,
    skillLevel: 20,
    depthLimit: 18,
    timeLimitMs: 2500,
  },
};
