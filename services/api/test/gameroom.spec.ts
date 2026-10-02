import { env, runDurableObjectAlarm } from "cloudflare:test";
import type { ServerGameFrame } from "@etchess/realtime-protocol";
import { drizzle } from "drizzle-orm/d1";
import { beforeAll, describe, expect, it } from "vitest";
import app from "../src";
import * as schema from "../src/db/schema";
import { applyTestSchema } from "./helpers";

describe("GameRoomDO Realtime Service", () => {
  beforeAll(async () => {
    await applyTestSchema(env.DB);

    // Seed test users to satisfy foreign key constraints
    const db = drizzle(env.DB, { schema });
    const now = new Date();
    await db.insert(schema.user).values([
      {
        id: "user-white-1",
        name: "Magnus",
        email: "magnus@example.com",
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "user-black-2",
        name: "Hikaru",
        email: "hikaru@example.com",
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "user-forfeit-w",
        name: "Forfeiter",
        email: "forfeit@example.com",
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "user-winner-b",
        name: "PatientPlayer",
        email: "winner@example.com",
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
      },
    ]);
  });

  it("initializes room, connects players, executes legal moves and broadcasts updates", async () => {
    const roomId = crypto.randomUUID();
    const roomDO = env.GAME_ROOM_DO.get(env.GAME_ROOM_DO.idFromName(roomId));

    // 1. Initialize room
    const initRes = await roomDO.fetch("http://internal/init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gameId: roomId,
        whiteUserId: "user-white-1",
        whiteUserName: "Magnus",
        blackUserId: "user-black-2",
        blackUserName: "Hikaru",
        timeControl: "3+2",
        rated: true,
      }),
    });
    expect(initRes.status).toBe(200);

    // 2. Connect White Player via WebSocket
    const whiteReq = new Request(
      `http://localhost/ws/game/${roomId}?userId=user-white-1&userName=Magnus&role=white`,
      {
        headers: { Upgrade: "websocket" },
      },
    );
    const whiteRes = await app.fetch(whiteReq, env);
    expect(whiteRes.status).toBe(101);
    const whiteWs = whiteRes.webSocket;
    if (!whiteWs) throw new Error("Expected WebSocket");
    whiteWs.accept();

    const whiteMessages: ServerGameFrame[] = [];
    whiteWs.addEventListener("message", (event) => {
      whiteMessages.push(JSON.parse(event.data as string) as ServerGameFrame);
    });

    // 3. Connect Black Player via WebSocket
    const blackReq = new Request(
      `http://localhost/ws/game/${roomId}?userId=user-black-2&userName=Hikaru&role=black`,
      {
        headers: { Upgrade: "websocket" },
      },
    );
    const blackRes = await app.fetch(blackReq, env);
    expect(blackRes.status).toBe(101);
    const blackWs = blackRes.webSocket;
    if (!blackWs) throw new Error("Expected WebSocket");
    blackWs.accept();

    const blackMessages: ServerGameFrame[] = [];
    blackWs.addEventListener("message", (event) => {
      blackMessages.push(JSON.parse(event.data as string) as ServerGameFrame);
    });

    // Wait a brief moment for initial GAME_SYNC
    await new Promise((r) => setTimeout(r, 50));
    expect(whiteMessages.some((m) => m.type === "GAME_SYNC")).toBe(true);
    expect(blackMessages.some((m) => m.type === "GAME_SYNC")).toBe(true);

    // 4. White moves e2 -> e4
    whiteWs.send(
      JSON.stringify({
        type: "MOVE",
        payload: { from: "e2", to: "e4" },
      }),
    );

    await new Promise((r) => setTimeout(r, 50));

    // Both should receive MOVE_MADE with san "e4"
    const whiteMove = whiteMessages.find((m) => m.type === "MOVE_MADE");
    const blackMove = blackMessages.find((m) => m.type === "MOVE_MADE");

    expect(whiteMove).toBeDefined();
    if (whiteMove?.type === "MOVE_MADE") {
      expect(whiteMove.payload.san).toBe("e4");
    }
    expect(blackMove).toBeDefined();
    if (blackMove?.type === "MOVE_MADE") {
      expect(blackMove.payload.san).toBe("e4");
    }

    // 5. White tries to move again out of turn -> rejected with NOT_YOUR_TURN
    whiteWs.send(
      JSON.stringify({
        type: "MOVE",
        payload: { from: "e4", to: "e5" },
      }),
    );
    await new Promise((r) => setTimeout(r, 50));
    const notYourTurn = whiteMessages.find((m) => m.type === "ERROR" && m.code === "NOT_YOUR_TURN");
    expect(notYourTurn).toBeDefined();

    // 6. Black moves e7 -> e5
    blackWs.send(
      JSON.stringify({
        type: "MOVE",
        payload: { from: "e7", to: "e5" },
      }),
    );
    await new Promise((r) => setTimeout(r, 50));

    const movesMade = blackMessages.filter((m) => m.type === "MOVE_MADE");
    expect(movesMade.length).toBe(2);
    if (movesMade[1]?.type === "MOVE_MADE") {
      expect(movesMade[1].payload.san).toBe("e5");
    }

    // 7. Resignation: Black resigns
    blackWs.send(JSON.stringify({ type: "RESIGN" }));
    await new Promise((r) => setTimeout(r, 50));

    const gameEnded = whiteMessages.find((m) => m.type === "GAME_ENDED");
    expect(gameEnded).toBeDefined();
    if (gameEnded?.type === "GAME_ENDED") {
      expect(gameEnded.payload.result).toBe("1-0");
      expect(gameEnded.payload.winner).toBe("white");
      expect(gameEnded.payload.termination).toBe("resignation");
    }

    // Check game record was written to D1
    const gameRecordRes = await app.fetch(new Request(`http://localhost/api/games/${roomId}`), env);
    expect(gameRecordRes.status).toBe(200);
    const gameDetail = (await gameRecordRes.json()) as {
      game: { id: string; result: string; termination: string };
    };
    expect(gameDetail.game.id).toBe(roomId);
    expect(gameDetail.game.result).toBe("1-0");
    expect(gameDetail.game.termination).toBe("resignation");

    whiteWs.close();
    blackWs.close();
  });

  it("handles 60-second disconnect forfeit via Durable Object alarm", async () => {
    const roomId = crypto.randomUUID();
    const roomDO = env.GAME_ROOM_DO.get(env.GAME_ROOM_DO.idFromName(roomId));

    // Initialize room
    await roomDO.fetch("http://internal/init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gameId: roomId,
        whiteUserId: "user-forfeit-w",
        whiteUserName: "Forfeiter",
        blackUserId: "user-winner-b",
        blackUserName: "PatientPlayer",
        timeControl: "5+0",
        rated: true,
      }),
    });

    // Connect White
    const whiteRes = await app.fetch(
      new Request(`http://localhost/ws/game/${roomId}?userId=user-forfeit-w&role=white`, {
        headers: { Upgrade: "websocket" },
      }),
      env,
    );
    const whiteWs = whiteRes.webSocket;
    if (!whiteWs) throw new Error("Expected WebSocket");
    whiteWs.accept();

    // Connect Black
    const blackRes = await app.fetch(
      new Request(`http://localhost/ws/game/${roomId}?userId=user-winner-b&role=black`, {
        headers: { Upgrade: "websocket" },
      }),
      env,
    );
    const blackWs = blackRes.webSocket;
    if (!blackWs) throw new Error("Expected WebSocket");
    blackWs.accept();

    const blackMessages: ServerGameFrame[] = [];
    blackWs.addEventListener("message", (event) => {
      blackMessages.push(JSON.parse(event.data as string) as ServerGameFrame);
    });

    await new Promise((r) => setTimeout(r, 50));

    // White disconnects
    whiteWs.close();
    await new Promise((r) => setTimeout(r, 50));

    const disconnectMsg = blackMessages.find((m) => m.type === "PLAYER_DISCONNECTED");
    expect(disconnectMsg).toBeDefined();
    if (disconnectMsg?.type === "PLAYER_DISCONNECTED") {
      expect(disconnectMsg.role).toBe("white");
      expect(disconnectMsg.gracePeriodMs).toBe(60000);
    }

    // Fast-forward alarm in DO using runDurableObjectAlarm from cloudflare:test
    const didRun = await runDurableObjectAlarm(roomDO);
    expect(didRun).toBe(true);
    await new Promise((r) => setTimeout(r, 50));

    // Black should receive GAME_ENDED with 0-1 and abandoned
    const endMsg = blackMessages.find((m) => m.type === "GAME_ENDED");
    expect(endMsg).toBeDefined();
    if (endMsg?.type === "GAME_ENDED") {
      expect(endMsg.payload.result).toBe("0-1");
      expect(endMsg.payload.winner).toBe("black");
      expect(endMsg.payload.termination).toBe("abandoned");
    }

    blackWs.close();
  });
});
