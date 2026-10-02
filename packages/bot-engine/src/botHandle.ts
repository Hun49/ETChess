import { BOT_TIERS, type BotConfig, type BotTier } from "@etchess/types";
import { formatGo, formatPositionFen, formatSetOption, parseBestMove } from "./uci";

export interface EngineTransport {
  send(command: string): void;
  onMessage(callback: (line: string) => void): void;
  terminate(): void;
}

export class BotHandle {
  private transport: EngineTransport;
  private currentTier: BotConfig;
  private isReady = false;
  private pendingMoveCallback: ((move: string) => void) | null = null;

  constructor(transport: EngineTransport, tier: BotTier = "beginner") {
    this.transport = transport;
    this.currentTier = BOT_TIERS[tier];

    this.transport.onMessage((line: string) => {
      this.handleEngineOutput(line);
    });
  }

  async init(): Promise<void> {
    return new Promise((resolve) => {
      const checkReady = (line: string) => {
        if (line.trim() === "readyok" || line.trim() === "uciok") {
          this.isReady = true;
          this.applyTierConfig();
          resolve();
        }
      };

      this.transport.onMessage((line) => {
        checkReady(line);
        this.handleEngineOutput(line);
      });

      this.transport.send("uci");
      this.transport.send("isready");
    });
  }

  setTier(tier: BotTier): void {
    this.currentTier = BOT_TIERS[tier];
    if (this.isReady) {
      this.applyTierConfig();
    }
  }

  requestMove(fen: string, onMove: (move: string) => void): void {
    this.pendingMoveCallback = onMove;

    this.transport.send(formatPositionFen(fen));
    this.transport.send(
      formatGo({
        depth: this.currentTier.depthLimit,
        movetime: this.currentTier.timeLimitMs,
      }),
    );
  }

  stop(): void {
    this.transport.send("stop");
    this.pendingMoveCallback = null;
  }

  terminate(): void {
    this.transport.send("quit");
    this.transport.terminate();
    this.pendingMoveCallback = null;
    this.isReady = false;
  }

  private applyTierConfig(): void {
    this.transport.send("ucinewgame");
    this.transport.send(formatSetOption("Skill Level", this.currentTier.skillLevel));
  }

  private handleEngineOutput(line: string): void {
    const bestMoveInfo = parseBestMove(line);
    if (bestMoveInfo && this.pendingMoveCallback) {
      const cb = this.pendingMoveCallback;
      this.pendingMoveCallback = null;
      cb(bestMoveInfo.bestmove);
    }
  }
}

export function createBot(tier: BotTier, transport: EngineTransport): BotHandle {
  return new BotHandle(transport, tier);
}
