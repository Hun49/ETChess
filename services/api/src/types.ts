declare global {
  namespace Cloudflare {
    interface Env {
      DB: D1Database;
      GAME_SESSION_DO: DurableObjectNamespace;
      GAME_ROOM_DO?: DurableObjectNamespace;
      MATCHMAKER_DO: DurableObjectNamespace;
      BETTER_AUTH_SECRET: string;
      BETTER_AUTH_URL?: string;
      WS_TICKET_SECRET?: string;
      ALLOWED_ORIGINS?: string;
      GOOGLE_CLIENT_ID?: string;
      GOOGLE_CLIENT_SECRET?: string;
      RESEND_API_KEY?: string;
      ENVIRONMENT?: string;
    }
  }
}

export type Env = Cloudflare.Env;
