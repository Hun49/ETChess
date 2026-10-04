import type { TimeControlId } from "@etchess/types";

export interface ApiUser {
  id: string;
  name: string;
  email?: string;
  role?: string;
  isGuest?: boolean;
  image?: string | null;
  ratings: {
    bullet: number;
    blitz: number;
    rapid: number;
    classical: number;
  };
}

export interface ApiLeaderboardEntry {
  rank: number;
  id: string;
  name: string;
  image?: string | null;
  rating: number;
  gamesPlayed?: number;
}

export interface ApiFriend {
  id: string;
  name: string;
  rating: number;
  image?: string | null;
  online: boolean;
  status: "accepted" | "pending";
}

export interface ApiChallenge {
  id: string;
  challenger: {
    id: string;
    name: string;
    rating: number;
  };
  timeControlId: TimeControlId;
  rated: boolean;
  preferredColor: "white" | "black" | "random";
  status: "pending" | "accepted" | "declined" | "expired";
  gameId?: string;
}

export interface ApiGameHistoryItem {
  id: string;
  whitePlayerId: string;
  whitePlayerName: string;
  whitePlayerRating: number;
  blackPlayerId: string;
  blackPlayerName: string;
  blackPlayerRating: number;
  timeControlId: TimeControlId;
  rated: boolean;
  result: "1-0" | "0-1" | "1/2-1/2" | "aborted" | null;
  termination: string;
  winner: "white" | "black" | "draw" | null;
  whiteRatingDiff?: number | null;
  blackRatingDiff?: number | null;
  movesCount: number;
  createdAt: string;
}

declare const process:
  | {
      env?: Record<string, string | undefined>;
    }
  | undefined;

export class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl?: string) {
    this.baseUrl =
      baseUrl ||
      (typeof process !== "undefined" && process?.env?.EXPO_PUBLIC_API_URL) ||
      "http://localhost:8787";
  }

  public setToken(token: string | null) {
    this.token = token;
  }

  public getToken(): string | null {
    return this.token;
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
      headers.Cookie = `better-auth.session_token=${this.token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      try {
        const errorJson = await response.json();
        if (errorJson?.error?.message) {
          errorMessage = errorJson.error.message;
        } else if (errorJson?.message) {
          errorMessage = errorJson.message;
        }
      } catch {
        // Response was not JSON
      }
      throw new Error(errorMessage);
    }

    return response.json();
  }

  /**
   * Create an instant guest session
   */
  public async createGuestSession(): Promise<{ user: ApiUser; token: string }> {
    const data = await this.request<{ user: ApiUser; token: string }>("/api/auth/guest", {
      method: "POST",
    });
    this.token = data.token;
    return data;
  }

  /**
   * Get current authenticated user profile and live ratings
   */
  public async getMe(): Promise<{ user: ApiUser }> {
    return this.request<{ user: ApiUser }>("/api/users/me");
  }

  /**
   * Fetch any user's public profile and rating history
   */
  public async getUserProfile(userId: string): Promise<{ user: ApiUser }> {
    return this.request<{ user: ApiUser }>(`/api/users/${userId}/profile`);
  }

  /**
   * Fetch category leaderboard
   */
  public async getLeaderboard(
    category: "bullet" | "blitz" | "rapid" | "classical" = "blitz",
  ): Promise<{ leaderboard: ApiLeaderboardEntry[] }> {
    return this.request<{ leaderboard: ApiLeaderboardEntry[] }>(
      `/api/users/leaderboard?category=${category}`,
    );
  }

  /**
   * Request a single-use HMAC WebSocket authentication ticket
   */
  public async getWsTicket(
    scope: "user" | "game",
    gameId?: string,
  ): Promise<{ ticket: string; expiresIn: number }> {
    return this.request<{ ticket: string; expiresIn: number }>("/api/ws-ticket", {
      method: "POST",
      body: JSON.stringify({ scope, gameId }),
    });
  }

  /**
   * Get paginated match history
   */
  public async getGameHistory(
    page = 1,
    limit = 20,
  ): Promise<{
    games: ApiGameHistoryItem[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    return this.request(`/api/games/history?page=${page}&limit=${limit}`);
  }

  /**
   * Fetch raw PGN for a completed game
   */
  public async getGamePgn(gameId: string): Promise<string> {
    const url = `${this.baseUrl}/api/games/${gameId}/pgn`;
    const headers: Record<string, string> = {};
    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }
    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`Failed to fetch PGN for game ${gameId}`);
    }
    return response.text();
  }

  /**
   * Social: List friends
   */
  public async getFriends(): Promise<{ friends: ApiFriend[] }> {
    return this.request<{ friends: ApiFriend[] }>("/api/friends");
  }

  /**
   * Social: Send friend request
   */
  public async sendFriendRequest(addresseeId: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>("/api/friends/request", {
      method: "POST",
      body: JSON.stringify({ addresseeId }),
    });
  }

  /**
   * Challenges: List pending challenges
   */
  public async getChallenges(): Promise<{ challenges: ApiChallenge[] }> {
    return this.request<{ challenges: ApiChallenge[] }>("/api/challenges");
  }

  /**
   * Challenges: Create a direct challenge to a friend
   */
  public async createChallenge(
    opponentId: string,
    timeControlId: TimeControlId,
    rated = false,
  ): Promise<{ challenge: ApiChallenge }> {
    return this.request<{ challenge: ApiChallenge }>("/api/challenges", {
      method: "POST",
      body: JSON.stringify({
        opponentId,
        timeControlId,
        rated,
        preferredColor: "random",
      }),
    });
  }

  /**
   * Challenges: Accept challenge
   */
  public async acceptChallenge(challengeId: string): Promise<{ gameId: string }> {
    return this.request<{ gameId: string }>(`/api/challenges/${challengeId}/accept`, {
      method: "POST",
    });
  }

  /**
   * Challenges: Decline challenge
   */
  public async declineChallenge(challengeId: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/api/challenges/${challengeId}/decline`, {
      method: "POST",
    });
  }
}

export const api = new ApiClient();
