import { describe, expect, it } from "vitest";
import { buildPgn } from "../src/pgn";

describe("PGN Builder", () => {
  it("builds valid PGN with Seven Tag Roster and formatted moves", () => {
    const pgn = buildPgn({
      event: "ET Chess Championship",
      white: "Magnus Carlsen",
      black: "Hikaru Nakamura",
      whiteElo: 2850,
      blackElo: 2820,
      timeControl: "3+2",
      result: "1-0",
      termination: "checkmate",
      moves: ["e4", "e5", "Qh5", "Nc6", "Bc4", "Nf6", "Qxf7#"],
    });

    expect(pgn).toContain('[Event "ET Chess Championship"]');
    expect(pgn).toContain('[White "Magnus Carlsen"]');
    expect(pgn).toContain('[Black "Hikaru Nakamura"]');
    expect(pgn).toContain('[WhiteElo "2850"]');
    expect(pgn).toContain('[BlackElo "2820"]');
    expect(pgn).toContain('[TimeControl "3+2"]');
    expect(pgn).toContain('[Result "1-0"]');
    expect(pgn).toContain('[Termination "checkmate"]');
    expect(pgn).toContain("1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7# 1-0");
  });
});
