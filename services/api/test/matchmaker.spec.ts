import { env } from "cloudflare:test";
import type { ServerMatchmakerFrame } from "@etchess/realtime-protocol";
import { describe, expect, it } from "vitest";
import app from "../src";

describe("MatchmakerDO Realtime Service", () => {
  it("queues player and sends QUEUE_JOINED", async () => {
    const wsRes = await app.fetch(
      new Request(
        "http://localhost/ws/matchmaker?userId=user-solo&userName=SoloPlayer&rating=1500",
        {
          headers: { Upgrade: "websocket" },
        },
      ),
      env,
    );
    expect(wsRes.status).toBe(101);
    const ws = wsRes.webSocket;
    if (!ws) throw new Error("Expected WebSocket");
    ws.accept();

    const messages: ServerMatchmakerFrame[] = [];
    ws.addEventListener("message", (event) => {
      messages.push(JSON.parse(event.data as string) as ServerMatchmakerFrame);
    });

    ws.send(
      JSON.stringify({
        type: "JOIN_QUEUE",
        payload: { timeControl: "3+2", rated: true },
      }),
    );

    await new Promise((r) => setTimeout(r, 50));
    expect(messages.some((m) => m.type === "QUEUE_JOINED")).toBe(true);

    ws.send(JSON.stringify({ type: "LEAVE_QUEUE" }));
    await new Promise((r) => setTimeout(r, 50));
    expect(messages.some((m) => m.type === "QUEUE_LEFT")).toBe(true);

    ws.close();
  });

  it("pairs two queued players with compatible rating and same time control", async () => {
    // Player 1
    const p1Res = await app.fetch(
      new Request("http://localhost/ws/matchmaker?userId=user-p1&userName=Alice&rating=1520", {
        headers: { Upgrade: "websocket" },
      }),
      env,
    );
    expect(p1Res.status).toBe(101);
    const p1Ws = p1Res.webSocket;
    if (!p1Ws) throw new Error("Expected WebSocket");
    p1Ws.accept();

    const p1Messages: ServerMatchmakerFrame[] = [];
    p1Ws.addEventListener("message", (event) => {
      p1Messages.push(JSON.parse(event.data as string) as ServerMatchmakerFrame);
    });

    // Player 2
    const p2Res = await app.fetch(
      new Request("http://localhost/ws/matchmaker?userId=user-p2&userName=Bob&rating=1500", {
        headers: { Upgrade: "websocket" },
      }),
      env,
    );
    expect(p2Res.status).toBe(101);
    const p2Ws = p2Res.webSocket;
    if (!p2Ws) throw new Error("Expected WebSocket");
    p2Ws.accept();

    const p2Messages: ServerMatchmakerFrame[] = [];
    p2Ws.addEventListener("message", (event) => {
      p2Messages.push(JSON.parse(event.data as string) as ServerMatchmakerFrame);
    });

    // Player 1 joins queue
    p1Ws.send(
      JSON.stringify({
        type: "JOIN_QUEUE",
        payload: { timeControl: "10+0", rated: true },
      }),
    );
    await new Promise((r) => setTimeout(r, 50));

    // Player 2 joins queue with matching timeControl
    p2Ws.send(
      JSON.stringify({
        type: "JOIN_QUEUE",
        payload: { timeControl: "10+0", rated: true },
      }),
    );
    await new Promise((r) => setTimeout(r, 50));

    // Both should receive MATCH_FOUND
    const p1Match = p1Messages.find((m) => m.type === "MATCH_FOUND");
    const p2Match = p2Messages.find((m) => m.type === "MATCH_FOUND");

    expect(p1Match).toBeDefined();
    expect(p2Match).toBeDefined();

    if (p1Match?.type === "MATCH_FOUND" && p2Match?.type === "MATCH_FOUND") {
      expect(p1Match.payload.gameId).toBe(p2Match.payload.gameId);

      // One is white, one is black
      const colors = [p1Match.payload.color, p2Match.payload.color].sort();
      expect(colors).toEqual(["black", "white"]);

      // Opponent metadata verification: p1's opponent is p2, p2's opponent is p1
      expect(p1Match.payload.opponent.id).toBe("user-p2");
      expect(p2Match.payload.opponent.id).toBe("user-p1");
    }

    p1Ws.close();
    p2Ws.close();
  });
});
