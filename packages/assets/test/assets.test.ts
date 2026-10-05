import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  CLASSIC_PIECE_SVGS,
  CLASSIC_PIECE_SVG_BODIES,
  PIECE_ATTRIBUTION,
  type PieceSymbol,
  type PieceType,
  getPieceSpriteSvg,
  getPieceSvg,
} from "../src/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PIECES_DIR = path.resolve(__dirname, "../pieces/classic");

describe("Assets Package (@etchess/assets)", () => {
  it("includes legal CC BY-SA 3.0 attribution", () => {
    expect(PIECE_ATTRIBUTION.designer).toBe("Colin M.L. Burnett");
    expect(PIECE_ATTRIBUTION.license).toBe("CC BY-SA 3.0");
  });

  it("contains all 12 standard chess pieces", () => {
    const pieces: PieceSymbol[] = [
      "wP",
      "wN",
      "wB",
      "wR",
      "wQ",
      "wK",
      "bP",
      "bN",
      "bB",
      "bR",
      "bQ",
      "bK",
    ];
    for (const p of pieces) {
      expect(CLASSIC_PIECE_SVG_BODIES[p]).toBeDefined();
      expect(CLASSIC_PIECE_SVGS[p]).toContain(`viewBox="0 0 45 45"`);
      expect(CLASSIC_PIECE_SVGS[p]).toContain("<svg");
      expect(CLASSIC_PIECE_SVGS[p]).toContain("</svg>");
    }
  });

  it("generates piece svg on demand", () => {
    const whiteQueen = getPieceSvg("q", "w");
    expect(whiteQueen).toContain('viewBox="0 0 45 45"');
    const blackKnight = getPieceSvg("n", "b");
    expect(blackKnight).toContain('viewBox="0 0 45 45"');
  });

  it("throws on invalid piece type", () => {
    expect(() => getPieceSvg("x" as unknown as PieceType, "w")).toThrow();
  });

  it("generates a valid SVG sprite with all 12 symbols", () => {
    const sprite = getPieceSpriteSvg();
    expect(sprite).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
    expect(sprite).toContain('<symbol id="wP"');
    expect(sprite).toContain('<symbol id="bK"');
  });

  it("writes canonical SVG files to pieces/classic/ directory", () => {
    fs.mkdirSync(PIECES_DIR, { recursive: true });
    for (const [symbol, svg] of Object.entries(CLASSIC_PIECE_SVGS)) {
      fs.writeFileSync(path.join(PIECES_DIR, `${symbol}.svg`), svg, "utf8");
    }
    fs.writeFileSync(path.join(PIECES_DIR, "pieces.svg"), getPieceSpriteSvg(), "utf8");

    expect(fs.existsSync(path.join(PIECES_DIR, "wK.svg"))).toBe(true);
    expect(fs.existsSync(path.join(PIECES_DIR, "pieces.svg"))).toBe(true);
  });
});
