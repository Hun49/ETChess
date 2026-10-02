import { describe, expect, it } from "vitest";
import {
  formatGo,
  formatPositionFen,
  formatPositionStartpos,
  formatSetOption,
  parseBestMove,
  parseInfo,
} from "../src/uci";

describe("UCI formatting", () => {
  it("formats setoption commands", () => {
    expect(formatSetOption("Skill Level", 5)).toBe("setoption name Skill Level value 5");
    expect(formatSetOption("UCI_LimitStrength", true)).toBe(
      "setoption name UCI_LimitStrength value true",
    );
  });

  it("formats position fen commands with and without moves", () => {
    const fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    expect(formatPositionFen(fen)).toBe(`position fen ${fen}`);
    expect(formatPositionFen(fen, ["e2e4", "e7e5"])).toBe(`position fen ${fen} moves e2e4 e7e5`);
  });

  it("formats position startpos commands", () => {
    expect(formatPositionStartpos()).toBe("position startpos");
    expect(formatPositionStartpos(["e2e4"])).toBe("position startpos moves e2e4");
  });

  it("formats go commands with depth and movetime", () => {
    expect(formatGo({ depth: 5, movetime: 1000 })).toBe("go depth 5 movetime 1000");
    expect(formatGo({ nodes: 50000 })).toBe("go nodes 50000");
  });
});

describe("UCI parsing", () => {
  it("parses bestmove line with and without ponder", () => {
    expect(parseBestMove("bestmove e2e4 ponder e7e5")).toEqual({
      bestmove: "e2e4",
      ponder: "e7e5",
    });
    expect(parseBestMove("bestmove d7d5")).toEqual({
      bestmove: "d7d5",
      ponder: undefined,
    });
    expect(parseBestMove("bestmove (none)")).toBeNull();
    expect(parseBestMove("info depth 5")).toBeNull();
  });

  it("parses info line score and depth", () => {
    const infoLine = "info depth 12 score cp 35 nodes 24150 nps 820000";
    const parsed = parseInfo(infoLine);
    expect(parsed).toEqual({
      depth: 12,
      scoreCp: 35,
      nodes: 24150,
    });
  });

  it("parses info mate score", () => {
    const mateLine = "info depth 4 score mate 2 nodes 500";
    const parsed = parseInfo(mateLine);
    expect(parsed?.scoreMate).toBe(2);
  });
});
