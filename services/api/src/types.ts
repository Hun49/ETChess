declare global {
  namespace Cloudflare {
    interface Env {
      DB: D1Database;
      GAME_ROOM_DO: DurableObjectNamespace;
      MATCHMAKER_DO: DurableObjectNamespace;
      BETTER_AUTH_SECRET: string;
      BETTER_AUTH_URL?: string;
      GOOGLE_CLIENT_ID?: string;
      GOOGLE_CLIENT_SECRET?: string;
      RESEND_API_KEY?: string;
    }
  }
}

export type Env = Cloudflare.Env;
