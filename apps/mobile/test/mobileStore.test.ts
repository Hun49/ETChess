import { describe, expect, it } from "vitest";
import { useMobileStore } from "../src/store/mobileStore";

describe("ET Chess Mobile Store & Game Engine Integration", () => {
  it("initializes with default home view, default user, and history", () => {
    const store = useMobileStore.getState();
    expect(store.activeTab).toBe("home");
    expect(store.activeView).toBe("home");
    expect(store.user.name).toBe("ChessPlayer");
    expect(store.user.ratings.blitz).toBe(1567);
    expect(store.history.length).toBeGreaterThanOrEqual(4);
  });

  it("handles navigation and hierarchical back stack", () => {
    const { navigate, goBack } = useMobileStore.getState();

    navigate("play_online");
    expect(useMobileStore.getState().activeView).toBe("play_online");

    navigate("play_friend");
    expect(useMobileStore.getState().activeView).toBe("play_friend");

    goBack();
    expect(useMobileStore.getState().activeView).toBe("play_online");

    goBack();
    expect(useMobileStore.getState().activeView).toBe("home");
  });

  it("initiates local 2-player pass and play match and handles moves", () => {
    const { startLocalGame, makeMove } = useMobileStore.getState();

    startLocalGame("10+0");
    const game = useMobileStore.getState().game;
    expect(game).toBeDefined();
    expect(game?.mode).toBe("local");
    expect(game?.status).toBe("active");
    expect(game?.turn).toBe("white");

    // 1. e4
    const movedE4 = makeMove("e2", "e4");
    expect(movedE4).toBe(true);
    expect(useMobileStore.getState().game?.moves).toEqual(["e4"]);
    expect(useMobileStore.getState().game?.turn).toBe("black");

    // 1... e5
    const movedE5 = makeMove("e7", "e5");
    expect(movedE5).toBe(true);
    expect(useMobileStore.getState().game?.moves).toEqual(["e4", "e5"]);
    expect(useMobileStore.getState().game?.turn).toBe("white");

    // Illegal move: e4 to e6 (rejected)
    const illegalMove = makeMove("e4", "e6");
    expect(illegalMove).toBe(false);
  });

  it("supports takebacks in local and casual games", () => {
    const { startLocalGame, makeMove, requestTakeback } = useMobileStore.getState();

    startLocalGame("10+0");
    makeMove("d2", "d4");
    makeMove("d7", "d5");
    expect(useMobileStore.getState().game?.moves.length).toBe(2);

    requestTakeback();
    expect(useMobileStore.getState().game?.moves.length).toBe(1);
    expect(useMobileStore.getState().game?.moves).toEqual(["d4"]);
    expect(useMobileStore.getState().game?.turn).toBe("black");
  });

  it("handles resignation cleanly and updates history", () => {
    const { startLocalGame, resign } = useMobileStore.getState();

    startLocalGame("5+0");
    const initialHistoryLength = useMobileStore.getState().history.length;

    resign();
    const game = useMobileStore.getState().game;
    expect(game?.status).toBe("terminated");
    expect(game?.winner).toBe("black");
    expect(game?.terminationReason).toContain("Resignation");

    expect(useMobileStore.getState().history.length).toBe(initialHistoryLength + 1);
  });
});
