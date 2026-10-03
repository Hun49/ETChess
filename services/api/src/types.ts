declare global {
  namespace Cloudflare {
    interface Env {
      DB: D1Database;
      GAME_ROOM_DO: DurableObjectNamespace;
      MATCHMAKER_DO: DurableObjectNamespace;
      BETTER_AUTH_SECRET: string;
      BETTER_AUTH_URL?: string;
    }
  }
}

export type Env = Cloudflare.Env;
