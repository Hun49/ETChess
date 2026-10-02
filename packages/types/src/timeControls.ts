export type RatingCategory = "bullet" | "blitz" | "rapid" | "classical";

export type TimeControlKey = "1+0" | "3+0" | "3+2" | "5+0" | "10+0" | "15+10" | "30+0";

export interface TimeControlConfig {
  key: TimeControlKey;
  initialSeconds: number;
  incrementSeconds: number;
  category: RatingCategory;
  displayName: string;
}

export const TIME_CONTROLS: Record<TimeControlKey, TimeControlConfig> = {
  "1+0": {
    key: "1+0",
    initialSeconds: 60,
    incrementSeconds: 0,
    category: "bullet",
    displayName: "1 min",
  },
  "3+0": {
    key: "3+0",
    initialSeconds: 180,
    incrementSeconds: 0,
    category: "blitz",
    displayName: "3 min",
  },
  "3+2": {
    key: "3+2",
    initialSeconds: 180,
    incrementSeconds: 2,
    category: "blitz",
    displayName: "3 | 2",
  },
  "5+0": {
    key: "5+0",
    initialSeconds: 300,
    incrementSeconds: 0,
    category: "blitz",
    displayName: "5 min",
  },
  "10+0": {
    key: "10+0",
    initialSeconds: 600,
    incrementSeconds: 0,
    category: "rapid",
    displayName: "10 min",
  },
  "15+10": {
    key: "15+10",
    initialSeconds: 900,
    incrementSeconds: 10,
    category: "rapid",
    displayName: "15 | 10",
  },
  "30+0": {
    key: "30+0",
    initialSeconds: 1800,
    incrementSeconds: 0,
    category: "classical",
    displayName: "30 min",
  },
};

export function getRatingCategory(key: TimeControlKey): RatingCategory {
  return TIME_CONTROLS[key].category;
}
