import { describe, expect, it } from "vitest";
import { applyTakeback, canOfferTakeback } from "../src/takeback";

describe("Takeback Validation and Application (RULE-10)", () => {
  it("allows takeback in unrated friend games with moves played", () => {
    const res = canOfferTakeback({
      isFriendGame: true,
      rated: false,
      ply: 4,
    });
    expect(res.allowed).toBe(true);
  });

  it("strictly forbids takebacks in rated games", () => {
    const res = canOfferTakeback({
      isFriendGame: true,
      rated: true,
      ply: 4,
    });
    expect(res.allowed).toBe(false);
    expect(res.reason).toContain("rated");
  });

  it("strictly forbids takebacks in non-friend games", () => {
    const res = canOfferTakeback({
      isFriendGame: false,
      rated: false,
      ply: 4,
    });
    expect(res.allowed).toBe(false);
    expect(res.reason).toContain("friend");
  });

  it("forbids takeback if ply is 0 or request is already pending", () => {
    const resZeroPly = canOfferTakeback({
      isFriendGame: true,
      rated: false,
      ply: 0,
    });
    expect(resZeroPly.allowed).toBe(false);

    const resPending = canOfferTakeback({
      isFriendGame: true,
      rated: false,
      ply: 2,
      hasPendingRequest: true,
    });
    expect(resPending.allowed).toBe(false);
  });

  it("applies takeback rewinding 1 or 2 plies cleanly", () => {
    const moves = ["e4", "e5", "Nf3", "Nc6"];
    const takeback2 = applyTakeback(moves, 2);
    expect(takeback2.ply).toBe(2);
    expect(takeback2.moves).toEqual(["e4", "e5"]);
    expect(takeback2.turn).toBe("w");

    const takeback1 = applyTakeback(moves, 1);
    expect(takeback1.ply).toBe(3);
    expect(takeback1.moves).toEqual(["e4", "e5", "Nf3"]);
    expect(takeback1.turn).toBe("b");
  });
});
