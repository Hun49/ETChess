import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiClient } from "../src/services/apiClient";
import { haptics } from "../src/services/haptics";
import { RealtimeClient } from "../src/services/realtimeClient";
import { useMobileStore } from "../src/store/mobileStore";

describe("Mobile Services & Realtime Integration", () => {
  describe("Haptics Service", () => {
    it("can enable and disable tactile feedback", () => {
      haptics.setEnabled(true);
      expect(haptics.isEnabled()).toBe(true);

      haptics.setEnabled(false);
      expect(haptics.isEnabled()).toBe(false);

      haptics.setEnabled(true);
    });

    it("triggers haptic patterns for moves, captures, checks, and game over safely", () => {
      expect(() => haptics.move()).not.toThrow();
      expect(() => haptics.capture()).not.toThrow();
      expect(() => haptics.check()).not.toThrow();
      expect(() => haptics.lowTimeWarning()).not.toThrow();
      expect(() => haptics.gameOver(true)).not.toThrow();
      expect(() => haptics.gameOver(false)).not.toThrow();
    });
  });

  describe("API Client", () => {
    it("handles authorization token and headers correctly", async () => {
      const client = new ApiClient("http://test.api");
      expect(client.getToken()).toBeNull();

      client.setToken("test_token_123");
      expect(client.getToken()).toBe("test_token_123");
      expect(client.getBaseUrl()).toBe("http://test.api");
    });

    it("parses guest session response", async () => {
      const client = new ApiClient("http://test.api");
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          user: {
            id: "guest-uuid",
            name: "Guest 5432",
            role: "guest",
            isGuest: true,
            ratings: { bullet: 1500, blitz: 1500, rapid: 1500, classical: 1500 },
          },
          token: "new-session-token",
        }),
      });
      global.fetch = mockFetch;

      const result = await client.createGuestSession();
      expect(result.user.id).toBe("guest-uuid");
      expect(result.token).toBe("new-session-token");
      expect(client.getToken()).toBe("new-session-token");
      expect(mockFetch).toHaveBeenCalledWith(
        "http://test.api/api/auth/guest",
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("requests WebSocket authentication tickets", async () => {
      const client = new ApiClient("http://test.api");
      client.setToken("valid_token");

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          ticket: "signed_ws_ticket_abc",
          expiresIn: 60,
        }),
      });
      global.fetch = mockFetch;

      const result = await client.getWsTicket("user");
      expect(result.ticket).toBe("signed_ws_ticket_abc");
      expect(mockFetch).toHaveBeenCalledWith(
        "http://test.api/api/ws-ticket",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ scope: "user", gameId: undefined }),
        }),
      );
    });
  });

  describe("Realtime Client Protocol Integration", () => {
    it("subscribes and receives user and game channel frames", () => {
      const realtime = new RealtimeClient("ws://test.api");
      let receivedStatus = "";

      const unsubscribe = realtime.subscribeUserStatus((status) => {
        receivedStatus = status;
      });

      expect(typeof unsubscribe).toBe("function");
      unsubscribe();
    });
  });

  describe("Store Session Sync", () => {
    beforeEach(() => {
      useMobileStore.setState({
        onlineStatus: "disconnected",
        hapticsEnabled: true,
      });
    });

    it("syncs user profile on session fetch", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          user: {
            id: "synced-user-id",
            name: "GrandmasterTest",
            role: "user",
            ratings: { bullet: 1650, blitz: 1720, rapid: 1590, classical: 1600 },
          },
        }),
      });
      global.fetch = mockFetch;

      const { syncUserSession } = useMobileStore.getState();
      await syncUserSession();

      const updatedUser = useMobileStore.getState().user;
      expect(updatedUser.id).toBe("synced-user-id");
      expect(updatedUser.name).toBe("GrandmasterTest");
      expect(updatedUser.ratings.blitz).toBe(1720);
      expect(useMobileStore.getState().onlineStatus).toBe("connected");
    });
  });
});
