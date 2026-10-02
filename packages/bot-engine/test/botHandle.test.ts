import { describe, expect, it } from "vitest";
import { BotHandle, type EngineTransport } from "../src/botHandle";

class MockEngineTransport implements EngineTransport {
  public sentCommands: string[] = [];
  public messageCallback: ((line: string) => void) | null = null;
  public terminated = false;

  send(command: string): void {
    this.sentCommands.push(command);
  }

  onMessage(callback: (line: string) => void): void {
    this.messageCallback = callback;
  }

  terminate(): void {
    this.terminated = true;
  }

  emit(line: string): void {
    if (this.messageCallback) {
      this.messageCallback(line);
    }
  }
}

describe("BotHandle lifecycle", () => {
  it("initializes engine and sets skill level for beginner tier", async () => {
    const transport = new MockEngineTransport();
    const bot = new BotHandle(transport, "beginner");

    const initPromise = bot.init();
    transport.emit("uciok");
    transport.emit("readyok");
    await initPromise;

    expect(transport.sentCommands).toContain("uci");
    expect(transport.sentCommands).toContain("isready");
    expect(transport.sentCommands).toContain("ucinewgame");
    expect(transport.sentCommands).toContain("setoption name Skill Level value 1");
  });

  it("sends position and go command when requesting move", () => {
    const transport = new MockEngineTransport();
    const bot = new BotHandle(transport, "intermediate");

    let receivedMove: string | null = null;
    bot.requestMove("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", (move) => {
      receivedMove = move;
    });

    expect(transport.sentCommands).toContain(
      "position fen rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    );
    expect(transport.sentCommands).toContain("go depth 7 movetime 800");

    // Engine responds with bestmove
    transport.emit("bestmove e2e4 ponder e7e5");
    expect(receivedMove).toBe("e2e4");
  });

  it("handles stop and terminate cleanly", () => {
    const transport = new MockEngineTransport();
    const bot = new BotHandle(transport, "advanced");

    bot.stop();
    expect(transport.sentCommands).toContain("stop");

    bot.terminate();
    expect(transport.sentCommands).toContain("quit");
    expect(transport.terminated).toBe(true);
  });
});
