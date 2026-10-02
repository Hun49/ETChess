import { describe, expect, it } from "vitest";
import {
  parseClientGameFrame,
  parseClientMatchmakerFrame,
  parseServerGameFrame,
  parseServerMatchmakerFrame,
} from "../src";

describe("Client Game Protocol Validation", () => {
  it("parses valid MOVE message", () => {
    const raw = JSON.stringify({
      type: "MOVE",
      payload: { from: "e2", to: "e4" },
    });
    const parsed = parseClientGameFrame(raw);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.type).toBe("MOVE");
    if (parsed.data.type === "MOVE") {
      expect(parsed.data.payload.from).toBe("e2");
      expect(parsed.data.payload.to).toBe("e4");
    }
  });

  it("parses valid promotion MOVE message", () => {
    const raw = {
      type: "MOVE",
      payload: { from: "e7", to: "e8", promotion: "q" },
    };
    const parsed = parseClientGameFrame(raw);
    expect(parsed.success).toBe(true);
  });

  it("rejects invalid square format", () => {
    const raw = {
      type: "MOVE",
      payload: { from: "e9", to: "z4" },
    };
    const parsed = parseClientGameFrame(raw);
    expect(parsed.success).toBe(false);
  });

  it("parses RESIGN, DRAW and REMATCH messages", () => {
    expect(parseClientGameFrame({ type: "RESIGN" }).success).toBe(true);
    expect(parseClientGameFrame({ type: "OFFER_DRAW" }).success).toBe(true);
    expect(parseClientGameFrame({ type: "RESPOND_DRAW", accept: true }).success).toBe(true);
    expect(parseClientGameFrame({ type: "REQUEST_REMATCH" }).success).toBe(true);
  });
});

describe("Server Game Protocol Validation", () => {
  it("parses full GAME_SYNC payload", () => {
    const sync = {
      type: "GAME_SYNC",
      payload: {
        gameId: "test-game-123",
        fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        turn: "w",
        status: "active",
        whiteUserId: "user-1",
        blackUserId: "user-2",
        whiteMs: 180000,
        blackMs: 180000,
        lastMoveTimestamp: Date.now(),
        whiteConnected: true,
        blackConnected: true,
        spectatorCount: 5,
        moves: ["e4", "e5"],
      },
    };
    const parsed = parseServerGameFrame(sync);
    expect(parsed.success).toBe(true);
  });

  it("parses GAME_ENDED payload with rating differences", () => {
    const ended = {
      type: "GAME_ENDED",
      payload: {
        result: "1-0",
        termination: "checkmate",
        winner: "white",
        whiteRatingDiff: 14,
        blackRatingDiff: -14,
      },
    };
    const parsed = parseServerGameFrame(ended);
    expect(parsed.success).toBe(true);
  });
});

describe("Matchmaker Protocol Validation", () => {
  it("validates JOIN_QUEUE and MATCH_FOUND payloads", () => {
    const join = {
      type: "JOIN_QUEUE",
      payload: { timeControl: "3+2", rated: true },
    };
    expect(parseClientMatchmakerFrame(join).success).toBe(true);

    const matchFound = {
      type: "MATCH_FOUND",
      payload: {
        gameId: "123e4567-e89b-12d3-a456-426614174000",
        color: "white",
        opponent: {
          id: "opp-1",
          name: "Magnus",
          rating: 2850,
        },
      },
    };
    expect(parseServerMatchmakerFrame(matchFound).success).toBe(true);
  });
});
