import { describe, expect, it } from "vitest";
import { canDeliverCheckmate, resolveTimeout } from "../src/timeout";

describe("FIDE Dead-Position Timeout Rule (Article 6.9)", () => {
  it("resolves K vs K timeout as 1/2-1/2 timeout_vs_insufficient", () => {
    // Standard King vs King
    const fen = "8/8/8/4k3/8/8/4K3/8 w - - 0 1";
    expect(canDeliverCheckmate(fen, "white")).toBe(false);
    expect(canDeliverCheckmate(fen, "black")).toBe(false);

    const resWhiteFlag = resolveTimeout(fen, "white");
    expect(resWhiteFlag.result).toBe("1/2-1/2");
    expect(resWhiteFlag.termination).toBe("timeout_vs_insufficient");
    expect(resWhiteFlag.winnerRole).toBeUndefined();

    const resBlackFlag = resolveTimeout(fen, "black");
    expect(resBlackFlag.result).toBe("1/2-1/2");
    expect(resBlackFlag.termination).toBe("timeout_vs_insufficient");
  });

  it("resolves K+N vs K timeout as draw (single knight cannot mate lone king)", () => {
    // White has King + Knight, Black has lone King
    const fen = "8/8/8/4k3/8/5N2/4K3/8 w - - 0 1";
    expect(canDeliverCheckmate(fen, "white")).toBe(false); // Knight cannot mate lone king
    expect(canDeliverCheckmate(fen, "black")).toBe(false); // Lone king cannot mate

    // If Black flags, White has insufficient material -> draw
    const resBlack = resolveTimeout(fen, "black");
    expect(resBlack.result).toBe("1/2-1/2");
    expect(resBlack.termination).toBe("timeout_vs_insufficient");

    // If White flags, Black has only lone King -> draw
    const resWhite = resolveTimeout(fen, "white");
    expect(resWhite.result).toBe("1/2-1/2");
    expect(resWhite.termination).toBe("timeout_vs_insufficient");
  });

  it("resolves K+B vs K timeout as draw (single bishop cannot mate lone king)", () => {
    // White has King + Bishop, Black has lone King
    const fen = "8/8/8/4k3/8/5B2/4K3/8 w - - 0 1";
    expect(canDeliverCheckmate(fen, "white")).toBe(false);
    expect(canDeliverCheckmate(fen, "black")).toBe(false);

    expect(resolveTimeout(fen, "black").result).toBe("1/2-1/2");
    expect(resolveTimeout(fen, "white").result).toBe("1/2-1/2");
  });

  it("resolves K+B vs K+B on same colored squares as draw", () => {
    // White Bishop on c1 (c1 is dark square: 'c' is 2, '1' is 0 -> 2%2 == 0)
    // Black Bishop on f8 (f8 is dark square: 'f' is 5, '8' is 7 -> 12%2 == 0)
    const fen = "5b2/8/8/4k3/8/8/4K3/2B5 w - - 0 1";
    expect(canDeliverCheckmate(fen, "white")).toBe(false);
    expect(canDeliverCheckmate(fen, "black")).toBe(false);

    expect(resolveTimeout(fen, "black").result).toBe("1/2-1/2");
    expect(resolveTimeout(fen, "white").result).toBe("1/2-1/2");
  });

  it("resolves K+B vs K+B on opposite colored squares as win on timeout (help-mate in corner possible)", () => {
    // White Bishop on c1 (dark), Black Bishop on c8 (light: 'c' is 2, '8' is 7 -> 9%2 == 1)
    const fen = "2b5/8/8/4k3/8/8/4K3/2B5 w - - 0 1";
    expect(canDeliverCheckmate(fen, "white")).toBe(true);
    expect(canDeliverCheckmate(fen, "black")).toBe(true);

    const res = resolveTimeout(fen, "black");
    expect(res.result).toBe("1-0");
    expect(res.winnerRole).toBe("white");
    expect(res.termination).toBe("timeout");
  });

  it("resolves K+Q vs K timeout: flagging player with Queen still draws if opponent has lone King", () => {
    // White has King + Queen, Black has lone King
    const fen = "8/8/8/4k3/8/8/4K3/4Q3 w - - 0 1";
    expect(canDeliverCheckmate(fen, "white")).toBe(true); // Queen can mate
    expect(canDeliverCheckmate(fen, "black")).toBe(false); // Lone king cannot mate

    // If White flags (ran out of time), Black cannot mate White -> draw!
    const resWhiteFlag = resolveTimeout(fen, "white");
    expect(resWhiteFlag.result).toBe("1/2-1/2");
    expect(resWhiteFlag.termination).toBe("timeout_vs_insufficient");

    // If Black flags, White has Queen and can mate -> White wins 1-0!
    const resBlackFlag = resolveTimeout(fen, "black");
    expect(resBlackFlag.result).toBe("1-0");
    expect(resBlackFlag.winnerRole).toBe("white");
    expect(resBlackFlag.termination).toBe("timeout");
  });

  it("resolves K+P vs K timeout: Pawn player wins if opponent flags, but draws if Pawn player flags", () => {
    // White has King + Pawn, Black has lone King
    const fen = "8/8/8/4k3/4P3/8/4K3/8 w - - 0 1";
    expect(canDeliverCheckmate(fen, "white")).toBe(true); // Pawn promotes
    expect(canDeliverCheckmate(fen, "black")).toBe(false); // Lone king cannot mate

    // Black flags -> White wins
    const resBlackFlag = resolveTimeout(fen, "black");
    expect(resBlackFlag.result).toBe("1-0");
    expect(resBlackFlag.termination).toBe("timeout");

    // White flags -> Black has lone king -> draw
    const resWhiteFlag = resolveTimeout(fen, "white");
    expect(resWhiteFlag.result).toBe("1/2-1/2");
    expect(resWhiteFlag.termination).toBe("timeout_vs_insufficient");
  });

  it("resolves K+N vs K+P: Knight can deliver cooperative mate against King trapped by own pawn", () => {
    // White has King + Knight, Black has King + Pawn
    const fen = "8/8/8/4k3/4p3/5N2/4K3/8 w - - 0 1";
    expect(canDeliverCheckmate(fen, "white")).toBe(true); // Cooperative mate possible

    const resBlackFlag = resolveTimeout(fen, "black");
    expect(resBlackFlag.result).toBe("1-0");
    expect(resBlackFlag.termination).toBe("timeout");
  });
});
