export type BotTier = "beginner" | "intermediate" | "advanced" | "master";

export interface BotConfig {
  tier: BotTier;
  name: string;
  elo: number;
  description: string;
  skillLevel: number; // 0 to 20 Stockfish skill level
  depthLimit: number;
  timeLimitMs: number;
}

export const BOT_TIERS: Record<BotTier, BotConfig> = {
  beginner: {
    tier: "beginner",
    name: "Sparky",
    elo: 800,
    description:
      "Makes occasional tactical blunders. Great for beginners learning piece coordination.",
    skillLevel: 1,
    depthLimit: 3,
    timeLimitMs: 600,
  },
  intermediate: {
    tier: "intermediate",
    name: "Rooki",
    elo: 1400,
    description:
      "Active tactical development and sharp play. Punishes mistakes and hanging pieces.",
    skillLevel: 6,
    depthLimit: 4,
    timeLimitMs: 1000,
  },
  advanced: {
    tier: "advanced",
    name: "Master Bot",
    elo: 1900,
    description: "Deep positional maneuvers and piece coordination. A tough test for club players.",
    skillLevel: 14,
    depthLimit: 6,
    timeLimitMs: 1600,
  },
  master: {
    tier: "master",
    name: "Stockfish Max",
    elo: 2400,
    description: "Relentless tactical calculation with quiescence search and endgame precision.",
    skillLevel: 20,
    depthLimit: 8,
    timeLimitMs: 2400,
  },
};
