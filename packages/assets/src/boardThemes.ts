export type BoardThemeKey = "classic" | "wood" | "emerald" | "blue" | "dark" | "slate" | "ocean";

export interface BoardThemeColors {
  name: string;
  light: string;
  dark: string;
  lastMoveFrom: string;
  lastMoveTo: string;
  selected: string;
  check: string;
  validDot: string;
  validCaptureRing: string;
  borderColor: string;
}

export const BOARD_THEMES: Record<BoardThemeKey, BoardThemeColors> = {
  classic: {
    name: "Classic",
    light: "#e2e8f0",
    dark: "#2d6a4f",
    lastMoveFrom: "rgba(250, 204, 21, 0.35)",
    lastMoveTo: "rgba(250, 204, 21, 0.45)",
    selected: "rgba(16, 185, 129, 0.5)",
    check: "rgba(239, 68, 68, 0.85)",
    validDot: "rgba(16, 185, 129, 0.75)",
    validCaptureRing: "rgba(239, 68, 68, 0.65)",
    borderColor: "#262626",
  },
  emerald: {
    name: "Emerald",
    light: "#e2e8f0",
    dark: "#2d6a4f",
    lastMoveFrom: "rgba(250, 204, 21, 0.35)",
    lastMoveTo: "rgba(250, 204, 21, 0.45)",
    selected: "rgba(16, 185, 129, 0.5)",
    check: "rgba(239, 68, 68, 0.85)",
    validDot: "rgba(16, 185, 129, 0.75)",
    validCaptureRing: "rgba(239, 68, 68, 0.65)",
    borderColor: "#262626",
  },
  wood: {
    name: "Wood",
    light: "#f0d9b5",
    dark: "#b58863",
    lastMoveFrom: "rgba(250, 204, 21, 0.35)",
    lastMoveTo: "rgba(250, 204, 21, 0.45)",
    selected: "rgba(16, 185, 129, 0.5)",
    check: "rgba(239, 68, 68, 0.85)",
    validDot: "rgba(16, 185, 129, 0.75)",
    validCaptureRing: "rgba(239, 68, 68, 0.65)",
    borderColor: "#262626",
  },
  blue: {
    name: "Blue",
    light: "#dee3e6",
    dark: "#386687",
    lastMoveFrom: "rgba(250, 204, 21, 0.35)",
    lastMoveTo: "rgba(250, 204, 21, 0.45)",
    selected: "rgba(16, 185, 129, 0.5)",
    check: "rgba(239, 68, 68, 0.85)",
    validDot: "rgba(16, 185, 129, 0.75)",
    validCaptureRing: "rgba(239, 68, 68, 0.65)",
    borderColor: "#262626",
  },
  ocean: {
    name: "Ocean",
    light: "#dee3e6",
    dark: "#386687",
    lastMoveFrom: "rgba(250, 204, 21, 0.35)",
    lastMoveTo: "rgba(250, 204, 21, 0.45)",
    selected: "rgba(16, 185, 129, 0.5)",
    check: "rgba(239, 68, 68, 0.85)",
    validDot: "rgba(16, 185, 129, 0.75)",
    validCaptureRing: "rgba(239, 68, 68, 0.65)",
    borderColor: "#262626",
  },
  slate: {
    name: "Slate",
    light: "#cbd5e1",
    dark: "#475569",
    lastMoveFrom: "rgba(250, 204, 21, 0.35)",
    lastMoveTo: "rgba(250, 204, 21, 0.45)",
    selected: "rgba(16, 185, 129, 0.5)",
    check: "rgba(239, 68, 68, 0.85)",
    validDot: "rgba(16, 185, 129, 0.75)",
    validCaptureRing: "rgba(239, 68, 68, 0.65)",
    borderColor: "#262626",
  },
  dark: {
    name: "Dark",
    light: "#334155",
    dark: "#1e293b",
    lastMoveFrom: "rgba(250, 204, 21, 0.35)",
    lastMoveTo: "rgba(250, 204, 21, 0.45)",
    selected: "rgba(16, 185, 129, 0.5)",
    check: "rgba(239, 68, 68, 0.85)",
    validDot: "rgba(16, 185, 129, 0.75)",
    validCaptureRing: "rgba(239, 68, 68, 0.65)",
    borderColor: "#262626",
  },
};

export const DEFAULT_BOARD_THEME: BoardThemeKey = "classic";
