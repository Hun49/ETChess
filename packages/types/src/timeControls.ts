export type RatingCategory = "bullet" | "blitz" | "rapid" | "classical";

export type TimeControlKey =
  | "1+0"
  | "1+1"
  | "2+1"
  | "2+0"
  | "3+0"
  | "3+2"
  | "5+0"
  | "5+3"
  | "10+0"
  | "10+5"
  | "15+10"
  | "30+0";

export type TimeControlId = TimeControlKey;

export interface TimeControlConfig {
  key: TimeControlKey;
  initialSeconds: number;
  incrementSeconds: number;
  category: RatingCategory;
  displayName: string;
}

/**
 * Authoritative category classification (SRS RATE-12 & Section 8.2):
 * Estimated duration = initialSeconds + 40 * incrementSeconds
 * < 180s: bullet
 * < 480s: blitz
 * < 3600s: rapid (includes 10+0, 10+5, 15+10, 30+0)
 * >= 3600s: classical
 */
export function classifyTimeControl(
  initialSeconds: number,
  incrementSeconds: number,
): RatingCategory {
  const estimatedDuration = initialSeconds + 40 * incrementSeconds;
  if (estimatedDuration < 180) {
    return "bullet";
  }
  if (estimatedDuration < 480) {
    return "blitz";
  }
  if (estimatedDuration < 3600) {
    return "rapid";
  }
  return "classical";
}

export const TIME_CONTROLS: Record<TimeControlKey, TimeControlConfig> = {
  "1+0": {
    key: "1+0",
    initialSeconds: 60,
    incrementSeconds: 0,
    category: classifyTimeControl(60, 0),
    displayName: "1 min",
  },
  "1+1": {
    key: "1+1",
    initialSeconds: 60,
    incrementSeconds: 1,
    category: classifyTimeControl(60, 1),
    displayName: "1 | 1",
  },
  "2+1": {
    key: "2+1",
    initialSeconds: 120,
    incrementSeconds: 1,
    category: classifyTimeControl(120, 1),
    displayName: "2 | 1",
  },
  "2+0": {
    key: "2+0",
    initialSeconds: 120,
    incrementSeconds: 0,
    category: classifyTimeControl(120, 0),
    displayName: "2 min",
  },
  "3+0": {
    key: "3+0",
    initialSeconds: 180,
    incrementSeconds: 0,
    category: classifyTimeControl(180, 0),
    displayName: "3 min",
  },
  "3+2": {
    key: "3+2",
    initialSeconds: 180,
    incrementSeconds: 2,
    category: classifyTimeControl(180, 2),
    displayName: "3 | 2",
  },
  "5+0": {
    key: "5+0",
    initialSeconds: 300,
    incrementSeconds: 0,
    category: classifyTimeControl(300, 0),
    displayName: "5 min",
  },
  "5+3": {
    key: "5+3",
    initialSeconds: 300,
    incrementSeconds: 3,
    category: classifyTimeControl(300, 3),
    displayName: "5 | 3",
  },
  "10+0": {
    key: "10+0",
    initialSeconds: 600,
    incrementSeconds: 0,
    category: classifyTimeControl(600, 0),
    displayName: "10 min",
  },
  "10+5": {
    key: "10+5",
    initialSeconds: 600,
    incrementSeconds: 5,
    category: classifyTimeControl(600, 5),
    displayName: "10 | 5",
  },
  "15+10": {
    key: "15+10",
    initialSeconds: 900,
    incrementSeconds: 10,
    category: classifyTimeControl(900, 10),
    displayName: "15 | 10",
  },
  "30+0": {
    key: "30+0",
    initialSeconds: 1800,
    incrementSeconds: 0,
    category: classifyTimeControl(1800, 0),
    displayName: "30 min",
  },
};

export function getRatingCategory(key: TimeControlKey): RatingCategory {
  return TIME_CONTROLS[key].category;
}
