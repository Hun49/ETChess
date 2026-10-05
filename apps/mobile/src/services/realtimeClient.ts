import {
  type ClientGameFrame,
  type ClientUserFrame,
  type ServerGameFrameOutput,
  type ServerUserFrameOutput,
  parseServerGameFrame,
  parseServerUserFrame,
} from "@etchess/realtime-protocol";

type UserMessageHandler = (frame: ServerUserFrameOutput) => void;
type GameMessageHandler = (frame: ServerGameFrameOutput) => void;
type ConnectionStatusHandler = (status: "connected" | "connecting" | "disconnected") => void;

declare const process:
  | {
      env?: Record<string, string | undefined>;
    }
  | undefined;

export class RealtimeClient {
  private wsBaseUrl: string;

  // User WebSocket (/ws/user)
  private userWs: WebSocket | null = null;
  private userListeners: Set<UserMessageHandler> = new Set();
  private userStatusListeners: Set<ConnectionStatusHandler> = new Set();
  private userPingInterval: ReturnType<typeof setInterval> | null = null;

  // Game WebSocket (/ws/game/:id)
  private gameWs: WebSocket | null = null;
  private gameListeners: Set<GameMessageHandler> = new Set();
  private gameStatusListeners: Set<ConnectionStatusHandler> = new Set();
  private gamePingInterval: ReturnType<typeof setInterval> | null = null;

  constructor(wsBaseUrl?: string) {
    const defaultHttpUrl =
      typeof process !== "undefined" && process?.env?.NODE_ENV === "production"
        ? "https://api.etchess.io"
        : "http://localhost:8787";
    const defaultUrl =
      (typeof process !== "undefined" && process?.env?.EXPO_PUBLIC_API_URL) || defaultHttpUrl;
    this.wsBaseUrl = wsBaseUrl || defaultUrl.replace(/^http/, "ws");
  }

  // ==========================================================================
  // USER CHANNEL (/ws/user)
  // ==========================================================================

  public connectUser(ticket: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.disconnectUser();

      const url = `${this.wsBaseUrl}/ws/user?ticket=${encodeURIComponent(ticket)}`;
      this.notifyUserStatus("connecting");

      try {
        const ws = new WebSocket(url);
        this.userWs = ws;

        ws.onopen = () => {
          this.notifyUserStatus("connected");
          this.startUserPing();
          resolve();
        };

        ws.onmessage = (event) => {
          const parsed = parseServerUserFrame(event.data);
          if (parsed.success) {
            for (const listener of this.userListeners) {
              try {
                listener(parsed.data);
              } catch (err) {
                console.error("Error in user WS listener:", err);
              }
            }
          }
        };

        ws.onerror = (err) => {
          this.notifyUserStatus("disconnected");
          reject(err);
        };

        ws.onclose = () => {
          this.stopUserPing();
          this.notifyUserStatus("disconnected");
        };
      } catch (err) {
        this.notifyUserStatus("disconnected");
        reject(err);
      }
    });
  }

  public disconnectUser(): void {
    this.stopUserPing();
    if (this.userWs) {
      try {
        this.userWs.close();
      } catch {
        // Ignore
      }
      this.userWs = null;
      this.notifyUserStatus("disconnected");
    }
  }

  public sendUserMessage(frame: ClientUserFrame): boolean {
    if (!this.userWs || this.userWs.readyState !== WebSocket.OPEN) {
      return false;
    }
    this.userWs.send(JSON.stringify(frame));
    return true;
  }

  public subscribeUser(handler: UserMessageHandler): () => void {
    this.userListeners.add(handler);
    return () => this.userListeners.delete(handler);
  }

  public subscribeUserStatus(handler: ConnectionStatusHandler): () => void {
    this.userStatusListeners.add(handler);
    return () => this.userStatusListeners.delete(handler);
  }

  private notifyUserStatus(status: "connected" | "connecting" | "disconnected") {
    for (const listener of this.userStatusListeners) {
      try {
        listener(status);
      } catch {
        // Ignore
      }
    }
  }

  private startUserPing(): void {
    this.stopUserPing();
    this.userPingInterval = setInterval(() => {
      this.sendUserMessage({
        v: 1,
        type: "HEARTBEAT_PING",
        payload: { clientSeq: Date.now() },
      });
    }, 15000);
  }

  private stopUserPing(): void {
    if (this.userPingInterval) {
      clearInterval(this.userPingInterval);
      this.userPingInterval = null;
    }
  }

  // ==========================================================================
  // GAME CHANNEL (/ws/game/:id)
  // ==========================================================================

  public connectGame(gameId: string, ticket: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.disconnectGame();

      const url = `${this.wsBaseUrl}/ws/game/${encodeURIComponent(gameId)}?ticket=${encodeURIComponent(ticket)}`;
      this.notifyGameStatus("connecting");

      try {
        const ws = new WebSocket(url);
        this.gameWs = ws;

        ws.onopen = () => {
          this.notifyGameStatus("connected");
          this.startGamePing();
          resolve();
        };

        ws.onmessage = (event) => {
          const parsed = parseServerGameFrame(event.data);
          if (parsed.success) {
            for (const listener of this.gameListeners) {
              try {
                listener(parsed.data);
              } catch (err) {
                console.error("Error in game WS listener:", err);
              }
            }
          }
        };

        ws.onerror = (err) => {
          this.notifyGameStatus("disconnected");
          reject(err);
        };

        ws.onclose = () => {
          this.stopGamePing();
          this.notifyGameStatus("disconnected");
        };
      } catch (err) {
        this.notifyGameStatus("disconnected");
        reject(err);
      }
    });
  }

  public disconnectGame(): void {
    this.stopGamePing();
    if (this.gameWs) {
      try {
        this.gameWs.close();
      } catch {
        // Ignore
      }
      this.gameWs = null;
      this.notifyGameStatus("disconnected");
    }
  }

  public sendGameMessage(frame: ClientGameFrame): boolean {
    if (!this.gameWs || this.gameWs.readyState !== WebSocket.OPEN) {
      return false;
    }
    this.gameWs.send(JSON.stringify(frame));
    return true;
  }

  public subscribeGame(handler: GameMessageHandler): () => void {
    this.gameListeners.add(handler);
    return () => this.gameListeners.delete(handler);
  }

  public subscribeGameStatus(handler: ConnectionStatusHandler): () => void {
    this.gameStatusListeners.add(handler);
    return () => this.gameStatusListeners.delete(handler);
  }

  private notifyGameStatus(status: "connected" | "connecting" | "disconnected") {
    for (const listener of this.gameStatusListeners) {
      try {
        listener(status);
      } catch {
        // Ignore
      }
    }
  }

  private startGamePing(): void {
    this.stopGamePing();
    this.gamePingInterval = setInterval(() => {
      this.sendGameMessage({
        v: 1,
        type: "HEARTBEAT_PING",
        payload: { clientSeq: Date.now() },
      });
    }, 15000);
  }

  private stopGamePing(): void {
    if (this.gamePingInterval) {
      clearInterval(this.gamePingInterval);
      this.gamePingInterval = null;
    }
  }
}

export const realtime = new RealtimeClient();
